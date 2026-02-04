const pool = require('../../config/db');
const Joi = require('joi');
const { BadRequestError, NotFoundError } = require('../../utils/errors');
const { get } = require('./_route');


// Create Task
const createTask = async (req, res, next) => {
  const schema = Joi.object({
    description: Joi.string().required(),
    status: Joi.string().valid('pending', 'in-progress', 'completed', 'pending-review').default('pending'),
    assignedTo: Joi.string().optional().allow('').empty(''),
    points: Joi.number().min(0).required(),
    projectId: Joi.string().required(),
    priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH').default('MEDIUM'),
    dueDate: Joi.date().optional().allow(null),
    parentId: Joi.string().optional().allow(null),
    type: Joi.string().valid('SINGLE', 'SHARED', 'SEQUENTIAL').default('SINGLE'),
    assignees: Joi.array().items(Joi.string().uuid()).optional()
  });

  const { error } = schema.validate(req.body);
  if (error) return next(new BadRequestError(error.details[0].message));

  const { description, status, assignedTo, points, projectId, priority, dueDate, type, assignees, parentId } = req.body;
  const createdBy = req.user.user_uuid;
  const organiationId = req.user.organization_uuid;

  // Auto-assign to self if creator is a regular USER and no assignee specified (Legacy behavior for SINGLE)
  let finalAssignedTo = assignedTo;
  if (req.user.role === 'USER' && !assignedTo && (!assignees || assignees.length === 0)) {
    finalAssignedTo = createdBy;
  }

  // For Sequential, valid initial assignee is the first one in the list
  if (type === 'SEQUENTIAL' && assignees && assignees.length > 0) {
    finalAssignedTo = assignees[0];
  }

  try {
    // Verify project belongs to organization
    const projectCheck = await pool.query(
      'SELECT id FROM projects WHERE id = $1 AND "organiationId" = $2',
      [projectId, organiationId]
    );
    if (projectCheck.rowCount === 0) return next(new NotFoundError('Project not found'));

    // Start Transaction
    await pool.query('BEGIN');

    const result = await pool.query(
      `INSERT INTO task (description, status, "createdBy", "assignedTo", points, "projectId", "assigned_at", priority, "dueDate", "parentId", "type")
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, $10)
             RETURNING *`,
      [description, status, createdBy, finalAssignedTo, points, projectId, priority, dueDate, parentId, type]
    );
    const task = result.rows[0];

    // Create TaskAssignee records if applicable
    if ((type === 'SHARED' || type === 'SEQUENTIAL') && assignees && assignees.length > 0) {
      let order = 1;
      for (const assigneeId of assignees) {
        await pool.query(
          `INSERT INTO "TaskAssignee" ("taskId", "employeeId", "order", "isCompleted", "assignedAt")
                 VALUES ($1, $2, $3, $4, NOW())`,
          [task.id, assigneeId, type === 'SEQUENTIAL' ? order++ : null, false]
        );
      }
    } else if (finalAssignedTo) {
      // Even for Single task, let's try to populate TaskAssignee for consistency if we want, 
      // OR just leave it as is for legacy. 
      // Let's populate it to enable future migration/consistency.
      await pool.query(
        `INSERT INTO "TaskAssignee" ("taskId", "employeeId", "order", "isCompleted", "assignedAt")
             VALUES ($1, $2, $3, $4, NOW())`,
        [task.id, finalAssignedTo, 1, false]
      );
    }

    await pool.query('COMMIT');
    res.status(201).json(task);
  } catch (error) {
    await pool.query('ROLLBACK');
    next(error);
  }
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

      task.subtasks = subResult.rows;

      // Fetch assignees for this task
      const assigneeResult = await pool.query(
        `SELECT ta.*, e."firstName", e."lastName", e.email
         FROM "TaskAssignee" ta
         JOIN employee e ON ta."employeeId" = e.id
         WHERE ta."taskId" = $1
         ORDER BY ta."order" ASC`,
        [id]
      );
      task.assignees = assigneeResult.rows;

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

    const { status, projectId, assignedTo, date, sortBy, sortOrder } = req.query;

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
      // Show if:
      // 1. Assigned directly (t."assignedTo" = $1)
      // 2. Created by me (t."createdBy" = $1) - vital for reviewing tasks assigned to others
      // 3. In assignees list for Shared/Sequential
      contextWhere = `WHERE (t."assignedTo" = $1 OR t."createdBy" = $1 OR ((t.type = 'SHARED' OR t.type = 'SEQUENTIAL') AND EXISTS (SELECT 1 FROM "TaskAssignee" ta WHERE ta."taskId" = t.id AND ta."employeeId" = $1::uuid))) AND p."organiationId" = $2`;
      contextParams = [employeeId, organiationId];
    }

    // 2. Apply Context Filters (Project, User, Date) - These affect Stats AND Table
    let paramIdx = contextParams.length + 1;

    // NOTE: We do NOT filter parentId IS NULL here anymore. 
    // Stats (Cards) should include subtasks. Main List will explicitly filter for roots.

    if (projectId && projectId !== 'all') {
      contextWhere += ` AND t."projectId" = $${paramIdx}`;
      contextParams.push(projectId);
      paramIdx++;
    }

    // Allow filtering by user (For Admin, or strictly speaking for anyone but User role is already limited. 
    // If User tries to filter by 'me' it works. If 'other', it returns 0. Consistent.)
    if (assignedTo && assignedTo !== 'all') {
      contextWhere += ` AND (t."assignedTo" = $${paramIdx} OR EXISTS (SELECT 1 FROM "TaskAssignee" ta WHERE ta."taskId" = t.id AND ta."employeeId" = $${paramIdx}::uuid))`;
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
    const statsResult = await pool.query(
      `SELECT
         -- Global Stats (Including Subtasks)
         COUNT(*) as "totalTasks",
         COUNT(*) FILTER (WHERE t.status = 'completed') as "completedCount",
         COUNT(*) FILTER (WHERE t.status = 'pending') as "pendingCount",
         COUNT(*) FILTER (WHERE t.status = 'in-progress') as "inProgressCount",
         COUNT(*) FILTER (WHERE t.status = 'pending-review') as "pendingReviewCount",
         COALESCE(SUM(
           CASE 
             WHEN t.type = 'SHARED' THEN 
               t.points / GREATEST((SELECT COUNT(*) FROM "TaskAssignee" ta WHERE ta."taskId" = t.id), 1)
             ELSE 
               t.points 
           END
         ) FILTER (WHERE t.status = 'completed' AND t."updatedAt"::date = CURRENT_DATE), 0) as "pointsToday",
         
         -- Root Stats (For Pagination)
         COUNT(*) FILTER (WHERE t."parentId" IS NULL) as "rootTotal",
         COUNT(*) FILTER (WHERE t."parentId" IS NULL AND t.status = 'completed') as "rootCompleted",
         COUNT(*) FILTER (WHERE t."parentId" IS NULL AND t.status = 'pending') as "rootPending",
         COUNT(*) FILTER (WHERE t."parentId" IS NULL AND t.status = 'in-progress') as "rootInProgress",
         COUNT(*) FILTER (WHERE t."parentId" IS NULL AND t.status = 'pending-review') as "rootPendingReview"
       FROM task t
       JOIN projects p ON t."projectId" = p.id
       ${contextWhere}`,
      contextParams
    );
    stats = statsResult.rows[0];

    // 4. Determine Total Count based on Status Filter for PAGINATION (Root Only)
    if (!status || status === 'all') {
      totalCount = parseInt(stats.rootTotal);
    } else if (status === 'pending') {
      totalCount = parseInt(stats.rootPending);
    } else if (status === 'in-progress') {
      totalCount = parseInt(stats.rootInProgress);
    } else if (status === 'completed') {
      totalCount = parseInt(stats.rootCompleted);
    } else if (status === 'pending-review') {
      totalCount = parseInt(stats.rootPendingReview);
    } else {
      totalCount = 0;
    }

    // 5. Get Data (Filtered by Status + Paginated)
    // Explicitly enforce Root tasks for the list view
    let mainWhere = contextWhere + ` AND t."parentId" IS NULL`;
    let mainParams = [...contextParams];
    // paramIdx is already incremented for contextParams. 

    if (status && status !== 'all') {
      // MODIFIED: Include Root tasks matching status OR having subtasks matching status
      // This ensures that if a Parent is 'completed' but has a 'pending' subtask, 
      // the Parent is still fetched (so the subtask can be shown).
      mainWhere += ` AND (t.status = $${paramIdx} OR EXISTS (SELECT 1 FROM task st WHERE st."parentId" = t.id AND st.status = $${paramIdx}))`;
      mainParams.push(status);
      paramIdx++;

      // MODIFIED: Recalculate Total Count for Pagination using the complex query
      // The pre-calculated 'stats' object only counts exact status matches on roots.
      const countResult = await pool.query(
        `SELECT COUNT(DISTINCT t.id) 
         FROM task t
         JOIN projects p ON t."projectId" = p.id
         LEFT JOIN employee e ON t."createdBy"::uuid = e.id
         ${mainWhere}`,
        mainParams
      );
      totalCount = parseInt(countResult.rows[0].count);

    } else {
      // For 'all', we can rely on the stats object (rootTotal matches contextWhere + root)
      // Recalculating here just to be safe and consistent with context filters
      if (!totalCount && totalCount !== 0) {
        totalCount = parseInt(stats.rootTotal);
      }
    }

    // 6. Build ORDER BY clause
    const validSortColumns = {
      'createdAt': 't."createdAt"',
      'dueDate': 't."dueDate"',
      'status': 't.status',
      'points': 't.points',
      'priority': 't.priority',
      'description': 't.description',
      'order': 't."order"'
    };

    let orderByClause = 'ORDER BY t."order" ASC, t."createdAt" DESC'; // default
    if (sortBy && validSortColumns[sortBy]) {
      const direction = sortOrder && sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      orderByClause = `ORDER BY ${validSortColumns[sortBy]} ${direction}`;

      // Add secondary sort for consistency
      if (sortBy !== 'createdAt') {
        orderByClause += `, t."createdAt" DESC`;
      }
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
       ${orderByClause}
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

      // Fetch assignees for the list of tasks
      const assigneesResult = await pool.query(
        `SELECT ta.*, e."firstName", e."lastName", e.email
           FROM "TaskAssignee" ta
           JOIN employee e ON ta."employeeId" = e.id
           WHERE ta."taskId" = ANY($1::uuid[])
           ORDER BY ta."order" ASC`,
        [taskIds]
      );
      const allAssignees = assigneesResult.rows;

      tasks.forEach(task => {
        task.subtasks = subtasks.filter(st => st.parentId === task.id);
        task.assignees = allAssignees.filter(a => a.taskId === task.id);

        // Adjust points for SHARED tasks (Divide by assignee count)
        // Only if we are filtering by a specific user (showing "My Share")
        // User request: "When doing filter and the task is shared then show the points as well by dividing"
        if (assignedTo && assignedTo !== 'all' && task.type === 'SHARED' && task.assignees.length > 0) {
          task.points = parseFloat((task.points / task.assignees.length).toFixed(2));
        }
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
        pendingReviewTasks: parseInt(stats.pendingReviewCount) || 0,
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
    await pool.query('BEGIN');
    // Check Task Type first
    const taskCheck = await pool.query(
      `SELECT type, "assignedTo" FROM task WHERE id = $1`,
      [id]
    );

    if (taskCheck.rowCount === 0) {
      await pool.query('ROLLBACK');
      return next(new NotFoundError('Task not found'));
    }

    const taskType = taskCheck.rows[0].type;
    const currentAssignedTo = taskCheck.rows[0].assignedTo;

    // Sequential Task Completion Logic
    if (taskType === 'SEQUENTIAL' && (status === 'completed' || status === 'done')) {
      // Find assignees
      const assigneesRes = await pool.query(
        `SELECT * FROM "TaskAssignee" WHERE "taskId" = $1 ORDER BY "order" ASC`,
        [id]
      );
      const assignees = assigneesRes.rows;

      // Find current assignee index
      const currentIndex = assignees.findIndex(a => a.employeeId === currentAssignedTo);

      // Mark current/active assignee as completed
      if (currentIndex !== -1) {
        await pool.query(
          `UPDATE "TaskAssignee" SET "isCompleted" = true, "completedAt" = NOW() WHERE id = $1`,
          [assignees[currentIndex].id]
        );
      }

      // Check for next assignee
      if (currentIndex !== -1 && currentIndex < assignees.length - 1) {
        const nextAssignee = assignees[currentIndex + 1];

        // Move to next assignee
        const result = await pool.query(
          `UPDATE task t SET
                 "assignedTo" = $1,
                 "assigned_at" = NOW(),
                 "status" = 'pending', -- Reset status to pending for next user
                 "updatedAt" = NOW()
                 FROM projects p
                 WHERE t.id = $2 AND t."projectId" = p.id AND p."organiationId" = $3
                 RETURNING t.*`,
          [nextAssignee.employeeId, id, organiationId]
        );
        await pool.query('COMMIT');
        return res.json(result.rows[0]);
      }
      // If no next assignee, proceed to standard completion (final completion)
    }

    // Standard Update
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
    if (result.rowCount === 0) {
      await pool.query('ROLLBACK');
      return next(new NotFoundError('Task not found'));
    }
    await pool.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await pool.query('ROLLBACK');
    next(error);
  }
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

// Delete Task (Cascade: delete comments, subtasks, subtask-comments)


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
         e."firstName" || ' ' || e."lastName" AS "userName",
         t.id as "taskId",
         t.description as "taskDescription",
         CASE WHEN t.id = $1 THEN 'Main Task' ELSE 'Subtask' END as "source"
       FROM comment c
       JOIN task t ON c."taskId" = t.id
       JOIN projects p ON t."projectId" = p.id
       JOIN employee e ON c."authorId" = e.id
       WHERE (t.id = $1 OR t."parentId" = $1) AND p."organiationId" = $2
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
  const userId = req.user.user_uuid;
  const userRole = req.user.role;

  try {
    await pool.query('BEGIN');
    // Check Task Type first
    const taskCheck = await pool.query(
      `SELECT type, "assignedTo", "createdBy", status FROM task WHERE id = $1`,
      [id]
    );

    if (taskCheck.rowCount === 0) {
      await pool.query('ROLLBACK');
      return next(new NotFoundError('Task not found'));
    }

    const task = taskCheck.rows[0];
    const taskType = task.type;
    const currentAssignedTo = task.assignedTo;
    const createdBy = task.createdBy;
    const currentStatus = task.status;

    // --- VERIFICATION FLOW LOGIC ---

    // 1. Worker submitting for review (completed -> pending-review)
    // No specific block needed if we just allow it, but we could enforce assignedTo check here.

    // 2. Reviewer approving (pending-review -> completed)
    if (status === 'completed' || status === 'done') {
      const isReviewer = userId === createdBy || userRole === 'ADMIN';
      // If it is 'pending-review', only Reviewer/Admin can complete it.
      if (currentStatus === 'pending-review' && !isReviewer) {
        // Optionally restrict: return next(new ForbiddenError('Only the task creator can approve this task.'));
      }
    }

    // Sequential Task Completion Logic
    if (taskType === 'SEQUENTIAL' && (status === 'completed' || status === 'done')) {
      // Find assignees
      const assigneesRes = await pool.query(
        `SELECT * FROM "TaskAssignee" WHERE "taskId" = $1 ORDER BY "order" ASC`,
        [id]
      );
      const assignees = assigneesRes.rows;

      // Find current assignee index
      const currentIndex = assignees.findIndex(a => a.employeeId == currentAssignedTo);
      console.log('Sequential Debug: Current Assignee:', currentAssignedTo, 'Found Index:', currentIndex);

      // Mark current/active assignee as completed
      if (currentIndex !== -1) {
        await pool.query(
          `UPDATE "TaskAssignee" SET "isCompleted" = true, "completedAt" = NOW() WHERE id = $1`,
          [assignees[currentIndex].id]
        );
      }

      // Check for next assignee
      if (currentIndex !== -1 && currentIndex < assignees.length - 1) {
        const nextAssignee = assignees[currentIndex + 1];
        console.log('Sequential Debug: Moving to next assignee:', nextAssignee.employeeId);

        // Move to next assignee
        const result = await pool.query(
          `UPDATE task t SET
                 "assignedTo" = $1,
                 "assigned_at" = NOW(),
                 "status" = 'pending', -- Reset status to pending for next user
                 "updatedAt" = NOW()
                 FROM projects p
                 WHERE t.id = $2 AND t."projectId" = p.id AND p."organiationId" = $3
                 RETURNING t.*`,
          [nextAssignee.employeeId, id, organiationId]
        );
        await pool.query('COMMIT');
        return res.json(result.rows[0]);
      }
      console.log('Sequential Debug: Logic Completed. Finishing Task.');
      // If no next assignee, proceed to standard completion (final completion)
    }

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
    if (result.rowCount === 0) {
      await pool.query('ROLLBACK');
      return next(new NotFoundError('Task not found'));
    }
    await pool.query('COMMIT');
    res.json(result.rows[0]);
  }
  catch (error) {
    await pool.query('ROLLBACK');
    next(error);
  }
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