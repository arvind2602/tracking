const pool = require('../../config/db');
const { BadRequestError } = require('../../utils/errors');

const getActiveVsArchivedEmployees = async (req, res, next) => {
  try {
    const [activeResult, archivedResult] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM employee WHERE is_archived = false AND "organiationId" = $1', [req.user.organization_uuid]),
      pool.query('SELECT COUNT(*) FROM employee WHERE is_archived = true AND "organiationId" = $1', [req.user.organization_uuid]),
    ]);

    const active = parseInt(activeResult.rows[0].count, 10);
    const archived = parseInt(archivedResult.rows[0].count, 10);

    const data = [
      { name: 'Active', value: active },
      { name: 'Archived', value: archived },
    ];

    res.json(data);
  } catch (error) {
    next(error);
  }
};
const getEmployeeCountPerOrg = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT o.name, COUNT(e.id) AS "employeeCount"
      FROM organiation o
      LEFT JOIN employee e ON e."organiationId" = o.id AND e.is_archived = false
      GROUP BY o.id, o.name
      ORDER BY o.name
    `);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};


const getRoleDistribution = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT role, COUNT(*) AS value
      FROM employee 
      WHERE is_archived = false 
      AND "organiationId" = $1
      GROUP BY role
    `, [req.user.organization_uuid]);

    const data = result.rows.map(r => ({ name: r.role, value: parseInt(r.value) }));
    res.json(data);
  } catch (error) {
    next(error);
  }
};

const getTaskPoints = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.name,
        e."firstName" || ' ' || e."lastName" AS employee,
        COALESCE(SUM(t.points), 0) AS points
      FROM projects p
      CROSS JOIN employee e
      LEFT JOIN task t ON t."projectId" = p.id AND t."assignedTo" = e.id::text
      WHERE p."organiationId" = $1::uuid 
        AND e."organiationId" = $1::uuid 
        AND e.is_archived = false
      GROUP BY p.id, p.name, e.id
      ORDER BY p.name, e."firstName"
    `, [req.user.organization_uuid]);

    const projects = [...new Set(result.rows.map(r => r.name))];
    const employees = [...new Set(result.rows.map(r => r.employee))];

    const data = projects.map(name => {
      const obj = { name };
      result.rows
        .filter(r => r.name === name)
        .forEach(r => { obj[r.employee] = parseInt(r.points); });
      return obj;
    });

    res.json({ data, employees });
  } catch (error) {
    next(error);
  }
};


const getTasksByStatus = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT status AS name, COUNT(*)::int AS count
      FROM task t
      JOIN projects p ON t."projectId" = p.id
      WHERE p."organiationId" = $1
      GROUP BY status
      ORDER BY status
    `, [req.user.organization_uuid]);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};


const getTasksPerEmployee = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        e."firstName" || ' ' || e."lastName" AS name,
        COUNT(t.id)::int AS "taskCount",
        COALESCE(SUM(t.points), 0)::int AS "totalPoints"
      FROM employee e
      LEFT JOIN task t ON t."assignedTo" = e.id::text
      WHERE e."organiationId" = $1::uuid AND e.is_archived = false
      GROUP BY e.id
      ORDER BY "totalPoints" DESC
    `, [req.user.organization_uuid]);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const getProjectsPerOrg = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        o.name, 
        COALESCE(
          json_agg(
            json_build_object(
              'id', p.id,
              'name', p.name,
              'progress', (
                SELECT COALESCE(ROUND(COUNT(t.id) FILTER (WHERE LOWER(t.status) IN ('done', 'completed'))::numeric / NULLIF(COUNT(t.id), 0) * 100), 0)
                FROM task t WHERE t."projectId" = p.id
              )
            ) ORDER BY p.name
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) AS projects
      FROM organiation o
      LEFT JOIN projects p ON p."organiationId" = o.id
      WHERE o.id = $1::uuid
      GROUP BY o.id, o.name
      ORDER BY o.name
    `, [req.user.organization_uuid]);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};


module.exports = {
  getActiveVsArchivedEmployees,
  getEmployeeCountPerOrg,
  getRoleDistribution,
  getTaskPoints,
  getTasksByStatus,
  getTasksPerEmployee,
  getProjectsPerOrg,
};