const pool = require('../../config/db');
const Joi = require('joi');
const { BadRequestError, NotFoundError } = require('../../utils/errors');
const { withTransaction } = require('../../utils/queryBuilders');
const push = require('../../utils/pushNotifications');
const logger = require('../../utils/logger');


// ---------------------------------------------------------------------------
// Push notification helpers (fire-and-forget — never affect the HTTP response)
// ---------------------------------------------------------------------------

const getEmployeeName = async (employeeId) => {
  try {
    const r = await pool.query(`SELECT "firstName", "lastName" FROM employee WHERE id = $1`, [employeeId]);
    if (r.rowCount === 0) return null;
    const { firstName, lastName } = r.rows[0];
    return `${firstName || ''} ${lastName || ''}`.trim() || null;
  } catch (_) {
    return null;
  }
};

const notifyTaskParticipants = (recipients, message) => {
  try {
    push.sendToEmployeeIds(recipients, message);
  } catch (err) { logger.warn(`task push hook failed: ${err.message}`); }
};

/** Runs a fire-and-forget push hook, logging (never throwing) on failure. */
const runPushHook = (label, fn) => {
  Promise.resolve()
    .then(fn)
    .catch((err) => logger.warn(`${label} push hook failed: ${err.message}`));
};

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
    assignees: Joi.array().items(Joi.string().uuid()).optional(),
    deviceTime: Joi.date().iso().optional()
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

    // Transaction with dedicated client for safety
    const taskTime = req.body.deviceTime ? new Date(req.body.deviceTime) : new Date();
    const task = await withTransaction(pool.pool, async (client) => {
      const result = await client.query(
        `INSERT INTO task (description, status, "createdBy", "assignedTo", points, "projectId", "assigned_at", priority, "dueDate", "parentId", "type")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               RETURNING *`,
        [description, status, createdBy, finalAssignedTo, points, projectId, taskTime, priority, dueDate, parentId, type]
      );
      const newTask = result.rows[0];

      // Create TaskAssignee records if applicable — single bulk INSERT
      // (was one round trip per assignee).
      if ((type === 'SHARED' || type === 'SEQUENTIAL') && assignees && assignees.length > 0) {
        await client.query(
          `INSERT INTO task_assignee ("taskId", "employeeId", "order", "isCompleted", "assignedAt")
           SELECT $1, x.emp, CASE WHEN $3 THEN x.ord::int ELSE NULL END, false, $4
           FROM unnest($2::uuid[]) WITH ORDINALITY AS x(emp, ord)`,
          [newTask.id, assignees, type === 'SEQUENTIAL', taskTime]
        );
      } else if (finalAssignedTo) {
        // Populate TaskAssignee for SINGLE tasks too for consistency
        await client.query(
          `INSERT INTO task_assignee ("taskId", "employeeId", "order", "isCompleted", "assignedAt")
               VALUES ($1, $2, $3, $4, $5)`,
          [newTask.id, finalAssignedTo, 1, false, taskTime]
        );
      }

      return newTask;
    });

    res.status(201).json(task);

    // Notify assignees (fire-and-forget, skip the creator)
    runPushHook('createTask', async () => {
      const recipients = [...new Set([finalAssignedTo, ...(assignees || [])])]
        .filter((id) => id && id !== createdBy);
      notifyTaskParticipants(recipients, push.buildMessage({
        title: 'New task assigned',
        body: `You were assigned: "${push.truncate(description)}"`,
        link: `/dashboard/tasks/${task.id}`,
        type: 'task_assigned',
      }));
    });
  } catch (error) {
    next(error);
  }
};

const createTaskFromGoogleForm = async (req, res, next) => {
  const {
    'Bug Title': bugTitle,
    'Severity': severity,
    'Module': modules,
    'Component / Module': components,
    'Environment Details': envDetails,
    'Steps to Reproduce': steps,
    'Expected Behavior': expected,
    'Attach Screenshot / Video': attachments,
    'Logs / Error Messages': logs,
    'Assigned to': assignedToField
  } = req.body;

  const createdBy = req.user.user_uuid;
  const organiationId = req.user.organization_uuid;

  // Mapping for Project IDs based on Module names
  const projectMapping = {
    'CRM': 'CRM',
    'Academic': 'Academic',
    'Admission/Fees': 'Admission Fees',
    'Library Module': 'Library Module',
    'TnP': 'TnP',
    'Inventory Mgmt System': 'Inventory Mgmt System',
    'Alumni': 'Alumni',
    'Ticketing System': 'Ticketing System',
    'Time table': 'Time table ',
    'Question Paper': 'Question Paper',
    'Hostel Management': 'Hostel Management'
  };

  // Map severity to Priority enum
  const priorityMap = {
    'Critical': 'HIGH',
    'High': 'HIGH',
    'Medium': 'MEDIUM',
    'Low': 'LOW'
  };

  try {
    // 1. Determine Project ID
    let projectName = 'Task Manager'; // Default project
    if (Array.isArray(modules) && modules.length > 0) {
      projectName = projectMapping[modules[0]] || modules[0];
    } else if (typeof modules === 'string') {
      projectName = projectMapping[modules] || modules;
    }

    const projectResult = await pool.query(
      'SELECT id FROM projects WHERE name ILIKE $1 AND "organiationId" = $2 LIMIT 1',
      [projectName, organiationId]
    );

    let projectId;
    if (projectResult.rowCount > 0) {
      projectId = projectResult.rows[0].id;
    } else {
      // Fallback to "Task Manager" if it exists, otherwise use any active project or throw error
      const fallbackResult = await pool.query(
        'SELECT id FROM projects WHERE "organiationId" = $1 LIMIT 1',
        [organiationId]
      );
      if (fallbackResult.rowCount === 0) throw new BadRequestError('No projects found in organization');
      projectId = fallbackResult.rows[0].id;
    }

    // 2. Extract Assignee Emails and Find User IDs
    const emails = [];
    const assignedToString = Array.isArray(assignedToField) ? assignedToField.join(', ') : (assignedToField || '');
    const emailRegex = /\(([^)]+)\)/g;
    let match;
    while ((match = emailRegex.exec(assignedToString)) !== null) {
      emails.push(match[1]);
    }

    let assigneeIds = [];
    if (emails.length > 0) {
      const usersResult = await pool.query(
        'SELECT id FROM employee WHERE email = ANY($1) AND "organiationId" = $2',
        [emails, organiationId]
      );
      assigneeIds = usersResult.rows.map(r => r.id);
    }

    // 3. Format Description
    const formatList = (val) => Array.isArray(val) ? val.join(', ') : (val || 'N/A');
    const formatAttachments = (val) => {
      if (!val) return 'N/A';
      const items = Array.isArray(val) ? val : val.split(',').map(s => s.trim());
      return items.map(id => `https://drive.google.com/file/d/${id}/view`).join('\n');
    };

    const taskDescription = `
### ${bugTitle || 'Bug Report'}

**Severity:** ${severity || 'N/A'}
**Modules:** ${formatList(modules)}
**Components:** ${formatList(components)}

#### Environment Details
${envDetails || 'No details provided.'}

#### Steps to Reproduce
${steps || 'No steps provided.'}

#### Expected Behavior
${expected || 'No expected behavior provided.'}

#### Logs / Error Messages
${logs || 'No logs provided.'}

#### Attachments
${formatAttachments(attachments)}
`.trim();

    // 4. Create Task
    const priority = priorityMap[severity] || 'MEDIUM';
    const finalAssignedTo = assigneeIds.length > 0 ? assigneeIds[0] : createdBy;

    const task = await withTransaction(pool.pool, async (client) => {
      const result = await client.query(
        `INSERT INTO task (description, status, "createdBy", "assignedTo", points, "projectId", "assigned_at", priority, type)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               RETURNING *`,
        [taskDescription, 'pending', createdBy, finalAssignedTo, 0, projectId, new Date(), priority, assigneeIds.length > 1 ? 'SHARED' : 'SINGLE']
      );
      const newTask = result.rows[0];

      // Create TaskAssignee records — single bulk INSERT
      if (assigneeIds.length > 0) {
        await client.query(
          `INSERT INTO task_assignee ("taskId", "employeeId", "order", "isCompleted", "assignedAt")
           SELECT $1, unnest($2::uuid[]), NULL, false, $3`,
          [newTask.id, assigneeIds, new Date()]
        );
      } else if (finalAssignedTo) {
        await client.query(
          `INSERT INTO task_assignee ("taskId", "employeeId", "order", "isCompleted", "assignedAt")
               VALUES ($1, $2, $3, $4, $5)`,
          [newTask.id, finalAssignedTo, 1, false, new Date()]
        );
      }

      return newTask;
    });

    res.status(201).json(task);
  } catch (error) {
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
    // Fetch the main task
    const taskResult = await pool.query(
      `SELECT t.* FROM task t
           JOIN projects p ON t."projectId" = p.id
           WHERE t.id = $1 AND p."organiationId" = $2`,
      [id, organiationId]
    );
    if (taskResult.rowCount === 0) return next(new NotFoundError('Task not found'));

    const task = taskResult.rows[0];

    // Subtasks and assignees are independent — fetch them together.
    const [subResult, assigneeResult] = await Promise.all([
      pool.query(
        `SELECT t.*, e."firstName" as "creatorFirstName", e."lastName" as "creatorLastName"
         FROM task t
         LEFT JOIN employee e ON t."createdBy"::uuid = e.id
         WHERE t."parentId" = $1
         ORDER BY t."order" ASC, t."createdAt" ASC`,
        [id]
      ),
      pool.query(
        `SELECT ta.*, e."firstName", e."lastName", e.email
         FROM task_assignee ta
         JOIN employee e ON ta."employeeId" = e.id
         WHERE ta."taskId" = $1
         ORDER BY ta."order" ASC`,
        [id]
      ),
    ]);
    task.subtasks = subResult.rows;
    task.assignees = assigneeResult.rows;

    res.json(task);
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
      contextWhere = `WHERE (t."assignedTo" = $1 OR t."createdBy" = $1 OR ((t.type = 'SHARED' OR t.type = 'SEQUENTIAL') AND EXISTS (SELECT 1 FROM task_assignee ta WHERE ta."taskId" = t.id AND ta."employeeId" = $1::uuid)) OR $1::uuid = ANY(p."headIds")) AND p."organiationId" = $2`;
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
      contextWhere += ` AND (t."assignedTo" = $${paramIdx} OR EXISTS (SELECT 1 FROM task_assignee ta WHERE ta."taskId" = t.id AND ta."employeeId" = $${paramIdx}::uuid))`;
      contextParams.push(assignedTo);
      paramIdx++;
    }

    if (date) {
      if (date === 'today') {
        // Deliberately kept as an expression: prod has
        // idx_task_assigned_at_date ON task(((assigned_at)::date)), which an
        // equivalent NOW()-range form cannot use.
        contextWhere += ` AND t."assigned_at"::date = CURRENT_DATE`;
      } else if (date === 'week') {
        contextWhere += ` AND t."assigned_at" >= CURRENT_DATE - INTERVAL '7 days'`;
      } else if (date === 'overdue') {
        contextWhere += ` AND t."dueDate" < CURRENT_DATE AND t.status != 'completed'`;
      }
    }

    // 3. Build all SQL first (pure JS — no DB round trips), then fire the
    // independent queries in parallel below (was: 5 sequential round trips).
    let mainWhere = contextWhere + ` AND t."parentId" IS NULL`;
    const mainParams = [...contextParams];

    if (status && status !== 'all') {
      // Include Root tasks matching status OR having subtasks matching status,
      // so a completed parent with a pending subtask still appears.
      mainWhere += ` AND (t.status = $${paramIdx} OR EXISTS (SELECT 1 FROM task st WHERE st."parentId" = t.id AND st.status = $${paramIdx}))`;
      mainParams.push(status);
      paramIdx++;
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

    const statsSql = `SELECT
         -- Global Stats (Including Subtasks)
         COUNT(*) as "totalTasks",
         COUNT(*) FILTER (WHERE t.status = 'completed') as "completedCount",
         COUNT(*) FILTER (WHERE t.status = 'pending') as "pendingCount",
         COUNT(*) FILTER (WHERE t.status = 'in-progress') as "inProgressCount",
         COUNT(*) FILTER (WHERE t.status = 'pending-review') as "pendingReviewCount",
          COALESCE(SUM(
            CASE 
              WHEN t.type = 'SHARED' THEN 
                t.points / GREATEST((SELECT COUNT(*) FROM task_assignee ta WHERE ta."taskId" = t.id), 1)
              ELSE 
                t.points 
            END
          ) FILTER (WHERE t.status = 'completed' AND t."updatedAt"::date = ($${paramIdx})::date), 0) as "pointsToday",
         -- Root Stats (For Pagination)
         COUNT(*) FILTER (WHERE t."parentId" IS NULL) as "rootTotal"
       FROM task t
       JOIN projects p ON t."projectId" = p.id
        ${contextWhere}`;

    const pageSql = `SELECT t.*, e."firstName" as "creatorFirstName", e."lastName" as "creatorLastName",
       (SELECT content FROM comment c WHERE c."taskId" = t.id ORDER BY "createdAt" DESC LIMIT 1) as "latestComment"
       FROM task t
       JOIN projects p ON t."projectId" = p.id
       LEFT JOIN employee e ON t."createdBy"::uuid = e.id
       ${mainWhere}
       ${orderByClause}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;

    // Status-filtered pagination needs the complex count; the 'all' case can
    // use stats.rootTotal.
    const needsCount = Boolean(status && status !== 'all');

    const [statsResult, countResult, pageResult] = await Promise.all([
      pool.query(statsSql, [...contextParams, req.query.today || new Date().toISOString().split('T')[0]]),
      needsCount
        ? pool.query(
            `SELECT COUNT(DISTINCT t.id) 
             FROM task t
             JOIN projects p ON t."projectId" = p.id
             LEFT JOIN employee e ON t."createdBy"::uuid = e.id
             ${mainWhere}`,
            mainParams
          )
        : Promise.resolve(null),
      pool.query(pageSql, pagingParams),
    ]);
    result = pageResult;

    stats = statsResult.rows[0];
    totalCount = countResult
      ? parseInt(countResult.rows[0].count)
      : parseInt(stats.rootTotal);

    const tasks = result.rows;

    if (tasks.length > 0) {
      const taskIds = tasks.map(t => t.id);

      // Subtasks and assignees are independent — fetch them together.
      const [subtasksResult, assigneesResult] = await Promise.all([
        pool.query(
          `SELECT t.*, e."firstName" as "creatorFirstName", e."lastName" as "creatorLastName",
           (SELECT content FROM comment c WHERE c."taskId" = t.id ORDER BY "createdAt" DESC LIMIT 1) as "latestComment"
           FROM task t
           LEFT JOIN employee e ON t."createdBy"::uuid = e.id
           WHERE t."parentId" = ANY($1::uuid[])
           ORDER BY t."order" ASC, t."createdAt" ASC`,
          [taskIds]
        ),
        pool.query(
          `SELECT ta.*, e."firstName", e."lastName", e.email
             FROM task_assignee ta
             JOIN employee e ON ta."employeeId" = e.id
             WHERE ta."taskId" = ANY($1::uuid[])
             ORDER BY ta."order" ASC`,
          [taskIds]
        ),
      ]);

      // Group once into Maps (was O(n·m) filter-inside-forEach).
      const subtasksByParent = new Map();
      for (const st of subtasksResult.rows) {
        const list = subtasksByParent.get(st.parentId);
        if (list) list.push(st);
        else subtasksByParent.set(st.parentId, [st]);
      }
      const assigneesByTask = new Map();
      for (const a of assigneesResult.rows) {
        const list = assigneesByTask.get(a.taskId);
        if (list) list.push(a);
        else assigneesByTask.set(a.taskId, [a]);
      }

      tasks.forEach(task => {
        task.subtasks = subtasksByParent.get(task.id) || [];
        task.assignees = assigneesByTask.get(task.id) || [];

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
       ORDER BY t."order" ASC, t."createdAt" DESC
       LIMIT 1000`,
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
  const updateTime = req.body.deviceTime ? new Date(req.body.deviceTime) : new Date();

  try {
    const result = await withTransaction(pool.pool, async (client) => {
      // Check Task Type first
      const taskCheck = await client.query(
        `SELECT type, "assignedTo" FROM task WHERE id = $1`,
        [id]
      );

      if (taskCheck.rowCount === 0) {
        throw new NotFoundError('Task not found');
      }

      const taskType = taskCheck.rows[0].type;
      const currentAssignedTo = taskCheck.rows[0].assignedTo;

      // Sequential Task Completion Logic
      if (taskType === 'SEQUENTIAL' && (status === 'completed' || status === 'done')) {
        const assigneesRes = await client.query(
          `SELECT * FROM task_assignee WHERE "taskId" = $1 ORDER BY "order" ASC`,
          [id]
        );
        const assignees = assigneesRes.rows;
        const currentIndex = assignees.findIndex(a => a.employeeId === currentAssignedTo);

        if (currentIndex !== -1) {
          await client.query(
            `UPDATE task_assignee SET "isCompleted" = true, "completedAt" = $1::timestamp WHERE id = $2`,
            [updateTime, assignees[currentIndex].id]
          );
        }

        if (currentIndex !== -1 && currentIndex < assignees.length - 1) {
          const nextAssignee = assignees[currentIndex + 1];
          const moveResult = await client.query(
            `UPDATE task t SET
                   "assignedTo" = $1,
                   "assigned_at" = $4::timestamp,
                   "status" = 'pending',
                   "updatedAt" = $4::timestamp
                   FROM projects p
                   WHERE t.id = $2 AND t."projectId" = p.id AND p."organiationId" = $3
                   RETURNING t.*`,
            [nextAssignee.employeeId, id, organiationId, updateTime]
          );
          return moveResult.rows[0];
        }
      }

      // Standard Update
      const updateResult = await client.query(
        `UPDATE task t SET
               description = COALESCE($1, t.description),
               status = COALESCE($2, t.status),
               "assignedTo" = COALESCE($3, t."assignedTo"),
               points = COALESCE($4, t.points),
               priority = COALESCE($5, t.priority),
               "dueDate" = COALESCE($6, t."dueDate"),
               "assigned_at" = CASE WHEN $3 IS NOT NULL THEN $9::timestamp ELSE t."assigned_at" END,
               "completedAt" = COALESCE($10::timestamp, CASE 
                  WHEN $2::text IS NOT NULL AND LOWER($2) IN ('done', 'completed') THEN $9::timestamp
                  WHEN $2::text IS NOT NULL AND LOWER($2) NOT IN ('done', 'completed') THEN NULL
                  ELSE t."completedAt"
               END),
               "updatedAt" = $9::timestamp
               FROM projects p
               WHERE t.id = $7 AND t."projectId" = p.id AND p."organiationId" = $8
               RETURNING t.*`,
        [description, status, assignedTo, points, priority, dueDate, id, organiationId, updateTime, completedAt]
      );
      if (updateResult.rowCount === 0) {
        throw new NotFoundError('Task not found');
      }
      return updateResult.rows[0];
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Task (Cascade: delete comments, subtask assignees, subtask comments, subtasks, task assignees, task).
 * Uses a dedicated client for transaction safety.
 */
const deleteTask = async (req, res, next) => {
  const { id } = req.params;
  const organiationId = req.user.organization_uuid;

  try {
    await withTransaction(pool.pool, async (client) => {
      // Delete assignees of subtasks
      await client.query(
        `DELETE FROM task_assignee ta
         USING task t, projects p
         WHERE ta."taskId" = t.id
         AND t."parentId" = $1
         AND t."projectId" = p.id
         AND p."organiationId" = $2`,
        [id, organiationId]
      );

      // Delete comments of subtasks
      await client.query(
        `DELETE FROM comment c
         USING task t, projects p
         WHERE c."taskId" = t.id
         AND t."parentId" = $1
         AND t."projectId" = p.id
         AND p."organiationId" = $2`,
        [id, organiationId]
      );

      // Delete subtasks
      await client.query(
        `DELETE FROM task t
         USING projects p
         WHERE t."parentId" = $1
         AND t."projectId" = p.id
         AND p."organiationId" = $2`,
        [id, organiationId]
      );

      // Delete task assignees
      await client.query(
        `DELETE FROM task_assignee ta
         USING task t, projects p
         WHERE ta."taskId" = t.id
         AND t.id = $1
         AND t."projectId" = p.id
         AND p."organiationId" = $2`,
        [id, organiationId]
      );

      // Delete task comments
      await client.query(
        `DELETE FROM comment c 
         USING task t, projects p 
         WHERE c."taskId" = t.id 
           AND t.id = $1 
           AND t."projectId" = p.id 
           AND p."organiationId" = $2`,
        [id, organiationId]
      );

      // Delete the task itself
      const result = await client.query(
        `DELETE FROM task t 
         USING projects p 
         WHERE t.id = $1 
           AND t."projectId" = p.id 
           AND p."organiationId" = $2 
         RETURNING t.id`,
        [id, organiationId]
      );

      if (result.rowCount === 0) {
        throw new NotFoundError('Task not found');
      }
    });

    res.json({ message: 'Task and comments deleted' });
  } catch (error) {
    next(error);
  }
};

const createComment = async (req, res, next) => {
  const { taskId } = req.params;
  const { content, attachments = [], links = [] } = req.body;
  const authorId = req.user.user_uuid;
  const organizationId = req.user.organization_uuid;

  try {
    const result = await withTransaction(pool.pool, async (client) => {
      const commentResult = await client.query(
        `INSERT INTO comment (content, "taskId", "authorId")
               SELECT $1, $2, $3
               FROM task t
               JOIN projects p ON t."projectId" = p.id
               WHERE t.id = $2 AND p."organiationId" = $4
               RETURNING id, content, "authorId", "createdAt"`,
        [content, taskId, authorId, organizationId]
      );

      if (commentResult.rowCount === 0) {
        throw new NotFoundError('Task not found');
      }

      const comment = commentResult.rows[0];

      // Insert Attachments — single bulk INSERT (was one round trip each)
      if (attachments && attachments.length > 0) {
        await client.query(
          `INSERT INTO comment_attachment ("commentId", name, url, "fileType", size, heading)
           SELECT $1, x.name, x.url, x."fileType", x.size::int, x.heading
           FROM json_to_recordset($2::json) AS x(name text, url text, "fileType" text, size text, heading text)`,
          [comment.id, JSON.stringify(attachments)]
        );
      }

      // Insert Links — single bulk INSERT
      if (links && links.length > 0) {
        await client.query(
          `INSERT INTO comment_link ("commentId", name, url, heading)
           SELECT $1, x.name, x.url, x.heading
           FROM json_to_recordset($2::json) AS x(name text, url text, heading text)`,
          [comment.id, JSON.stringify(links)]
        );
      }

      return comment;
    });

    res.status(201).json(result);

    // Notify task participants about the new comment (skip the author)
    runPushHook('createComment', async () => {
      const [taskRow, assigneeRows, actorName] = await Promise.all([
        pool.query(
          `SELECT t.description, t."createdBy", t."assignedTo"
             FROM task t JOIN projects p ON t."projectId" = p.id
            WHERE t.id = $1 AND p."organiationId" = $2`,
          [taskId, organizationId]
        ),
        pool.query(`SELECT "employeeId" FROM task_assignee WHERE "taskId" = $1`, [taskId]),
        getEmployeeName(authorId),
      ]);
      if (taskRow.rowCount > 0) {
        const t = taskRow.rows[0];
        const recipients = [...new Set([t.createdBy, t.assignedTo, ...assigneeRows.rows.map((r) => r.employeeId)])]
          .filter((id) => id && id !== authorId);
        notifyTaskParticipants(recipients, push.buildMessage({
          title: 'New comment',
          body: `${actorName || 'Someone'} commented on "${push.truncate(t.description, 40)}": "${push.truncate(content || 'a comment', 60)}"`,
          link: `/dashboard/tasks/${taskId}`,
          type: 'comment',
        }));
      }
    });
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
       ORDER BY c."createdAt" DESC
       LIMIT 200`,
      [taskId, organiationId]
    );

    const comments = result.rows;

    if (comments.length > 0) {
      const commentIds = comments.map(c => c.id);

      // Attachments and links are independent — fetch together.
      const [attachmentsRes, linksRes] = await Promise.all([
        pool.query(
          `SELECT * FROM comment_attachment WHERE "commentId" = ANY($1::uuid[])`,
          [commentIds]
        ),
        pool.query(
          `SELECT * FROM comment_link WHERE "commentId" = ANY($1::uuid[])`,
          [commentIds]
        ),
      ]);

      // Group once into Maps (was O(n·m) filter-inside-forEach).
      const attByComment = new Map();
      for (const a of attachmentsRes.rows) {
        const list = attByComment.get(a.commentId);
        if (list) list.push(a);
        else attByComment.set(a.commentId, [a]);
      }
      const linksByComment = new Map();
      for (const l of linksRes.rows) {
        const list = linksByComment.get(l.commentId);
        if (list) list.push(l);
        else linksByComment.set(l.commentId, [l]);
      }

      comments.forEach(comment => {
        comment.attachments = attByComment.get(comment.id) || [];
        comment.links = linksByComment.get(comment.id) || [];
      });
    }

    res.json(comments);
  } catch (error) {
    next(error);
  }
};

/** Change the status of a task. Handles sequential task hand-off logic. */
const changeTaskStatus = async (req, res, next) => {
  const { id } = req.params;
  const { status, deviceTime } = req.body;
  const updateTime = deviceTime ? new Date(deviceTime) : new Date();
  const organiationId = req.user.organization_uuid;
  const userId = req.user.user_uuid;
  const userRole = req.user.role;

  try {
    const result = await withTransaction(pool.pool, async (client) => {
      const taskCheck = await client.query(
        `SELECT type, "assignedTo", "createdBy", status FROM task WHERE id = $1`,
        [id]
      );

      if (taskCheck.rowCount === 0) {
        throw new NotFoundError('Task not found');
      }

      const task = taskCheck.rows[0];
      const taskType = task.type;
      const currentAssignedTo = task.assignedTo;
      const createdBy = task.createdBy;
      const currentStatus = task.status;

      // Reviewer approval check (pending-review -> completed)
      if (status === 'completed' || status === 'done') {
        const isReviewer = userId === createdBy || userRole === 'ADMIN';
        if (currentStatus === 'pending-review' && !isReviewer) {
          // Future: throw new AuthorizationError('Only the task creator can approve this task.');
        }
      }

      // Sequential Task Completion Logic
      if (taskType === 'SEQUENTIAL' && (status === 'completed' || status === 'done')) {
        const assigneesRes = await client.query(
          `SELECT * FROM task_assignee WHERE "taskId" = $1 ORDER BY "order" ASC`,
          [id]
        );
        const assignees = assigneesRes.rows;
        const currentIndex = assignees.findIndex(a => a.employeeId === currentAssignedTo);

        if (currentIndex !== -1) {
          await client.query(
            `UPDATE task_assignee SET "isCompleted" = true, "completedAt" = $1::timestamp WHERE id = $2`,
            [updateTime, assignees[currentIndex].id]
          );
        }

        if (currentIndex !== -1 && currentIndex < assignees.length - 1) {
          const nextAssignee = assignees[currentIndex + 1];
          const moveResult = await client.query(
            `UPDATE task t SET
                   "assignedTo" = $1,
                   "assigned_at" = $4::timestamp,
                   "status" = 'pending',
                   "updatedAt" = $4::timestamp
                   FROM projects p
                   WHERE t.id = $2 AND t."projectId" = p.id AND p."organiationId" = $3
                   RETURNING t.*`,
            [nextAssignee.employeeId, id, organiationId, updateTime]
          );
          return moveResult.rows[0];
        }
      }

      // Standard status update
      const statusResult = await client.query(
        `UPDATE task t SET
                  status = $1,
                  "completedAt" = CASE 
                     WHEN LOWER($1) IN ('done', 'completed') THEN $4::timestamp 
                     ELSE NULL 
                  END,
                  "updatedAt" = $4::timestamp
                  FROM projects p
                  WHERE t.id = $2 AND t."projectId" = p.id AND p."organiationId" = $3
                  RETURNING t.*`,
        [status, id, organiationId, updateTime]
      );
      if (statusResult.rowCount === 0) {
        throw new NotFoundError('Task not found');
      }
      return statusResult.rows[0];
    });

    res.json(result);

    // Notify task creator/assignees of the status change (skip the actor)
    runPushHook('changeTaskStatus', async () => {
      const [assigneeRows, actorName] = await Promise.all([
        pool.query(`SELECT "employeeId" FROM task_assignee WHERE "taskId" = $1`, [id]),
        getEmployeeName(userId),
      ]);
      const recipients = [...new Set([result.createdBy, result.assignedTo, ...assigneeRows.rows.map((r) => r.employeeId)])]
        .filter((eid) => eid && eid !== userId);
      notifyTaskParticipants(recipients, push.buildMessage({
        title: 'Task status updated',
        body: `${actorName || req.user.email || 'Someone'} set "${push.truncate(result.description, 50)}" to ${status}`,
        link: `/dashboard/tasks/${id}`,
        type: 'task_status',
      }));
    });

    // Trigger AI Analysis if status is 'pending-review'
    if (status === 'pending-review') {
      try {
        const orgCheck = await pool.query(
          `SELECT "aiTaskCheckerEnabled" FROM organiation WHERE id = $1`,
          [req.user.organization_uuid]
        );
        const aiEnabled = orgCheck.rows[0]?.aiTaskCheckerEnabled;

        if (aiEnabled) {
          const AGENT_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:8000';
          const AGENT_KEY = process.env.AGENT_API_KEY || '';
          fetch(`${AGENT_URL}/tasks/analyze/${id}`, { 
            method: 'POST',
            headers: {
              'X-API-Key': AGENT_KEY
            }
          })
            .then(response => {
              if (!response.ok) {
                console.error(`AI Agent trigger failed for task ${id}:`, response.statusText);
              }
            })
            .catch(err => {
              console.error(`AI Agent connection error for task ${id}:`, err.message);
            });
        }
      } catch (err) {
        console.error('Error checking aiTaskCheckerEnabled:', err.message);
      }
    }
  } catch (error) {
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

    // Notify the new assignee (skip self-assignment)
    if (assignedTo && assignedTo !== req.user.user_uuid) {
      runPushHook('assignTask', async () => {
        notifyTaskParticipants([assignedTo], push.buildMessage({
          title: 'Task assigned',
          body: `You were assigned: "${push.truncate(result.rows[0].description)}"`,
          link: `/dashboard/tasks/${id}`,
          type: 'task_assigned',
        }));
      });
    }
  }
  catch (error) { next(error); }
};


/**
 * Get all tasks assigned to a specific employee.
 * Scoped to the requesting user's organization to prevent cross-org data leaks.
 */
const getTasksPerEmployee = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const organiationId = req.user.organization_uuid;
    const result = await pool.query(`
      SELECT t.*, e."firstName" as "creatorFirstName", e."lastName" as "creatorLastName"
      FROM task t
      JOIN projects p ON t."projectId" = p.id
      LEFT JOIN employee e ON t."createdBy"::uuid = e.id
      WHERE t."assignedTo" = $1 AND p."organiationId" = $2
      ORDER BY t."createdAt" DESC
    `, [userId, organiationId]);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

/** Reorder tasks by updating their order field in a single transaction. */
const reorderTasks = async (req, res, next) => {
  const { tasks } = req.body;
  const organiationId = req.user.organization_uuid;

  try {
    await withTransaction(pool.pool, async (client) => {
      // Single bulk UPDATE instead of one round trip per task.
      await client.query(
        `UPDATE task t SET "order" = v."order", "updatedAt" = NOW()
         FROM projects p,
              json_to_recordset($1::json) AS v(id uuid, "order" int)
         WHERE t.id = v.id AND t."projectId" = p.id AND p."organiationId" = $2`,
        [JSON.stringify(tasks || []), organiationId]
      );
    });
    res.json({ message: 'Tasks reordered' });
  } catch (error) {
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
  reorderTasks,
  createTaskFromGoogleForm
};