const pool = require('../../config/db');
const Joi = require('joi');
const { BadRequestError, NotFoundError } = require('../../utils/errors');


// Create Project
const createProject = async (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow(''),
    startDate: Joi.date().iso().required()
  });

  const { error } = schema.validate(req.body);
  if (error) return next(new BadRequestError(error.details[0].message));

  const { name, description, startDate, headId } = req.body;
  const organiationId = req.user.organization_uuid;

  try {
    const result = await pool.query(
      `INSERT INTO projects (name, description, "startDate", "organiationId", "headId")
             VALUES ($1, $2, $3, $4, $5) RETURNING id, name, description, "startDate", "headId"`,
      [name, description || '', startDate, organiationId, headId || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
};

// Get Single Project
const getProject = async (req, res, next) => {
  const { id } = req.params;
  const organiationId = req.user.organization_uuid;

  // Pagination parameters
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    const projectResult = await pool.query(
      `SELECT 
         p.id, 
         p.name, 
         p.description, 
         p."startDate", 
         p."createdAt", 
         p."updatedAt",
         p."headId",
         COALESCE(e."firstName" || ' ' || e."lastName", 'Unassigned') as "headName"
       FROM projects p
       LEFT JOIN employee e ON p."headId" = e.id
       WHERE p.id = $1::uuid AND p."organiationId" = $2::uuid `,
      [id, organiationId]
    );

    if (projectResult.rowCount === 0) {
      return next(new NotFoundError('Project not found'));
    }

    // Get total count of tasks
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM task WHERE "projectId" = $1::uuid`,
      [id]
    );
    const totalTasks = parseInt(countResult.rows[0].total);

    // Get paginated tasks
    const tasksResult = await pool.query(
      `SELECT 
         t.id,
         t.description,
         t.status,
         t.points,
         t."createdAt",
         t."updatedAt",
         COALESCE(e."firstName" || ' ' || e."lastName", 'Unassigned') AS "assignedToName"
       FROM task t
       LEFT JOIN employee e ON t."assignedTo"::uuid = e.id
       WHERE t."projectId" = $1::uuid
       ORDER BY t."createdAt" DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    const totalPages = Math.ceil(totalTasks / limit);

    res.json({
      ...projectResult.rows[0],
      tasks: tasksResult.rows,
      pagination: {
        totalTasks,
        currentPage: page,
        pageSize: limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get All Projects in Organization
const getProjects = async (req, res, next) => {
  const organiationId = req.user.organization_uuid;
  const { sortBy, sortOrder } = req.query;

  // Build ORDER BY clause
  const validSortColumns = {
    'name': 'p.name',
    'createdAt': 'p."createdAt"',
    'startDate': 'p."startDate"',
    'totalPoints': 'ps."totalPoints"',
    'yesterdayPoints': 'ps."yesterdayPoints"',
    'priority_order': 'p.priority_order'
  };

  let orderByClause = 'ORDER BY p.priority_order ASC NULLS LAST, ps."totalPoints" DESC, p."createdAt" DESC'; // default
  if (sortBy && validSortColumns[sortBy]) {
    const direction = sortOrder && sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    if (sortBy === 'priority_order') {
      // Special handling for priority_order to put nulls last when descending
      orderByClause = direction === 'ASC'
        ? `ORDER BY ${validSortColumns[sortBy]} ${direction} NULLS FIRST`
        : `ORDER BY ${validSortColumns[sortBy]} ${direction} NULLS LAST`;
    } else {
      orderByClause = `ORDER BY ${validSortColumns[sortBy]} ${direction}`;
    }

    // Add secondary sort for consistency
    if (sortBy !== 'createdAt') {
      orderByClause += `, p."createdAt" DESC`;
    }
  }

  try {
    const result = await pool.query(
      `WITH ProjectStats AS (
         SELECT 
             p.id,
             COALESCE(SUM(t.points), 0) as "totalPoints",
             COALESCE(SUM(CASE WHEN LOWER(t.status) IN ('done', 'completed') AND t."updatedAt"::date = (CURRENT_DATE - 1) THEN t.points ELSE 0 END), 0) as "yesterdayPoints"
         FROM projects p
         LEFT JOIN task t ON p.id = t."projectId"
         WHERE p."organiationId" = $1 AND p.is_archived = false
         GROUP BY p.id
       ),
       PerformerStats AS (
         SELECT 
             t."projectId",
             e."firstName",
             e."lastName",
             SUM(t.points) as points
         FROM task t
         JOIN employee e ON t."assignedTo"::uuid = e.id
         WHERE LOWER(t.status) IN ('done', 'completed')
         GROUP BY t."projectId", e.id, e."firstName", e."lastName"
       ),
       RankedPerformers AS (
         SELECT 
             "projectId",
             "firstName",
             "lastName",
             points,
             ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY points DESC) as rnk
         FROM PerformerStats
       )
       SELECT 
         p.id, 
         p.name, 
         p.description, 
         p."startDate", 
         p."createdAt",
         p.priority_order,
         p."headId",
         COALESCE(ph."firstName" || ' ' || ph."lastName", 'Unassigned') as "headName",
         ps."totalPoints",
         ps."yesterdayPoints",
         COALESCE((
           SELECT json_agg(json_build_object('name', rp."firstName", 'initial', SUBSTRING(rp."lastName", 1, 1), 'points', rp.points))
           FROM RankedPerformers rp
           WHERE rp."projectId" = p.id AND rp.rnk <= 3
         ), '[]'::json) as "topPerformers"
       FROM projects p
       JOIN ProjectStats ps ON p.id = ps.id
       LEFT JOIN employee ph ON p."headId" = ph.id
       WHERE p."organiationId" = $1 AND p.is_archived = false
       ${orderByClause}`,
      [organiationId]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

// Update Project
const updateProject = async (req, res, next) => {
  const { id } = req.params;
  const { name, description, startDate, headId } = req.body;
  const organiationId = req.user.organization_uuid;

  try {
    const result = await pool.query(
      `UPDATE projects SET name = $1, description = $2, "startDate" = $3, "headId" = $6, "updatedAt" = NOW()
             WHERE id = $4 AND "organiationId" = $5
             RETURNING id, name, description, "startDate", "headId"`,
      [name, description || '', startDate, id, organiationId, headId || null]
    );
    if (result.rowCount === 0) return next(new NotFoundError('Project not found'));
    res.json(result.rows[0]);
  } catch (error) { next(error); }
};

// Delete Project (soft or hard - adjust as needed)
const deleteProject = async (req, res, next) => {
  const { id } = req.params;
  const organiationId = req.user.organization_uuid;

  try {
    const result = await pool.query(
      `UPDATE projects SET is_archived = true, "updatedAt" = NOW()
             WHERE id = $1 AND "organiationId" = $2 RETURNING id`,
      [id, organiationId]
    );
    if (result.rowCount === 0) return next(new NotFoundError('Project not found'));
    res.json({ message: 'Project deleted' });
  } catch (error) { next(error); }
};

// Export Projects
const exportProjects = async (req, res, next) => {
  const organiationId = req.user.organization_uuid;
  try {
    const result = await pool.query(
      `WITH ProjectStats AS (
         SELECT 
             p.id,
             COALESCE(SUM(t.points), 0) as "totalPoints",
             COALESCE(SUM(CASE WHEN LOWER(t.status) IN ('done', 'completed') AND t."updatedAt"::date = (CURRENT_DATE - 1) THEN t.points ELSE 0 END), 0) as "yesterdayPoints"
         FROM projects p
         LEFT JOIN task t ON p.id = t."projectId"
         WHERE p."organiationId" = $1 AND p.is_archived = false
         GROUP BY p.id
       ),
       PerformerStats AS (
         SELECT 
             t."projectId",
             e."firstName",
             e."lastName",
             SUM(t.points) as points
         FROM task t
         JOIN employee e ON t."assignedTo"::uuid = e.id
         WHERE LOWER(t.status) IN ('done', 'completed')
         GROUP BY t."projectId", e.id, e."firstName", e."lastName"
       ),
       RankedPerformers AS (
         SELECT 
             "projectId",
             "firstName",
             "lastName",
             points,
             ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY points DESC) as rnk
         FROM PerformerStats
       )
       SELECT 
         p.id, 
         p.name, 
         p.description, 
         p."startDate", 
         p."createdAt",
         COALESCE(ph."firstName" || ' ' || ph."lastName", 'Unassigned') as "headName",
         ps."totalPoints",
         ps."yesterdayPoints",
         COALESCE((
           SELECT string_agg(rp."firstName" || ' ' || SUBSTRING(rp."lastName", 1, 1) || '. (' || rp.points || ' pts)', '; ')
           FROM RankedPerformers rp
           WHERE rp."projectId" = p.id AND rp.rnk <= 3
         ), '') as "topPerformers"
       FROM projects p
       JOIN ProjectStats ps ON p.id = ps.id
       LEFT JOIN employee ph ON p."headId" = ph.id
       WHERE p."organiationId" = $1 AND p.is_archived = false
       ORDER BY ps."totalPoints" DESC, p."createdAt" DESC`,
      [organiationId]
    );

    const projects = result.rows;

    // Convert to CSV
    const header = ['ID', 'Name', 'Description', 'Start Date', 'Head', 'Total Points', 'Yesterday Points', 'Top Performers', 'Created At'];
    const csvRows = [header.join(',')];

    projects.forEach(project => {
      const row = [
        project.id,
        `"${(project.name || '').replace(/"/g, '""')}"`,
        `"${(project.description || '').replace(/"/g, '""')}"`,
        project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '',
        `"${(project.headName || '').replace(/"/g, '""')}"`,
        project.totalPoints,
        project.yesterdayPoints,
        `"${(project.topPerformers || '').replace(/"/g, '""')}"`,
        project.createdAt ? new Date(project.createdAt).toISOString().split('T')[0] : ''
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="projects_export.csv"');
    res.send(csvContent);
  } catch (error) { next(error); }
};

// Export Tasks for a specific Project
const exportProjectTasks = async (req, res, next) => {
  const { id } = req.params;
  const organiationId = req.user.organization_uuid;

  try {
    // Verify project belongs to organization
    const projectCheck = await pool.query(
      'SELECT name FROM projects WHERE id = $1 AND "organiationId" = $2',
      [id, organiationId]
    );
    if (projectCheck.rowCount === 0) return next(new NotFoundError('Project not found'));
    const projectName = projectCheck.rows[0].name.replace(/[^a-zA-Z0-9]/g, '_');

    const result = await pool.query(
      `SELECT 
         t.description,
         t.status,
         t.points,
         COALESCE(e."firstName" || ' ' || e."lastName", 'Unassigned') AS "assignedToName"
       FROM task t
       LEFT JOIN employee e ON t."assignedTo"::uuid = e.id
       WHERE t."projectId" = $1
       ORDER BY t.status, t."createdAt" DESC`,
      [id]
    );

    const tasks = result.rows;

    // Convert to CSV
    const header = ['Description', 'Assigned To', 'Status', 'Points'];
    const csvRows = [header.join(',')];

    tasks.forEach(task => {
      const row = [
        `"${(task.description || '').replace(/"/g, '""')}"`,
        `"${(task.assignedToName || '').replace(/"/g, '""')}"`,
        task.status,
        task.points || 0
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${projectName}_tasks_export.csv"`);
    res.send(csvContent);
  } catch (error) { next(error); }
};

// Update Projects Priority Order
const updateProjectsPriority = async (req, res, next) => {
  const schema = Joi.object({
    projectPriorities: Joi.array().items(
      Joi.object({
        id: Joi.string().uuid().required(),
        priority_order: Joi.number().integer().required()
      })
    ).required()
  });

  const { error } = schema.validate(req.body);
  if (error) return next(new BadRequestError(error.details[0].message));

  const { projectPriorities } = req.body;
  const organiationId = req.user.organization_uuid;

  try {
    // Start transaction - pool is the module, pool.pool is the actual Pool instance
    const client = await pool.pool.connect();
    try {
      await client.query('BEGIN');

      // Verify all projects belong to the organization
      const projectIds = projectPriorities.map(p => p.id);
      const verifyResult = await client.query(
        `SELECT id FROM projects WHERE id = ANY($1::uuid[]) AND "organiationId" = $2::uuid`,
        [projectIds, organiationId]
      );

      if (verifyResult.rowCount !== projectIds.length) {
        await client.query('ROLLBACK');
        return next(new BadRequestError('One or more projects not found or unauthorized'));
      }

      // Update priorities
      for (const { id, priority_order } of projectPriorities) {
        await client.query(
          `UPDATE projects SET priority_order = $1, "updatedAt" = NOW() WHERE id = $2::uuid`,
          [priority_order, id]
        );
      }

      await client.query('COMMIT');
      res.json({ message: 'Project priorities updated successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProject,
  getProject,
  getProjects,
  updateProject,
  deleteProject,
  exportProjects,
  exportProjectTasks,
  updateProjectsPriority
};
