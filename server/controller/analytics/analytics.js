const pool = require('../../config/db');
const { BadRequestError, NotFoundError } = require('../../utils/errors');

// Get Projects at Risk
// Criteria: End date within 7 days OR tasks with passed due dates
const getProjectsAtRisk = async (req, res, next) => {
    const organizationId = req.user.organization_uuid;

    try {
        const result = await pool.query(
            `SELECT 
         p.id, 
         p.name, 
         p."endDate",
         COUNT(t.id) as "totalTasks",
         COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as "completedTasks",
         COUNT(CASE WHEN t."dueDate" < NOW() AND t.status != 'completed' THEN 1 END) as "overdueTasks"
       FROM projects p
       LEFT JOIN task t ON p.id = t."projectId"
       WHERE p."organiationId" = $1 AND p.is_archived = false
       GROUP BY p.id
       HAVING 
         (p."endDate" < NOW() + INTERVAL '7 days' AND p."endDate" > NOW()) 
         OR 
         COUNT(CASE WHEN t."dueDate" < NOW() AND t.status != 'completed' THEN 1 END) > 0`,
            [organizationId]
        );

        const projects = result.rows.map(p => ({
            ...p,
            riskFactor: p.overdueTasks > 0 ? 'High' : 'Medium',
            completionRate: p.totalTasks > 0 ? Math.round((p.completedTasks / p.totalTasks) * 100) : 0
        }));

        res.json(projects);
    } catch (error) {
        next(error);
    }
};

// Get Task Insights
const getTaskInsights = async (req, res, next) => {
    const organizationId = req.user.organization_uuid;

    try {
        // Avg Resolution Time (in hours)
        const resolutionTimeResult = await pool.query(
            `SELECT AVG(EXTRACT(EPOCH FROM (t."updatedAt" - t."createdAt"))/3600) as "avgResolutionHours"
       FROM task t
       JOIN projects p ON t."projectId" = p.id
       WHERE p."organiationId" = $1 AND t.status = 'completed'`,
            [organizationId]
        );

        // Stuck Tasks (not updated in > 5 days)
        const stuckTasksResult = await pool.query(
            `SELECT t.id, t.description, t.status, t."updatedAt", u."firstName", u."lastName"
       FROM task t
       JOIN projects p ON t."projectId" = p.id
       LEFT JOIN employee u ON t."assignedTo" = u.id::text
       WHERE p."organiationId" = $1 
         AND t.status != 'completed' 
         AND t."updatedAt" < NOW() - INTERVAL '5 days'`,
            [organizationId]
        );

        res.json({
            avgResolutionHours: Math.round(resolutionTimeResult.rows[0].avgResolutionHours || 0),
            stuckTasks: stuckTasksResult.rows
        });
    } catch (error) {
        next(error);
    }
};

// Get Employee Performance
const getEmployeePerformance = async (req, res, next) => {
    const organizationId = req.user.organization_uuid;

    try {
        const result = await pool.query(
            `SELECT 
         e.id, 
         e."firstName", 
         e."lastName", 
         e.position,
         
         -- Workload Breakdown
         COUNT(t.id) as "totalAssigned",
         COUNT(CASE WHEN LOWER(t.status) IN ('done', 'completed') THEN 1 END) as "completedTasks",
         COUNT(CASE WHEN LOWER(t.status) IN ('pending', 'todo', 'in-progress') THEN 1 END) as "pendingTasks",
         COUNT(CASE WHEN t."dueDate" < NOW() AND LOWER(t.status) NOT IN ('done', 'completed') THEN 1 END) as "overdueTasks",
         
         -- Points Analysis
         COALESCE(SUM(CASE WHEN LOWER(t.status) IN ('done', 'completed') THEN t.points ELSE 0 END), 0) as "totalPoints",
         COALESCE(SUM(CASE WHEN LOWER(t.status) IN ('done', 'completed') AND t."updatedAt" > NOW() - INTERVAL '30 days' THEN t.points ELSE 0 END), 0) as "pointsLast30Days",
         
         -- Efficiency Metric (Avg Completion Time in Hours)
         ROUND(AVG(CASE WHEN LOWER(t.status) IN ('done', 'completed') THEN EXTRACT(EPOCH FROM (t."updatedAt" - t."createdAt"))/3600 ELSE NULL END)::numeric, 1) as "avgCompletionTimeHours"

       FROM employee e
       LEFT JOIN task t ON e.id = t."assignedTo"::uuid
       WHERE e."organiationId" = $1 AND e.is_archived = false
       GROUP BY e.id
       ORDER BY "totalPoints" DESC`,
            [organizationId]
        );

        res.json(result.rows);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getProjectsAtRisk,
    getTaskInsights,
    getEmployeePerformance
};
