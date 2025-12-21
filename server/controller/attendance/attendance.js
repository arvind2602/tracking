const pool = require('../../config/db');
const { BadRequestError, UnprocessableEntityError, NotFoundError } = require('../../utils/errors');
const Joi = require('joi');

// Mock Office Location (Update with actual coordinates)
// For now, using a placeholder. In real app, store in DB or config.
const OFFICE_LAT = 19.212356568539846;
const OFFICE_LNG = 72.8597260;
const MAX_DISTANCE_KM = 0.05; // 50 meters (accounts for GPS inaccuracy)

// Use explicit UTC timestamp to avoid server timezone issues
const UTC_NOW = "(NOW() AT TIME ZONE 'UTC')";

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);  // deg2rad below
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180)
}

const checkIn = async (req, res, next) => {
    const schema = Joi.object({
        latitude: Joi.number().required(),
        longitude: Joi.number().required(),
        deviceId: Joi.string().required(),
        deviceType: Joi.string().optional()
    });

    const { error } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));

    const { latitude, longitude, deviceId, deviceType } = req.body;
    const employeeId = req.user.user_uuid; // Assumes auth middleware populates req.user

    // 1. Geo-fencing
    const distance = getDistanceFromLatLonInKm(OFFICE_LAT, OFFICE_LNG, latitude, longitude);
    if (distance > MAX_DISTANCE_KM) {
        return next(new UnprocessableEntityError('You are too far from the office to check in.'));
    }

    try {
        // 2. Check for active session
        const activeSession = await pool.query(
            'SELECT id FROM "TimeLog" WHERE "employeeId" = $1 AND "checkOut" IS NULL',
            [employeeId]
        );

        if (activeSession.rowCount > 0) {
            return next(new UnprocessableEntityError('You are already checked in.'));
        }

        // 3. Device Check
        const empResult = await pool.query(
            'SELECT "lastDeviceId" FROM employee WHERE id = $1',
            [employeeId]
        );

        let alertMessage = null;
        if (empResult.rowCount > 0) {
            const lastDevice = empResult.rows[0].lastDeviceId;
            if (lastDevice && lastDevice !== deviceId) {
                alertMessage = "New device detected. Admin has been notified.";
                // In a real app, send email/notification to admin here.
            }
        }

        // Update lastDeviceId
        await pool.query(
            'UPDATE employee SET "lastDeviceId" = $1 WHERE id = $2',
            [deviceId, employeeId]
        );

        // 4. Create Log
        const logResult = await pool.query(
            `INSERT INTO "TimeLog" ("employeeId", "checkIn", "type", "latitude", "longitude", "deviceId", "deviceType")
             VALUES ($1, (NOW() AT TIME ZONE 'UTC'), 'WORK', $2, $3, $4, $5)
             RETURNING *`,
            [employeeId, latitude, longitude, deviceId, deviceType]
        );

        res.status(201).json({
            message: 'Checked in successfully',
            log: logResult.rows[0],
            alert: alertMessage
        });

    } catch (err) {
        next(err);
    }
};

const checkOut = async (req, res, next) => {
    const schema = Joi.object({
        reason: Joi.string().optional(),
        type: Joi.string().valid('WORK', 'LUNCH', 'BREAK', 'WASHROOM', 'PERSONAL_EMERGENCY', 'HOME', 'OTHER').default('WORK'),
        latitude: Joi.number().optional(),
        longitude: Joi.number().optional()
    });

    const { error } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));

    const { reason, type, latitude, longitude } = req.body;
    const employeeId = req.user.user_uuid;

    try {
        // Find latest active session
        const activeSession = await pool.query(
            'SELECT id FROM "TimeLog" WHERE "employeeId" = $1 AND "checkOut" IS NULL ORDER BY "checkIn" DESC LIMIT 1',
            [employeeId]
        );

        if (activeSession.rowCount === 0) {
            return next(new UnprocessableEntityError('You are not checked in.'));
        }

        const logId = activeSession.rows[0].id;

        // Update
        const result = await pool.query(
            `UPDATE "TimeLog" 
             SET "checkOut" = (NOW() AT TIME ZONE 'UTC'), "reason" = $1, "type" = $2
             WHERE id = $3
             RETURNING *`,
            [reason, type, logId]
        );

        res.json({
            message: 'Checked out successfully',
            log: result.rows[0]
        });

    } catch (err) {
        next(err);
    }
};

const getLogs = async (req, res, next) => {
    const { user_uuid, role } = req.user;
    const { scope } = req.query;

    try {
        let query;
        let params;

        if (role === 'ADMIN' && scope !== 'personal') {
            query = `
                SELECT t.*, e."firstName", e."lastName", e.email 
                FROM "TimeLog" t
                JOIN employee e ON t."employeeId" = e.id
                ORDER BY t."checkIn" DESC 
                LIMIT 100
            `;
            params = [];
        } else {
            query = `
                SELECT t.*, e."firstName", e."lastName", e.email 
                FROM "TimeLog" t
                JOIN employee e ON t."employeeId" = e.id
                WHERE t."employeeId" = $1 
                ORDER BY t."checkIn" DESC 
                LIMIT 50
            `;
            params = [user_uuid];
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
};

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

/**
 * Process a scanned QR code (Site QR)
 * Validates token, checks location, creates TimeLog
 */
const scanQR = async (req, res, next) => {
    const schema = Joi.object({
        qrToken: Joi.string().required(),
        latitude: Joi.number().required(),
        longitude: Joi.number().required(),
        deviceId: Joi.string().required(),
        deviceType: Joi.string().optional(),
        activityType: Joi.string().valid('WORK', 'LUNCH', 'BREAK', 'WASHROOM', 'PERSONAL_EMERGENCY', 'HOME', 'OTHER').default('WORK')
    });

    const { error } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));

    const { qrToken, latitude, longitude, deviceId, deviceType, activityType } = req.body;
    const employeeId = req.user.user_uuid;

    try {
        // 1. Decode and verify token
        let decoded;
        try {
            decoded = jwt.verify(qrToken, JWT_SECRET);
        } catch (err) {
            return next(new BadRequestError('Invalid or expired QR code.'));
        }

        // 2. Validate token type
        if (decoded.type !== 'SITE_QR') {
            return next(new BadRequestError('Invalid QR code type.'));
        }

        // 3. Geo-fencing against site location
        const distance = getDistanceFromLatLonInKm(decoded.lat, decoded.lng, latitude, longitude);
        if (distance > MAX_DISTANCE_KM) {
            return next(new UnprocessableEntityError(`You are too far from ${decoded.siteName}. Please get closer to the site.`));
        }

        // 4. Check for active session
        const activeSession = await pool.query(
            'SELECT id FROM "TimeLog" WHERE "employeeId" = $1 AND "checkOut" IS NULL',
            [employeeId]
        );

        if (activeSession.rowCount > 0) {
            return next(new UnprocessableEntityError('You are already checked in. Please check out first.'));
        }

        // 5. Device Check (optional alert)
        const empResult = await pool.query(
            'SELECT "lastDeviceId" FROM employee WHERE id = $1',
            [employeeId]
        );

        let alertMessage = null;
        if (empResult.rowCount > 0) {
            const lastDevice = empResult.rows[0].lastDeviceId;
            if (lastDevice && lastDevice !== deviceId) {
                alertMessage = "New device detected. Admin has been notified.";
            }
        }

        // Update lastDeviceId
        await pool.query(
            'UPDATE employee SET "lastDeviceId" = $1 WHERE id = $2',
            [deviceId, employeeId]
        );

        // 6. Create TimeLog with site reference in reason
        const logResult = await pool.query(
            `INSERT INTO "TimeLog" ("employeeId", "checkIn", "type", "latitude", "longitude", "deviceId", "deviceType", "reason")
             VALUES ($1, (NOW() AT TIME ZONE 'UTC'), $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [employeeId, activityType, latitude, longitude, deviceId, deviceType, `Site: ${decoded.siteName}`]
        );

        res.status(201).json({
            message: `Checked in at ${decoded.siteName}`,
            log: logResult.rows[0],
            site: decoded.siteName,
            alert: alertMessage
        });

    } catch (err) {
        next(err);
    }
};

module.exports = { checkIn, checkOut, getLogs, scanQR };
