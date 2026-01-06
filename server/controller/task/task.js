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
    points: Joi.number().min(0).required(),
    projectId: Joi.string().required(),
    priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH').default('MEDIUM'),
    dueDate: Joi.date().optional().allow(null),
    parentId: Joi.string().optional().allow(null)
  });

  const { error } = schema.validate(req.body);
  if (error) return next(new BadRequestError(error.details[0].message));

  const { description, status, assignedTo, points, projectId, priority, dueDate } = req.body;
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
      `INSERT INTO task (description, status, "createdBy", "assignedTo", points, "projectId", "assigned_at", priority, "dueDate", "parentId")
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9)
             RETURNING id, description, status, "createdBy", "assignedTo", points, "projectId", "assigned_at", priority, "dueDate", "parentId"`,
      [description, status, createdBy, assignedTo, points, projectId, priority, dueDate, req.body.parentId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
};

// Export Tasks
const exportTasks = async (req, res, next) => {
  const organiationId = req.user.organization_uuid;
  try {
    const result = await pool.query(`
            SELECT 
                t.id, 
                t.description, 
                t.status, 
                t.points, 
                t.priority,
                t."dueDate",
                p.name as "projectName",
                COALESCE(e."firstName" || ' ' || e."lastName", 'Unassigned') as "assignedName"
            FROM task t
            JOIN projects p ON t."projectId" = p.id
            LEFT JOIN employee e ON t."assignedTo"::uuid = e.id
            WHERE p."organiationId" = $1
            ORDER BY t."createdAt" DESC
        `, [organiationId]);

    const tasks = result.rows;

    // Convert to CSV
    const header = ['ID', 'Description', 'Status', 'Points', 'Priority', 'Due Date', 'Project', 'Assigned To'];
    const csvRows = [header.join(',')];

    tasks.forEach(task => {
      const row = [
        task.id,
        `"${(task.description || '').replace(/"/g, '""')}"`,
        task.status,
        task.points,
        task.priority,
        task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
        `"${(task.projectName || '').replace(/"/g, '""')}"`,
        `"${(task.assignedName || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="tasks_export.csv"');
    res.send(csvContent);

  } catch (error) {
    next(error);
  }
};

// Get Task by ID
const getTask = async (req, res, next) => {
  const { id } = req.params;
  const organiationId = req.user.organization_uuid;

  try {
    try {
      // Fetch the main task
      const taskResult = await pool.query(
        `SELECT t.* FROM task t
             JOIN projects p ON t."projectId" = p.id
             WHERE t.id = $1 AND p."organiationId" = $2`,
        [id, organiationId]
      );
      if (taskResult.rowCount === 0) return next(new NotFoundError('Task not found'));

      const task = taskResult.rows[0];

      // Fetch subtasks for this task
      const subResult = await pool.query(
        `SELECT t.*, e."firstName" as "creatorFirstName", e."lastName" as "creatorLastName"
         FROM task t
         LEFT JOIN employee e ON t."createdBy"::uuid = e.id
         WHERE t."parentId" = $1
         ORDER BY t."order" ASC, t."createdAt" ASC`,
        [id]
      );
      task.subtasks = subResult.rows;

      res.json(task);
    } catch (error) { next(error); }
  } catch (error) { next(error); }
};



// Get all task for a particular emplyeee if the emplyee is ADMIN show all tasks and if the emplyee is USER show only assigned tasks
const getTaskByEmployee = async (req, res, next) => {
  const employeeId = req.user.user_uuid;
  const organiationId = req.user.organization_uuid;
  const isAdmin = req.user.role === 'ADMIN';
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { status, projectId, assignedTo, date } = req.query;

    let result;
    let totalCount;
    let stats;

    // 1. Base Conditions (Organization/Role)
    let contextWhere = "";
    let contextParams = [];

    if (isAdmin) {
      contextWhere = 'WHERE p."organiationId" = $1';
      contextParams = [organiationId];
    } else {
      contextWhere = 'WHERE t."assignedTo" = $1 AND p."organiationId" = $2';
      contextParams = [employeeId, organiationId];
    }

    // 2. Apply Context Filters (Project, User, Date) - These affect Stats AND Table
    let paramIdx = contextParams.length + 1;

    // Filter to only show root tasks (parentId IS NULL) in the main list
    contextWhere += ` AND t."parentId" IS NULL`;

    if (projectId && projectId !== 'all') {
      contextWhere += ` AND t."projectId" = $${paramIdx}`;
      contextParams.push(projectId);
      paramIdx++;
    }

    // Allow filtering by user (For Admin, or strictly speaking for anyone but User role is already limited. 
    // If User tries to filter by 'me' it works. If 'other', it returns 0. Consistent.)
    if (assignedTo && assignedTo !== 'all') {
      contextWhere += ` AND t."assignedTo" = $${paramIdx}`;
      contextParams.push(assignedTo);
      paramIdx++;
    }

    if (date) {
      if (date === 'today') {
        contextWhere += ` AND t."assigned_at"::date = CURRENT_DATE`;
      } else if (date === 'week') {
        contextWhere += ` AND t."assigned_at" >= CURRENT_DATE - INTERVAL '7 days'`;
      } else if (date === 'overdue') {
        contextWhere += ` AND t."dueDate" < CURRENT_DATE AND t.status != 'completed'`;
      }
    }

    // 3. Get Stats (Using Context Filters, IGNORING Status Filter)
    // This ensures that when you click "Pending", the "Completed" card still shows the count of completed tasks in the current Project/Date view.
    // 3. Get Stats (Using Context Filters, IGNORING Status Filter)
    // This ensures that when you click "Pending", the "Completed" card still shows the count of completed tasks in the current Project/Date view.
    const statsResult = await pool.query(
      `SELECT
         COUNT(*) as "totalTasks",
         COUNT(*) FILTER (WHERE t.status = 'completed') as "completedCount",
         COUNT(*) FILTER (WHERE t.status = 'pending') as "pendingCount",
         COUNT(*) FILTER (WHERE t.status = 'in-progress') as "inProgressCount",
         COALESCE(SUM(t.points) FILTER (WHERE t.status = 'completed' AND t."updatedAt"::date = CURRENT_DATE), 0) as "pointsToday"
       FROM task t
       JOIN projects p ON t."projectId" = p.id
       ${contextWhere}`,
      contextParams
    );
    stats = statsResult.rows[0];

    // 4. Determine Total Count based on Status Filter (Optimization: Avoid extra Count Query)
    if (!status || status === 'all') {
      totalCount = parseInt(stats.totalTasks);
    } else if (status === 'pending') {
      totalCount = parseInt(stats.pendingCount);
    } else if (status === 'in-progress') {
      totalCount = parseInt(stats.inProgressCount);
    } else if (status === 'completed') {
      totalCount = parseInt(stats.completedCount);
    } else {
      totalCount = 0;
    }

    // 5. Get Data (Filtered by Status + Paginated)
    let mainWhere = contextWhere;
    let mainParams = [...contextParams];
    // paramIdx is already incremented for contextParams. 

    if (status && status !== 'all') {
      mainWhere += ` AND t.status = $${paramIdx}`;
      mainParams.push(status);
      paramIdx++;
    }

    const pagingParams = [...mainParams, limit, offset];
    // paramIdx is now mainParams.length + 1

    console.log('Main Where:', mainWhere);
    console.log('Paging Params:', pagingParams);
    console.log('Limit Index:', paramIdx, 'Offset Index:', paramIdx + 1);

    result = await pool.query(
      `SELECT t.*, e."firstName" as "creatorFirstName", e."lastName" as "creatorLastName"
       FROM task t
       JOIN projects p ON t."projectId" = p.id
       LEFT JOIN employee e ON t."createdBy"::uuid = e.id
       ${mainWhere}
       ORDER BY t."order" ASC, t."createdAt" DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      pagingParams
    );

    const tasks = result.rows;

    if (tasks.length > 0) {
      const taskIds = tasks.map(t => t.id);
      const subtasksResult = await pool.query(
        `SELECT t.*, e."firstName" as "creatorFirstName", e."lastName" as "creatorLastName"
         FROM task t
         LEFT JOIN employee e ON t."createdBy"::uuid = e.id
         WHERE t."parentId" = ANY($1::uuid[])
         ORDER BY t."order" ASC, t."createdAt" ASC`,
        [taskIds]
      );

      const subtasks = subtasksResult.rows;

      tasks.forEach(task => {
        task.subtasks = subtasks.filter(st => st.parentId === task.id);
      });
    }

    res.json({
      tasks: tasks,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      },
      stats: {
        totalTasks: parseInt(stats.totalTasks),
        pendingTasks: parseInt(stats.pendingCount),
        inProgressTasks: parseInt(stats.inProgressCount),
        completedTasks: parseInt(stats.completedCount),
        pointsToday: parseFloat(stats.pointsToday) || 0
      }
    });

  } catch (error) { next(error); }
};


// Get All Tasks in Project
const getTasksByProject = async (req, res, next) => {
  const { projectId } = req.params;
  const organiationId = req.user.organization_uuid;

  try {
    const result = await pool.query(
      `SELECT t.*, e."firstName" as "creatorFirstName", e."lastName" as "creatorLastName"
       FROM task t
       JOIN projects p ON t."projectId" = p.id
       LEFT JOIN employee e ON t."createdBy"::uuid = e.id
       WHERE p.id = $1 AND p."organiationId" = $2
       ORDER BY t."order" ASC, t."createdAt" DESC`,
      [projectId, organiationId]
    );
    res.json(result.rows);
  } catch (error) { next(error); }
};

// Update Task
const updateTask = async (req, res, next) => {
  const { id } = req.params;
  const { description, status, assignedTo, points, priority, dueDate, completedAt } = req.body;
  const organiationId = req.user.organization_uuid;

  try {
    const result = await pool.query(
      `UPDATE task t SET
             description = COALESCE($1, t.description),
             status = COALESCE($2, t.status),
             "assignedTo" = COALESCE($3, t."assignedTo"),
             points = COALESCE($4, t.points),
             priority = COALESCE($5, t.priority),
             "dueDate" = COALESCE($6, t."dueDate"),
             "assigned_at" = CASE WHEN $3 IS NOT NULL THEN NOW() ELSE t."assigned_at" END,
             "completedAt" = COALESCE($9, CASE 
                WHEN $2::text IS NOT NULL AND LOWER($2) IN ('done', 'completed') THEN NOW()
                WHEN $2::text IS NOT NULL AND LOWER($2) NOT IN ('done', 'completed') THEN NULL
                ELSE t."completedAt"
             END),
             "updatedAt" = NOW()
             FROM projects p
             WHERE t.id = $7 AND t."projectId" = p.id AND p."organiationId" = $8
             RETURNING t.*`,
      [description, status, assignedTo, points, priority, dueDate, id, organiationId, completedAt]
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

    // Unlink subtasks (or delete them? Let's delete them for now to avoid orphans)
    // First delete comments of subtasks
    await pool.query(
      `DELETE FROM comment c
       USING task t, projects p
       WHERE c."taskId" = t.id
       AND t."parentId" = $1
       AND t."projectId" = p.id
       AND p."organiationId" = $2`,
      [id, organiationId]
    );

    // Delete subtasks
    await pool.query(
      `DELETE FROM task t
       USING projects p
       WHERE t."parentId" = $1
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
                "completedAt" = CASE 
                   WHEN LOWER($1) IN ('done', 'completed') THEN NOW() 
                   ELSE NULL 
                END,
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


const getTasksPerEmployee = async (req, res, next) => {
  try {
    const userId = req.params.id;
    console.log("Getting tasks for user:", userId);
    const result = await pool.query(`
      SELECT t.*, e."firstName" as "creatorFirstName", e."lastName" as "creatorLastName"
      from task t
      LEFT JOIN employee e ON t."createdBy"::uuid = e.id
      where t."assignedTo" = $1 
    `, [userId]);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const reorderTasks = async (req, res, next) => {
  const { tasks } = req.body; // Array of { id, order }
  const organiationId = req.user.organization_uuid;

  try {
    await pool.query('BEGIN');
    for (const task of tasks) {
      await pool.query(
        `UPDATE task t SET "order" = $1, "updatedAt" = NOW()
         FROM projects p
         WHERE t.id = $2 AND t."projectId" = p.id AND p."organiationId" = $3`,
        [task.order, task.id, organiationId]
      );
    }
    await pool.query('COMMIT');
    res.json({ message: 'Tasks reordered' });
  } catch (error) {
    await pool.query('ROLLBACK');
    next(error);
  }
};

module.exports = {
  createTask,
  exportTasks,
  getTask,
  getTasksByProject,
  updateTask,
  deleteTask,
  createComment,
  getTaskByEmployee,
  assignTask,
  getCommentsByTask,
  changeTaskStatus,
  getTasksPerEmployee,
  reorderTasks
};