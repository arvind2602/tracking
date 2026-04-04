const Joi = require('joi');
const { pool } = require('../../config/db');
const { BadRequestError, UnauthorizedError, NotFoundError } = require('../../utils/errors');

// Haversine formula for distance between two coordinates in meters
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Validate request IP
const getRequestIP = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    '0.0.0.0'
  );
};

// ==================== DEVICE MANAGEMENT ====================

// User first login - auto-set primary device
const setPrimaryDevice = async (req, res, next) => {
  const { user_uuid } = req.user;
  const { deviceId, deviceName, deviceType, browser, os } = req.body;

  const schema = Joi.object({
    deviceId: Joi.string().required(),
    deviceName: Joi.string().optional(),
    deviceType: Joi.string().optional(),
    browser: Joi.string().optional(),
    os: Joi.string().optional(),
  });

  const { error } = schema.validate(req.body);
  if (error) return next(new BadRequestError(error.details[0].message));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if device already exists for this user
    const existingResult = await client.query(
      `SELECT id, is_primary FROM device WHERE "deviceId" = $1 AND "employeeId" = $2`,
      [deviceId, user_uuid]
    );

    let deviceIdParam;
    if (existingResult.rowCount > 0) {
      deviceIdParam = existingResult.rows[0].id;
      // Update device info if changed
      await client.query(
        `UPDATE device SET "deviceName" = $1, "deviceType" = $2, browser = $3, os = $4, "lastUsedAt" = NOW() WHERE id = $5`,
        [deviceName, deviceType, browser, os, deviceIdParam]
      );
    } else {
      // Insert new device
      const insertResult = await client.query(
        `INSERT INTO device ("deviceId", "deviceName", "deviceType", browser, os, "employeeId", "isPrimary")
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [deviceId, deviceName || null, deviceType || null, browser || null, os || null, user_uuid, true]
      );
      deviceIdParam = insertResult.rows[0].id;
    }

    // If this is a new primary device, update employee's lastDeviceId
    await client.query(
      `UPDATE employee SET "lastDeviceId" = $1 WHERE id = $2`,
      [deviceId, user_uuid]
    );

    await client.query('COMMIT');

    res.json({ deviceId: deviceIdParam, message: 'Device registered' });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

// Check for new/unregistered device on login
const checkDeviceChange = async (req, res, next) => {
  const { user_uuid } = req.user;
  const { deviceId } = req.body;

  if (!deviceId) return next(new BadRequestError('Device ID required'));

  try {
    const result = await pool.query(
      `SELECT id, "isPrimary", "deviceName", "deviceType", "lastUsedAt"
       FROM device
       WHERE "deviceId" = $1 AND "employeeId" = $2`,
      [deviceId, user_uuid]
    );

    if (result.rowCount === 0) {
      // New device - not registered
      return res.json({ isNewDevice: true, message: 'New device detected' });
    }

    const device = result.rows[0];

    // If device changed from the one used in last attendance
    const attendanceResult = await pool.query(
      `SELECT a."deviceId", a."checkIn", d."deviceId" as "fingerprint"
       FROM attendance a
       LEFT JOIN device d ON a."deviceId" = d.id
       WHERE a."employeeId" = $1
       ORDER BY a."checkIn" DESC
       LIMIT 1`,
      [user_uuid]
    );

    if (attendanceResult.rowCount > 0) {
      const lastAttendance = attendanceResult.rows[0];
      if (lastAttendance.fingerprint !== deviceId) {
        return res.json({
          deviceChanged: true,
          lastUsedDevice: lastAttendance.fingerprint || lastAttendance.deviceId,
          lastAttendanceAt: lastAttendance.checkIn,
          message: 'Device changed since last attendance'
        });
      }
    }

    res.json({
      isNewDevice: false,
      deviceInfo: { id: device.id, name: device.deviceName, type: device.deviceType }
    });
  } catch (error) {
    next(error);
  }
};

// ==================== ORGANIZATION GEOFENCE ====================

const getOrganizationGeofence = async (req, res, next) => {
  const orgId = req.user.organization_uuid;

  try {
    const result = await pool.query(
      `SELECT g.id, g.name, g.latitude, g.longitude, g.radius, g."isActive",
              og."isEnabled", og.id as "orgGeofenceId"
       FROM geofence g
       LEFT JOIN organizationgeofence og ON g.id = og."geofenceId" AND og."organizationId" = $1
       WHERE g."organizationId" = $1`,
      [orgId]
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const setOrganizationGeofence = async (req, res, next) => {
  const orgId = req.user.organization_uuid;
  const { geofenceId, isEnabled } = req.body;

  if (!geofenceId) return next(new BadRequestError('Geofence ID required'));
  if (isEnabled === undefined) return next(new BadRequestError('isEnabled required'));

  try {
    const result = await pool.query(
      `INSERT INTO organizationgeofence ("organizationId", "geofenceId", "isEnabled")
       VALUES ($1, $2, $3)
       ON CONFLICT ("organizationId", "geofenceId")
       DO UPDATE SET "isEnabled" = $3
       RETURNING id, "geofenceId", "isEnabled"`,
      [orgId, geofenceId, isEnabled]
    );

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

// ==================== CHECK-IN / CHECK-OUT ====================

const checkIn = async (req, res, next) => {
  const { user_uuid } = req.user;
  const { latitude, longitude, location, deviceId, deviceName, deviceTime } = req.body;

  // Validate required fields
  if (latitude === undefined || longitude === undefined || latitude === 'null' || longitude === 'null') {
    return next(new BadRequestError('Latitude and longitude are required'));
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng)) {
    return next(new BadRequestError('Invalid coordinates provided'));
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get organization geofence settings
    const geofenceResult = await client.query(
      `SELECT g.latitude, g.longitude, g.radius, og."isEnabled"
       FROM organizationgeofence og
       JOIN geofence g ON g.id = og."geofenceId"
       WHERE og."organizationId" = $1 AND og."isEnabled" = true`,
      [req.user.organization_uuid]
    );

    let withinGeofence = true;
    if (geofenceResult.rowCount > 0) {
      const gf = geofenceResult.rows[0];
      const distance = calculateDistance(lat, lng, gf.latitude, gf.longitude);
      const radius = Math.max(gf.radius, 100); // Minimum 100m radius to account for GPS drift
      withinGeofence = distance <= radius;

      if (!withinGeofence) {
        // Still allow check-in but mark as outside geofence
        // Admin can review later or block based on policy
        withinGeofence = false;
      }
    }

    // Check if user already checked in today
    const checkTime = deviceTime ? new Date(deviceTime) : new Date();
    const checkDate = checkTime.toISOString().split('T')[0];

    const existingResult = await client.query(
      `SELECT id, "checkIn", "checkOut", status FROM attendance
       WHERE "employeeId" = $1 AND date = $2::date`,
      [user_uuid, checkDate]
    );

    if (existingResult.rowCount > 0) {
      const attendance = existingResult.rows[0];
      if (attendance.checkIn && !attendance.checkOut) {
        return next(new BadRequestError('Already checked in today'));
      }
    }

    // 1. Get Employee's Shift
    const shiftResult = await client.query(
      `SELECT s.* FROM shift s 
       JOIN employeeshift es ON s.id = es."shiftId"
       WHERE es."employeeId" = $1 AND s."isActive" = true
       LIMIT 1`,
      [user_uuid]
    );

    let lateBy = 0;
    let shiftId = null;
    let status = 'PRESENT';

    if (shiftResult.rowCount > 0) {
      const shift = shiftResult.rows[0];
      shiftId = shift.id;
      const [shiftH, shiftM] = shift.startTime.split(':').map(Number);
      const shiftStartTime = new Date(checkTime);
      shiftStartTime.setHours(shiftH, shiftM, 0, 0);

      const diffMs = checkTime - shiftStartTime;
      const diffMins = Math.floor(diffMs / (1000 * 60));

      if (diffMins > shift.gracePeriod) {
        lateBy = diffMins;
        status = 'LATE';
      }
    }

    // 2. Get Device Info and Check Mismatch
    const currentDeviceResult = await client.query(
      `SELECT id FROM device WHERE "employeeId" = $1 AND "deviceId" = $2`,
      [user_uuid, deviceId]
    );
    const deviceUuid = currentDeviceResult.rowCount > 0 ? currentDeviceResult.rows[0].id : null;

    const primaryDeviceResult = await client.query(
      `SELECT "deviceId" FROM device WHERE "employeeId" = $1 AND "isPrimary" = true`,
      [user_uuid]
    );

    let deviceMismatch = false;
    if (primaryDeviceResult.rowCount > 0) {
      if (primaryDeviceResult.rows[0].deviceId !== deviceId) {
        deviceMismatch = true;
      }
    }

    // Insert or update attendance for check-in
    const insertResult = await client.query(
      `INSERT INTO attendance ("employeeId", date, "checkIn", latitude, longitude, location, "deviceId", "deviceName", status, "lateBy", "shiftId", "deviceMismatch", "withinGeofence")
       VALUES ($1, $2::date, $3::timestamp, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT ("employeeId", date)
       DO UPDATE SET
         "checkIn" = EXCLUDED."checkIn",
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         location = EXCLUDED.location,
         "deviceId" = EXCLUDED."deviceId",
         "deviceName" = EXCLUDED."deviceName",
         status = EXCLUDED.status,
         "lateBy" = EXCLUDED."lateBy",
         "shiftId" = EXCLUDED."shiftId",
         "deviceMismatch" = EXCLUDED."deviceMismatch",
         "withinGeofence" = EXCLUDED."withinGeofence"
       RETURNING id, "checkIn", status`,
      [
        user_uuid,
        checkDate,
        checkTime,
        lat,
        lng,
        location || null,
        deviceUuid,
        deviceName || null,
        status,
        lateBy,
        shiftId,
        deviceMismatch,
        withinGeofence
      ]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      checkInTime: insertResult.rows[0].checkIn,
      status: insertResult.rows[0].status,
      withinGeofence,
      deviceMismatch,
      message: withinGeofence ? 'Check-in successful' : 'Checked in outside geofence area'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

const checkOut = async (req, res, next) => {
  const { user_uuid } = req.user;
  const { latitude, longitude, location, deviceTime } = req.body;

  const lat = latitude === 'null' || latitude === null ? null : parseFloat(latitude);
  const lng = longitude === 'null' || longitude === null ? null : parseFloat(longitude);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get today's attendance
    const checkTime = deviceTime ? new Date(deviceTime) : new Date();
    const checkDate = checkTime.toISOString().split('T')[0];

    const result = await client.query(
      `SELECT id, "checkIn", "checkOut", status, "workHours"
       FROM attendance
       WHERE "employeeId" = $1 AND date = $2::date`,
      [user_uuid, checkDate]
    );

    if (result.rowCount === 0) {
      return next(new NotFoundError('No check-in found for today'));
    }

    const attendance = result.rows[0];

    if (attendance.checkOut) {
      return next(new BadRequestError('Already checked out today'));
    }

    // Calculate work hours
    const checkInTime = new Date(attendance.checkIn);
    const workHours = (checkTime - checkInTime) / (1000 * 60 * 60); // in hours

    // Update attendance with check-out
    const updateResult = await client.query(
      `UPDATE attendance
       SET "checkOut" = $1::timestamp,
           latitude = COALESCE(latitude, $2),
           longitude = COALESCE(longitude, $3),
           location = COALESCE(location, $4),
           "workHours" = $5,
           "updatedAt" = $1::timestamp
       WHERE id = $6
       RETURNING id, "checkIn", "checkOut", "workHours", status`,
      [checkTime, lat, lng, location || null, Math.round(workHours * 100) / 100, attendance.id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      checkOutTime: updateResult.rows[0].checkOut,
      workHours: updateResult.rows[0].workHours,
      status: updateResult.rows[0].status,
      message: 'Check-out successful'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

// ==================== LEAVE REQUESTS (using Note with tags) ====================

const requestLeave = async (req, res, next) => {
  const { user_uuid } = req.user;
  const { title, content, startDate, endDate, leaveType, tagAdminIds = [] } = req.body;

  const schema = Joi.object({
    title: Joi.string().required(),
    content: Joi.string().optional(),
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().required(),
    leaveType: Joi.string().valid('SICK', 'CASUAL', 'PAYED', 'UNPAID').required(),
    tagAdminIds: Joi.array().items(Joi.string()).optional(),
    deviceTime: Joi.date().iso().optional()
  });

  const { error } = schema.validate(req.body);
  if (error) return next(new BadRequestError(error.details[0].message));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const taskTime = req.body.deviceTime ? new Date(req.body.deviceTime) : new Date();
    // Create note for leave request
    const noteResult = await pool.query(
      `INSERT INTO note (title, type, "organizationId", "authorId", content, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6::timestamp, $6::timestamp)
       RETURNING id, title, type, "createdAt"`,
      [title, 'LEAVE', req.user.organization_uuid, user_uuid, JSON.stringify({ ...req.body, status: 'pending', type: leaveType }), taskTime]
    );

    const noteId = noteResult.rows[0].id;

    // Tag admins (if any specified, otherwise all admins)
    const tagIds = tagAdminIds.length > 0 ? tagAdminIds : await getAdminIds(client, req.user.organization_uuid);

    for (const adminId of tagIds) {
      await client.query(
        `INSERT INTO note_tag ("noteId", "employeeId") VALUES ($1, $2)`,
        [noteId, adminId]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      noteId,
      message: 'Leave request submitted'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

// Helper to get admin IDs
const getAdminIds = async (client, orgId) => {
  const result = await client.query(
    `SELECT id FROM employee WHERE "organiationId" = $1 AND role = 'ADMIN'`,
    [orgId]
  );
  return result.rows.map(r => r.id);
};

// Get leave requests for employee
const getMyLeaveRequests = async (req, res, next) => {
  const { user_uuid } = req.user;

  try {
    const result = await pool.query(
      `SELECT n.id, n.title, n.type, n."createdAt", n."updatedAt", n.content,
              ARRAY_AGG(nt."employeeId") as taggedAdmins
       FROM note n
       LEFT JOIN note_tag nt ON n.id = nt."noteId"
       WHERE n."authorId" = $1 AND n.type = 'LEAVE'
       GROUP BY n.id
       ORDER BY n."createdAt" DESC`,
      [user_uuid]
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

// Get leave requests for admin (all in org)
const getLeaveRequests = async (req, res, next) => {
  const orgId = req.user.organization_uuid;
  const { status } = req.query; // PENDING, APPROVED, REJECTED

  try {
    let query = `
      SELECT n.id, n.title, n.type, n."createdAt", n.content, n."isPinned", n."pinUntil",
             e."firstName", e."lastName", e.email, e.position,
             ARRAY_AGG(DISTINCT nt."employeeId") as taggedAdmins
      FROM note n
      JOIN employee e ON e.id = n."authorId"
      LEFT JOIN note_tag nt ON n.id = nt."noteId"
      WHERE n."organizationId" = $1 AND n.type = 'LEAVE'
    `;
    const params = [orgId];

    if (status) {
      query += ` AND n.content->>'status' = $2`;
      params.push(status);
    }

    query += ` GROUP BY n.id, e.id ORDER BY n."createdAt" DESC`;

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

// Approve/Reject leave request
const updateLeaveRequest = async (req, res, next) => {
  const { user_uuid } = req.user;
  const { noteId, status } = req.body;

  if (!noteId || !status) {
    return next(new BadRequestError('noteId and status are required'));
  }

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return next(new BadRequestError('Status must be APPROVED or REJECTED'));
  }

  try {
    const updateTime = req.body.deviceTime ? new Date(req.body.deviceTime) : new Date();
    const result = await pool.query(
      `UPDATE note
       SET content = jsonb_set(content, '{status}', to_jsonb($1::text)),
           "isPinned" = true,
           "updatedAt" = $3::timestamp
       WHERE id = $2
       RETURNING id, content`,
      [status.toLowerCase(), noteId, updateTime]
    );

    if (result.rowCount === 0) {
      return next(new NotFoundError('Leave request not found'));
    }

    res.json({ success: true, message: `Leave request ${status.toLowerCase()}` });
  } catch (error) {
    next(error);
  }
};

// ==================== ATTENDANCE HISTORY ====================

const getAttendanceHistory = async (req, res, next) => {
  const { user_uuid } = req.user;
  const { startDate, endDate, status } = req.query;

  let query = `
    SELECT a.id, a.date, a."checkIn", a."checkOut", a.status,
           a.latitude, a.longitude, a.location, a."workHours", a."lateBy",
           a."deviceId", a."deviceName", a."ipAddress", a.notes,
           a."deviceMismatch", a."withinGeofence",
           s.name as "shiftName", s."startTime", s."endTime"
    FROM attendance a
    LEFT JOIN shift s ON s.id = a."shiftId"
    WHERE a."employeeId" = $1
  `;
  const params = [user_uuid];

  if (startDate) {
    query += ` AND a.date >= $${params.length + 1}`;
    params.push(startDate);
  }
  if (endDate) {
    query += ` AND a.date <= $${params.length + 1}`;
    params.push(endDate);
  }
  if (status) {
    query += ` AND a.status = $${params.length + 1}`;
    params.push(status);
  }

  query += ` ORDER BY a.date DESC`;

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const getMonthlySummary = async (req, res, next) => {
  const { user_uuid } = req.user;
  const { year, month } = req.query;
  const now = new Date();
  const targetYear = year ? parseInt(year) : now.getFullYear();
  const targetMonth = month ? parseInt(month) : now.getMonth();

  try {
    const result = await pool.query(
      `SELECT
         DATE_TRUNC('month', a.date) as month,
         COUNT(*) FILTER (WHERE a.status = 'PRESENT') as presentDays,
         COUNT(*) FILTER (WHERE a.status = 'ABSENT') as absentDays,
         COUNT(*) FILTER (WHERE a.status = 'LATE') as lateDays,
         COUNT(*) FILTER (WHERE a.status = 'HALF_DAY') as halfDayDays,
         COUNT(*) FILTER (WHERE a.status = 'WFH') as wfhDays,
         COUNT(*) FILTER (WHERE a.status = 'LEAVE') as leaveDays,
         COUNT(*) FILTER (WHERE a.status = 'HOLIDAY') as holidayDays,
         COALESCE(SUM(a."workHours"), 0) as totalHours,
         COUNT(*) as totalDays
       FROM attendance a
       WHERE a."employeeId" = $1
         AND EXTRACT(YEAR FROM a.date) = $2
         AND EXTRACT(MONTH FROM a.date) = $3
       GROUP BY DATE_TRUNC('month', a.date)`,
      [user_uuid, targetYear, targetMonth + 1] // PostgreSQL month is 1-based
    );

    res.json(result.rows[0] || {
      month: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`,
      presentDays: 0,
      absentDays: 0,
      lateDays: 0,
      halfDayDays: 0,
      wfhDays: 0,
      leaveDays: 0,
      holidayDays: 0,
      totalHours: 0,
      totalDays: 0
    });
  } catch (error) {
    next(error);
  }
};

// ==================== ADMIN: ALL EMPLOYEES ATTENDANCE ====================

const getOrganizationAttendance = async (req, res, next) => {
  const orgId = req.user.organization_uuid;
  const { date, startDate, endDate, status, employeeId, deviceMismatch, withinGeofence, search } = req.query;

  let query = `
    SELECT a.id, a.date, a."checkIn", a."checkOut", a.status,
           a.latitude, a.longitude, a.location, a."workHours", a."lateBy",
           a."deviceId", a."deviceName", a."deviceMismatch", a."withinGeofence",
           e.id as "employeeId", e."firstName", e."lastName", e.email, e.position
    FROM attendance a
    JOIN employee e ON e.id = a."employeeId"
    WHERE e."organiationId" = $1
  `;
  const params = [orgId];
  let paramIndex = 2;

  if (search) {
    query += ` AND (e."firstName" ILIKE $${paramIndex} OR e."lastName" ILIKE $${paramIndex} OR e.email ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (date) {
    query += ` AND a.date = $${paramIndex}`;
    params.push(date);
    paramIndex++;
  } else {
    if (startDate) {
      query += ` AND a.date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      query += ` AND a.date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }
  }

  if (status && status !== 'all') {
    if (status === 'MISSED') {
      query += ` AND a."checkOut" IS NULL AND a.date < CURRENT_DATE`;
    } else {
      query += ` AND a.status = $${paramIndex}`;
      params.push(status.toUpperCase());
      paramIndex++;
    }
  }

  if (employeeId && employeeId !== 'all') {
    query += ` AND a."employeeId" = $${paramIndex}`;
    params.push(employeeId);
    paramIndex++;
  }

  if (deviceMismatch !== undefined && deviceMismatch !== 'all') {
    query += ` AND a."deviceMismatch" = $${paramIndex}`;
    params.push(deviceMismatch === 'true' || deviceMismatch === true);
    paramIndex++;
  }

  if (withinGeofence !== undefined && withinGeofence !== 'all') {
    query += ` AND a."withinGeofence" = $${paramIndex}`;
    params.push(withinGeofence === 'true' || withinGeofence === true);
    paramIndex++;
  }

  query += ` ORDER BY a.date DESC, e."firstName"`;

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

// ==================== SHIFT MANAGEMENT ====================

const getShifts = async (req, res, next) => {
  const orgId = req.user.organization_uuid;

  try {
    const result = await pool.query(
      `SELECT s.*,
              COUNT(DISTINCT es."employeeId") as "employeeCount"
       FROM shift s
       LEFT JOIN employeeshift es ON s.id = es."shiftId"
       WHERE s."organizationId" = $1
       GROUP BY s.id
       ORDER BY s."createdAt" DESC`,
      [orgId]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const createShift = async (req, res, next) => {
  const orgId = req.user.organization_uuid;
  const schema = Joi.object({
    name: Joi.string().required(),
    startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
    endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
    gracePeriod: Joi.number().integer().min(0).default(15),
    officeHours: Joi.number().min(0).default(8),
    isActive: Joi.boolean().default(true)
  });

  const { error, value } = schema.validate(req.body);
  if (error) return next(new BadRequestError(error.details[0].message));

  const { name, startTime, endTime, gracePeriod, officeHours, isActive } = value;

  try {
    const result = await pool.query(
      `INSERT INTO shift (name, "startTime", "endTime", "gracePeriod", "officeHours", "isActive", "organizationId")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, "startTime", "endTime", "gracePeriod", "officeHours", "isActive"`,
      [name, startTime, endTime, gracePeriod, officeHours, isActive, orgId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

const updateShift = async (req, res, next) => {
  const { id } = req.params;
  const orgId = req.user.organization_uuid;
  const { name, startTime, endTime, gracePeriod, officeHours, isActive } = req.body;

  try {
    const result = await pool.query(
      `UPDATE shift
       SET name = COALESCE($1, name),
           "startTime" = COALESCE($2, "startTime"),
           "endTime" = COALESCE($3, "endTime"),
           "gracePeriod" = COALESCE($4, "gracePeriod"),
           "officeHours" = COALESCE($5, "officeHours"),
           "isActive" = COALESCE($6, "isActive"),
           "updatedAt" = NOW()
       WHERE id = $7 AND "organizationId" = $8
       RETURNING id, name, "startTime", "endTime", "gracePeriod", "officeHours", "isActive"`,
      [name, startTime, endTime, gracePeriod, officeHours, isActive, id, orgId]
    );

    if (result.rowCount === 0) return next(new NotFoundError('Shift not found'));
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

// Assign shift to employee(s)
const assignShiftToEmployee = async (req, res, next) => {
  const { employeeId, employeeIds, shiftId } = req.body;
  const orgId = req.user.organization_uuid;

  const targetEmployeeIds = Array.isArray(employeeIds)
    ? employeeIds
    : (employeeId ? [employeeId] : []);

  if (targetEmployeeIds.length === 0) {
    return next(new BadRequestError('At least one employee must be selected'));
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify shift belongs to org
    const shiftCheck = await client.query(
      `SELECT id FROM shift WHERE id = $1 AND "organizationId" = $2`,
      [shiftId, orgId]
    );
    if (shiftCheck.rowCount === 0) throw new NotFoundError('Shift not found in organization');

    let assignedCount = 0;

    for (const empId of targetEmployeeIds) {
      // Verify employee belongs to org
      const employeeCheck = await client.query(
        `SELECT id FROM employee WHERE id = $1 AND "organiationId" = $2`,
        [empId, orgId]
      );

      if (employeeCheck.rowCount > 0) {
        const result = await client.query(
          `INSERT INTO employeeshift ("employeeId", "shiftId")
           VALUES ($1, $2)
           ON CONFLICT ("employeeId", "shiftId") DO NOTHING
           RETURNING id`,
          [empId, shiftId]
        );
        if (result.rowCount > 0) assignedCount++;
      }
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      message: assignedCount > 0
        ? `Successfully assigned shift to ${assignedCount} employee(s)`
        : 'Shift already assigned to selected employee(s)'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

const deleteShift = async (req, res, next) => {
  const { id } = req.params;
  const orgId = req.user.organization_uuid;

  try {
    const result = await pool.query(
      `DELETE FROM shift WHERE id = $1 AND "organizationId" = $2 RETURNING id`,
      [id, orgId]
    );

    if (result.rowCount === 0) return next(new NotFoundError('Shift not found'));
    res.json({ success: true, message: 'Shift deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOrganizationGeofence,
  setOrganizationGeofence,
  checkIn,
  checkOut,
  requestLeave,
  getMyLeaveRequests,
  getLeaveRequests,
  updateLeaveRequest,
  getAttendanceHistory,
  getMonthlySummary,
  getOrganizationAttendance,
  getShifts,
  createShift,
  updateShift,
  deleteShift,
  assignShiftToEmployee
};
