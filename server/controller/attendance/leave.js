const Joi = require('joi');
const { pool } = require('../../config/db');
const { BadRequestError, NotFoundError } = require('../../utils/errors');

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
       ORDER BY "createdAt" DESC`,
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
       ORDER BY l."createdAt" DESC`,
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
