// performance/average-task-completion-time.js
const pool = require('../../config/db');

const getAverageTaskCompletionTime = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        e.id,
        e."firstName" || ' ' || e."lastName" AS name,
        AVG(EXTRACT(EPOCH FROM (t."updatedAt" - t.assigned_at)) * 1000)::bigint AS "averageCompletionTime"
      FROM employee e
      LEFT JOIN task t ON t."assignedTo" = e.id::text 
        AND t.status = 'completed' 
        AND t.assigned_at IS NOT NULL
        AND t."updatedAt" IS NOT NULL
      WHERE e."organiationId" = $1::uuid AND e.is_archived = false
      GROUP BY e.id
      HAVING COUNT(t.id) FILTER (WHERE t.status = 'completed') > 0
      ORDER BY "averageCompletionTime" DESC
    `, [req.user.organization_uuid]);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

const getRecentActivity = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        t.id,
        e."firstName" || ' ' || e."lastName" AS user,
        t."updatedAt" AS time,
        'updated task' AS action,
        t.description AS target
      FROM task t
      JOIN employee e ON t."createdBy"::uuid = e.id
      JOIN projects p ON t."projectId" = p.id
      WHERE p."organiationId" = $1::uuid
      UNION ALL
      SELECT 
        c.id,
        e."firstName" || ' ' || e."lastName" AS user,
        c."createdAt" AS time,
        'commented on' AS action,
        t.description AS target
      FROM comment c
      JOIN employee e ON c."authorId" = e.id
      JOIN task t ON c."taskId" = t.id
      JOIN projects p ON t."projectId" = p.id
      WHERE p."organiationId" = $1::uuid
      ORDER BY time DESC
      LIMIT 10
    `, [req.user.organization_uuid]);

    const formatted = result.rows.map(r => ({
      id: r.id,
      user: r.user,
      time: new Date(r.time).toLocaleString(),
      action: r.action,
      target: r.target
    }));

    res.json(formatted);
  } catch (error) {
    next(error);
  }
};


const getDashboardSummary = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT 
        (SELECT COUNT(*)::int FROM employee WHERE "organiationId" = $1::uuid AND is_archived = false) AS "totalEmployees",
        (SELECT COUNT(*)::int FROM projects WHERE "organiationId" = $1::uuid) AS "totalProjects",
        (SELECT COALESCE(SUM(points), 0)::int FROM task t 
         JOIN projects p ON t."projectId" = p.id 
         WHERE p."organiationId" = $1::uuid) AS "totalPoints",
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'status', t.status,
              '_count', json_build_object('status', COUNT(*)::int)
            )
          )
          FROM task t
          JOIN projects p ON t."projectId" = p.id
          WHERE p."organiationId" = $1::uuid
          GROUP BY t.status
        ), '[]'::json) AS "tasksByStatus"
    `, [req.user.organization_uuid]);

    const row = result.rows[0];
    row.tasksByStatus = row.tasksByStatus || [];

    res.json(row);
  } catch (error) {
    next(error);
  }
};

const getPointsLeaderboard = async (req, res, next) => {
    try {
        const result = await pool.query(`
      SELECT 
        e."firstName" || ' ' || e."lastName" AS name,
        COALESCE(SUM(t.points), 0)::int AS "totalPoints"
      FROM employee e
      LEFT JOIN task t ON t."assignedTo" = e.id::text AND t.status = 'completed'
      WHERE e."organiationId" = $1::uuid AND e.is_archived = false
      GROUP BY e.id
      ORDER BY "totalPoints" DESC
      LIMIT 10
    `, [req.user.organization_uuid]);

        res.json(result.rows);
    } catch (error) {
        next(error);
    }
};


const getProductivityTrend = async (req, res, next) => {
    try {
        const result = await pool.query(`
      SELECT 
        to_char(date_trunc('week', t."updatedAt"), 'YYYY-MM-DD') AS name,
        COALESCE(SUM(t.points), 0)::int AS points
      FROM task t
      JOIN projects p ON t."projectId" = p.id
      WHERE p."organiationId" = $1::uuid 
        AND t.status = 'completed'
        AND t."updatedAt" >= NOW() - INTERVAL '12 weeks'
      GROUP BY date_trunc('week', t."updatedAt")
      ORDER BY name
    `, [req.user.organization_uuid]);

        res.json(result.rows);
    } catch (error) {
        next(error);
    }
};


const getTaskCompletionRate = async (req, res, next) => {
    try {
        const result = await pool.query(`
      SELECT 
        e.id,
        e."firstName" || ' ' || e."lastName" AS name,
        CASE 
          WHEN COUNT(t.id) = 0 THEN 0
          ELSE ROUND(
            COUNT(t.id) FILTER (WHERE t.status = 'completed')::numeric / COUNT(t.id) * 100, 2
          )
        END AS "completionRate"
      FROM employee e
      LEFT JOIN task t ON t."assignedTo" = e.id::text
      WHERE e."organiationId" = $1::uuid AND e.is_archived = false
      GROUP BY e.id
      ORDER BY "completionRate" DESC
    `, [req.user.organization_uuid]);

        res.json(result.rows);
    } catch (error) {
        next(error);
    }
};



module.exports = {
    getAverageTaskCompletionTime,
    getPointsLeaderboard,
    getProductivityTrend,
    getTaskCompletionRate,
    getRecentActivity,
    getDashboardSummary
};