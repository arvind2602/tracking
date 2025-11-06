const pool = require('../../config/db');
const Joi = require('joi');
const { BadRequestError, NotFoundError } = require('../../utils/errors');
const { get } = require('./_route');


// Create Task
const createTask = async (req, res, next) => {
    const schema = Joi.object({
        description: Joi.string().required(),
        status: Joi.string().valid('pending', 'in-progress', 'completed').default('pending'),
        assignedTo: Joi.string().optional().allow('').empty(''),
        points: Joi.number().integer().min(1).required(),
        projectId: Joi.string().required()
    });

    const { error } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));

    const { description, status, assignedTo, points, projectId } = req.body;
    const createdBy = req.user.user_uuid;
    const organiationId = req.user.organization_uuid;

    try {
        // Verify project belongs to organization
        const projectCheck = await pool.query(
            'SELECT id FROM projects WHERE id = $1 AND "organiationId" = $2',
            [projectId, organiationId]
        );
        if (projectCheck.rowCount === 0) return next(new NotFoundError('Project not found'));

        const result = await pool.query(
            `INSERT INTO task (description, status, "createdBy", "assignedTo", points, "projectId", "assigned_at")
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             RETURNING id, description, status, "createdBy", "assignedTo", points, "projectId", "assigned_at"`,
            [description, status, createdBy, assignedTo, points, projectId]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) { next(error); }
};

// Get Task by ID
const getTask = async (req, res, next) => {
    const { id } = req.params;
    const organiationId = req.user.organization_uuid;

    try {
        const result = await pool.query(
            `SELECT t.* FROM task t
             JOIN projects p ON t."projectId" = p.id
             WHERE t.id = $1 AND p."organiationId" = $2`,
            [id, organiationId]
        );
        if (result.rowCount === 0) return next(new NotFoundError('Task not found'));
        res.json(result.rows[0]);
    } catch (error) { next(error); }
};



// Get all task for a particular emplyeee if the emplyee is ADMIN show all tasks and if the emplyee is USER show only assigned tasks
const getTaskByEmployee = async (req, res, next) => {
    const employeeId = req.user.user_uuid;
    const organiationId = req.user.organization_uuid;
    const isAdmin = req.user.role === 'ADMIN';
    try {
        let result;
        console.log("employeeId:", employeeId, "organiationId:", organiationId, "isAdmin:", isAdmin);
        if (isAdmin) {
            result = await pool.query(
                `SELECT t.* FROM task t
                    JOIN projects p ON t."projectId" = p.id
                    WHERE p."organiationId" = $1
                ORDER BY t."createdAt" DESC`,
                [organiationId]
            );
        } else {
            result = await pool.query(
                `SELECT t.* FROM task t
                    JOIN projects p ON t."projectId" = p.id
                    WHERE t."assignedTo" = $1 AND p."organiationId" = $2
                ORDER BY t."createdAt" DESC`,
                [employeeId, organiationId]
            );
        }
        res.json(result.rows);
    } catch (error) { next(error); }
};


// Get All Tasks in Project
const getTasksByProject = async (req, res, next) => {
    const { projectId } = req.params;
    const organiationId = req.user.organization_uuid;

    try {
        const result = await pool.query(
            `SELECT t.* FROM task t
             JOIN projects p ON t."projectId" = p.id
             WHERE p.id = $1 AND p."organiationId" = $2
             ORDER BY t."createdAt" DESC`,
            [projectId, organiationId]
        );
        res.json(result.rows);
    } catch (error) { next(error); }
};

// Update Task
const updateTask = async (req, res, next) => {
    const { id } = req.params;
    const { description, status, assignedTo, points } = req.body;
    const organiationId = req.user.organization_uuid;

    try {
        const result = await pool.query(
            `UPDATE task t SET
             description = COALESCE($1, t.description),
             status = COALESCE($2, t.status),
             "assignedTo" = COALESCE($3, t."assignedTo"),
             points = COALESCE($4, t.points),
             "assigned_at" = CASE WHEN $3 IS NOT NULL THEN NOW() ELSE t."assigned_at" END,
             "updatedAt" = NOW()
             FROM projects p
             WHERE t.id = $5 AND t."projectId" = p.id AND p."organiationId" = $6
             RETURNING t.*`,
            [description, status, assignedTo, points, id, organiationId]
        );
        if (result.rowCount === 0) return next(new NotFoundError('Task not found'));
        res.json(result.rows[0]);
    } catch (error) { next(error); }
};

// Delete Task
// task/task.js (fixed deleteTask)
const deleteTask = async (req, res, next) => {
  const { id } = req.params;
  const organiationId = req.user.organization_uuid;

  try {
    // Start transaction
    await pool.query('BEGIN');

    // Delete comments first
    await pool.query(
      `DELETE FROM comment c 
       USING task t, projects p 
       WHERE c."taskId" = t.id 
         AND t.id = $1 
         AND t."projectId" = p.id 
         AND p."organiationId" = $2`,
      [id, organiationId]
    );

    // Now delete task
    const result = await pool.query(
      `DELETE FROM task t 
       USING projects p 
       WHERE t.id = $1 
         AND t."projectId" = p.id 
         AND p."organiationId" = $2 
       RETURNING t.id`,
      [id, organiationId]
    );

    if (result.rowCount === 0) {
      await pool.query('ROLLBACK');
      return next(new NotFoundError('Task not found'));
    }

    await pool.query('COMMIT');
    res.json({ message: 'Task and comments deleted' });
  } catch (error) {
    await pool.query('ROLLBACK');
    next(error);
  }
};

const createComment = async (req, res, next) => {
    const { taskId } = req.params;
    const { content } = req.body;
    const authorId = req.user.user_uuid;
const organizationId = req.user.organization_uuid;

    try {
        const result = await pool.query(
            `INSERT INTO comment (content, "taskId", "authorId")
             SELECT $1, $2, $3
             FROM task t
             JOIN projects p ON t."projectId" = p.id
WHERE t.id = $2 AND p."organiationId" = $4
             RETURNING id, content, "authorId", "createdAt"`,
            [content, taskId, authorId, organizationId]
        );
        if (result.rowCount === 0) return next(new NotFoundError('Task not found'));
        res.status(201).json(result.rows[0]);
    } catch (error) { next(error); }
};

// Get comments for a task
const getCommentsByTask = async (req, res, next) => {
  const { taskId } = req.params;
  const organiationId = req.user.organization_uuid;

  try {
    const result = await pool.query(
      `SELECT 
         c.id, 
         c.content, 
         c."createdAt",
         e."firstName" || ' ' || e."lastName" AS "userName"
       FROM comment c
       JOIN task t ON c."taskId" = t.id
       JOIN projects p ON t."projectId" = p.id
       JOIN employee e ON c."authorId" = e.id
       WHERE t.id = $1 AND p."organiationId" = $2
       ORDER BY c."createdAt" DESC`,
      [taskId, organiationId]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

// Chnage the status of the task
const changeTaskStatus = async (req, res, next) => {
    const { id } = req.params;
    const { status } = req.body;
    const organiationId = req.user.organization_uuid;
    try {
        const result = await pool.query(
            `UPDATE task t SET
                status = $1,
                "updatedAt" = NOW()
                FROM projects p
                WHERE t.id = $2 AND t."projectId" = p.id AND p."organiationId" = $3
                RETURNING t.*`,
            [status, id, organiationId]
        );
        if (result.rowCount === 0) return next(new NotFoundError('Task not found'));
        res.json(result.rows[0]);
    }
    catch (error) { next(error); }
};


// Assign task 
const assignTask = async (req, res, next) => {
    const { id } = req.params;
    const { assignedTo } = req.body;
    const organiationId = req.user.organization_uuid;
    try {
        const result = await pool.query(
            `UPDATE task t SET
                "assignedTo" = $1,
                "assigned_at" = NOW(),
                "updatedAt" = NOW()
                FROM projects p
                WHERE t.id = $2 AND t."projectId" = p.id AND p."organiationId" = $3
                RETURNING t.*`,
            [assignedTo, id, organiationId]
        );
        if (result.rowCount === 0) return next(new NotFoundError('Task not found'));
        res.json(result.rows[0]);
    }
    catch (error) { next(error); }
};


const    getTasksPerEmployee = async (req, res, next) => {
  try {
    const userId = req.user.user_uuid; // from JWT

    const result = await pool.query(`
      SELECT 
        t.id,
        t.description,
        t.status,
        t.points,
        t."assigned_at" AS "assignedAt",
        t."updatedAt",
        p.name AS "projectName",
        e."firstName" || ' ' || e."lastName" AS "createdBy"
      FROM task t
      JOIN projects p ON t."projectId" = p.id
      JOIN employee e ON t."createdBy"::uuid = e.id
      WHERE t."assignedTo" = $1::text
        AND p."organiationId" = $2::uuid
      ORDER BY t."assigned_at" DESC NULLS LAST, t."updatedAt" DESC
    `, [userId, req.user.organization_uuid]);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};



module.exports = {
    createTask,
    getTask,
    getTasksByProject,
    updateTask,
    deleteTask,
    createComment,
    getTaskByEmployee,
    assignTask,
    getCommentsByTask,
    changeTaskStatus,
    getTasksPerEmployee
};