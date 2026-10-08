const Joi = require('joi');
const { pool } = require('../../config/db');
const { BadRequestError, NotFoundError } = require('../../utils/errors');
const push = require('../../utils/pushNotifications');
const logger = require('../../utils/logger');

const fmtDate = (d) => {
  try { return new Date(d).toISOString().slice(0, 10); } catch (_) { return String(d); }
};

const notifyLeave = (recipients, message) => {
  try { push.sendToEmployeeIds(recipients, message); } catch (err) { logger.warn(`leave push hook failed: ${err.message}`); }
};

/** Runs a fire-and-forget push hook, logging (never throwing) on failure. */
const runPushHook = (label, fn) => {
  Promise.resolve()
    .then(fn)
    .catch((err) => logger.warn(`${label} push hook failed: ${err.message}`));
};

/**
 * Apply for leave
 */
const applyLeave = async (req, res, next) => {
  const { user_uuid, organization_uuid } = req.user;
  
  const schema = Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().required(),
    type: Joi.string().required(),
    reason: Joi.string().required(),
    createdAt: Joi.date().iso().optional()
  });

  const { error } = schema.validate(req.body);
  if (error) return next(new BadRequestError(error.details[0].message));

  const { startDate, endDate, type, reason, createdAt } = req.body;

  try {
    const createTime = createdAt ? new Date(createdAt) : new Date();
    const result = await pool.query(
      `INSERT INTO "leave" ("employeeId", "organizationId", "startDate", "endDate", type, reason, status, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7::timestamp)
       RETURNING id, "startDate", "endDate", type, reason, status, "createdAt"`,
      [user_uuid, organization_uuid, startDate, endDate, type, reason, createTime]
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Leave application submitted successfully'
    });

    // Notify org admins about the new leave request (fire-and-forget)
    runPushHook('applyLeave', async () => {
      const [me, admins] = await Promise.all([
        pool.query(`SELECT "firstName", "lastName" FROM employee WHERE id = $1`, [user_uuid]),
        pool.query(
          `SELECT id FROM employee WHERE "organiationId" = $1 AND role = 'ADMIN' AND is_archived = false AND id <> $2`,
          [organization_uuid, user_uuid]
        ),
      ]);
      const name = me.rowCount > 0
        ? `${me.rows[0].firstName || ''} ${me.rows[0].lastName || ''}`.trim() || 'Someone'
        : 'Someone';
      const adminIds = admins.rows.map((r) => r.id);
      notifyLeave(adminIds, push.buildMessage({
        title: 'Leave request submitted',
        body: `${name} applied for ${type} leave (${fmtDate(startDate)} to ${fmtDate(endDate)})`,
        link: '/dashboard/attendance',
        type: 'leave_applied',
      }));
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get leave history (for employee)
 */
const getMyLeaves = async (req, res, next) => {
  const { user_uuid } = req.user;

  try {
    const result = await pool.query(
      `SELECT id, "startDate", "endDate", type, reason, status, "adminNote", "createdAt"
       FROM "leave"
       WHERE "employeeId" = $1
       ORDER BY "createdAt" DESC
       LIMIT 500`,
      [user_uuid]
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

/**
 * Get all leave requests (for admin)
 */
const getOrgLeaves = async (req, res, next) => {
  const { organization_uuid } = req.user;

  try {
    const result = await pool.query(
      `SELECT l.id, l."startDate", l."endDate", l.type, l.reason, l.status, l."adminNote", l."createdAt",
              e."firstName", e."lastName", e.email, e.position
       FROM "leave" l
       JOIN employee e ON l."employeeId" = e.id
       WHERE l."organizationId" = $1
       ORDER BY l."createdAt" DESC
       LIMIT 1000`,
      [organization_uuid]
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

/**
 * Approve or reject leave
 */
const updateLeaveStatus = async (req, res, next) => {
  const { organization_uuid } = req.user;
  const { id } = req.params;
  const { status, adminNote } = req.body;

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return next(new BadRequestError('Invalid status. Must be APPROVED or REJECTED.'));
  }

  try {
    const updateTime = req.body.updatedAt ? new Date(req.body.updatedAt) : new Date();
    const result = await pool.query(
      `UPDATE "leave"
       SET status = $1, "adminNote" = $2, "updatedAt" = $3::timestamp
       WHERE id = $4 AND "organizationId" = $5
       RETURNING id, status`,
      [status, adminNote || null, updateTime, id, organization_uuid]
    );

    if (result.rowCount === 0) {
      return next(new NotFoundError('Leave request not found'));
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: `Leave request ${status.toLowerCase()} successfully`
    });

    // Notify the applicant about the decision (fire-and-forget)
    runPushHook('updateLeaveStatus', async () => {
      const applicant = await pool.query(
        `SELECT l."employeeId", l.type, l."startDate", l."endDate", e."firstName", e."lastName"
           FROM "leave" l
           JOIN employee e ON e.id = l."employeeId"
          WHERE l.id = $1 AND l."organizationId" = $2`,
        [id, organization_uuid]
      );
      if (applicant.rowCount > 0) {
        const a = applicant.rows[0];
        const name = `${a.firstName || ''} ${a.lastName || ''}`.trim();
        notifyLeave([a.employeeId], push.buildMessage({
          title: `Leave request ${status.toLowerCase()}`,
          body: `${name ? `${name}: ` : ''}your ${a.type} leave (${fmtDate(a.startDate)} to ${fmtDate(a.endDate)}) was ${status.toLowerCase()}`,
          link: '/dashboard/attendance',
          type: 'leave_status',
        }));
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  applyLeave,
  getMyLeaves,
  getOrgLeaves,
  updateLeaveStatus
};
