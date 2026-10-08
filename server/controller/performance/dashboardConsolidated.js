const pool = require('../../config/db');

/**
 * CONSOLIDATED DASHBOARD ENDPOINT
 * Returns ALL dashboard data in a single API call
 * Runs all queries in parallel for maximum performance
 */
const getDashboardAll = async (req, res, next) => {
  const orgId = req.user.organization_uuid;

  try {
    // Run ALL queries in parallel for speed
    const [
      summary,
      employeeCount,
      activeVsArchived,
      roleDistribution,
      projectsData,
      tasksByStatus,
      tasksPerEmployee,
      pointsLeaderboard,
      productivityTrend,
      taskCompletionRate,
      avgCompletionTime,
      recentActivity,
      taskPoints,
      activeProjectsThisWeek,
      monthlyProductivityTrend,
      projectsAtRisk,
      taskInsights,
      employeePerformance
    ] = await Promise.all([
      // 1. Dashboard Summary
      pool.query(`
        SELECT 
          (SELECT COUNT(*)::int FROM employee WHERE "organiationId" = $1::uuid AND is_archived = false) AS "totalEmployees",
          (SELECT COUNT(*)::int FROM projects WHERE "organiationId" = $1::uuid) AS "totalProjects",
          (SELECT COALESCE(SUM(points), 0)::int FROM task t 
           JOIN projects p ON t."projectId" = p.id 
           WHERE p."organiationId" = $1::uuid) AS "totalPoints"
      `, [orgId]),

      // 2. Employee Count Per Org
      pool.query(`
        SELECT o.name, COUNT(e.id)::int AS "employeeCount"
        FROM organiation o
        LEFT JOIN employee e ON e."organiationId" = o.id AND e.is_archived = false
        WHERE o.id = $1::uuid
        GROUP BY o.id, o.name
      `, [orgId]),

      // 3. Active vs Archived Employees
      Promise.all([
        pool.query('SELECT COUNT(*)::int as count FROM employee WHERE is_archived = false AND "organiationId" = $1', [orgId]),
        pool.query('SELECT COUNT(*)::int as count FROM employee WHERE is_archived = true AND "organiationId" = $1', [orgId])
      ]),

      // 4. Role Distribution
      pool.query(`
        SELECT role, COUNT(*)::int AS value
        FROM employee 
        WHERE is_archived = false AND "organiationId" = $1
        GROUP BY role
      `, [orgId]),

      // 5. Projects Per Org
      pool.query(`
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
      `, [orgId]),

      // 6. Tasks by Status
      pool.query(`
        SELECT status AS name, COUNT(*)::int AS count
        FROM task t
        JOIN projects p ON t."projectId" = p.id
        WHERE p."organiationId" = $1
        GROUP BY status
        ORDER BY status
      `, [orgId]),

      // 7. Tasks Per Employee
      pool.query(`
        SELECT 
          e."firstName" || ' ' || e."lastName" AS name,
          COUNT(t.id)::int AS "taskCount",
          COALESCE(SUM(
            CASE 
              WHEN t.type = 'SHARED' THEN 
                t.points / GREATEST((SELECT COUNT(*) FROM task_assignee ta WHERE ta."taskId" = t.id), 1)
              ELSE 
                t.points 
            END
          ), 0)::int AS "totalPoints"
        FROM employee e
        LEFT JOIN task t ON (t."assignedTo" = e.id::text OR (t.type = 'SHARED' AND EXISTS (SELECT 1 FROM task_assignee ta WHERE ta."taskId" = t.id AND ta."employeeId" = e.id)))
        WHERE e."organiationId" = $1::uuid AND e.is_archived = false
        GROUP BY e.id
        ORDER BY "totalPoints" DESC
      `, [orgId]),

      // 8. Points Leaderboard
      pool.query(`
        SELECT 
          e."firstName" || ' ' || e."lastName" AS name,
          COALESCE(SUM(
            CASE 
              WHEN t.type = 'SHARED' THEN 
                t.points / GREATEST((SELECT COUNT(*) FROM task_assignee ta WHERE ta."taskId" = t.id), 1)
              ELSE 
                t.points 
            END
          ), 0)::int AS "totalPoints"
        FROM employee e
        LEFT JOIN task t ON (t."assignedTo" = e.id::text OR (t.type = 'SHARED' AND EXISTS (SELECT 1 FROM task_assignee ta WHERE ta."taskId" = t.id AND ta."employeeId" = e.id)))
        WHERE e."organiationId" = $1::uuid AND e.is_archived = false AND t.status = 'completed'
        GROUP BY e.id
        ORDER BY "totalPoints" DESC
        LIMIT 10
      `, [orgId]),

      // 9. Productivity Trend (12 weeks)
      pool.query(`
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
      `, [orgId]),

      // 10. Task Completion Rate
      pool.query(`
        SELECT 
          e.id,
          e."firstName" || ' ' || e."lastName" AS name,
          CASE 
            WHEN COUNT(t.id) = 0 THEN 0
            ELSE ROUND(
              COUNT(t.id) FILTER (WHERE LOWER(t.status) IN ('done', 'completed'))::numeric / COUNT(t.id) * 100, 2
            )::float
          END AS "completionRate"
        FROM employee e
        LEFT JOIN task t ON (t."assignedTo" = e.id::text OR (t.type = 'SHARED' AND EXISTS (SELECT 1 FROM task_assignee ta WHERE ta."taskId" = t.id AND ta."employeeId" = e.id)))
        WHERE e."organiationId" = $1::uuid AND e.is_archived = false
        GROUP BY e.id
        ORDER BY "completionRate" DESC
      `, [orgId]),

      // 11. Average Task Completion Time
      pool.query(`
        SELECT 
          e.id,
          e."firstName" || ' ' || e."lastName" AS name,
          AVG(EXTRACT(EPOCH FROM (t."updatedAt" - t.assigned_at)) * 1000)::bigint AS "averageCompletionTime"
        FROM employee e
        LEFT JOIN task t ON (t."assignedTo" = e.id::text OR (t.type = 'SHARED' AND EXISTS (SELECT 1 FROM task_assignee ta WHERE ta."taskId" = t.id AND ta."employeeId" = e.id)))
        WHERE e."organiationId" = $1::uuid AND e.is_archived = false
          AND t.status = 'completed' 
          AND t.assigned_at IS NOT NULL
          AND t."updatedAt" IS NOT NULL
        GROUP BY e.id
        HAVING COUNT(t.id) FILTER (WHERE t.status = 'completed') > 0
        ORDER BY "averageCompletionTime" DESC
      `, [orgId]),

      // 12. Recent Activity
      pool.query(`
        SELECT 
          t.id,
          COALESCE(e."firstName" || ' ' || e."lastName", 'Unknown User') AS user,
          COALESCE(t."updatedAt", t."createdAt") AS time,
          CASE 
             WHEN LOWER(t.status) IN ('done', 'completed') THEN 'completed task' 
             ELSE 'updated task' 
          END AS action,
          t.description AS target
        FROM task t
        LEFT JOIN employee e ON t."assignedTo"::uuid = e.id
        JOIN projects p ON t."projectId" = p.id
        WHERE p."organiationId" = $1::uuid
        
        UNION ALL
        
        SELECT 
          c.id,
          COALESCE(e."firstName" || ' ' || e."lastName", 'Unknown User') AS user,
          c."createdAt" AS time,
          'commented on' AS action,
          t.description AS target
        FROM comment c
        LEFT JOIN employee e ON c."authorId"::uuid = e.id
        JOIN task t ON c."taskId" = t.id
        JOIN projects p ON t."projectId" = p.id
        WHERE p."organiationId" = $1::uuid
        
        ORDER BY time DESC
        LIMIT 10
      `, [orgId]),

      // 13. Task Points (Project x Employee matrix)
      pool.query(`
        SELECT 
          p.name,
          e."firstName" || ' ' || e."lastName" AS employee,
          COALESCE(SUM(
            CASE 
              WHEN t.type = 'SHARED' THEN 
                t.points / GREATEST((SELECT COUNT(*) FROM task_assignee ta WHERE ta."taskId" = t.id), 1)
              ELSE 
                t.points 
            END
          ), 0)::int AS points
        FROM projects p
        CROSS JOIN employee e
        LEFT JOIN task t ON t."projectId" = p.id AND (t."assignedTo" = e.id::text OR (t.type = 'SHARED' AND EXISTS (SELECT 1 FROM task_assignee ta WHERE ta."taskId" = t.id AND ta."employeeId" = e.id)))
        WHERE p."organiationId" = $1::uuid 
          AND e."organiationId" = $1::uuid 
          AND e.is_archived = false
        GROUP BY p.id, p.name, e.id
        ORDER BY p.name, e."firstName"
      `, [orgId]),

      // 14. Active Projects This Week
      pool.query(`
        SELECT 
          p.id,
          p.name,
          COUNT(t.id)::int AS "activityCount",
          COUNT(t.id) FILTER (WHERE t.status = 'completed')::int AS "completedTasks",
          COUNT(t.id) FILTER (WHERE t.status != 'completed')::int AS "ongoingTasks"
        FROM projects p
        JOIN task t ON t."projectId" = p.id
        WHERE p."organiationId" = $1::uuid
          AND (t."updatedAt" >= NOW() - INTERVAL '7 days' OR t."createdAt" >= NOW() - INTERVAL '7 days')
        GROUP BY p.id, p.name
        ORDER BY "activityCount" DESC
      `, [orgId]),

      // 15. Monthly Productivity Trend (points per month, last 12 months)
      pool.query(`
        SELECT 
          to_char(date_trunc('month', t."updatedAt"), 'Mon YYYY') AS name,
          COALESCE(SUM(t.points), 0)::int AS points,
          COUNT(t.id)::int AS "taskCount"
        FROM task t
        JOIN projects p ON t."projectId" = p.id
        WHERE p."organiationId" = $1::uuid 
          AND t.status = 'completed'
          AND t."updatedAt" >= NOW() - INTERVAL '12 months'
        GROUP BY date_trunc('month', t."updatedAt")
        ORDER BY date_trunc('month', t."updatedAt")
      `, [orgId]),

      // 16. Projects at Risk
      pool.query(`
        SELECT 
          p.id, 
          p.name, 
          p."endDate",
          COUNT(t.id) as "totalTasks",
          COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as "completedTasks",
          COUNT(CASE WHEN t."dueDate" < $2::timestamp AND t.status != 'completed' THEN 1 END) as "overdueTasks"
        FROM projects p
        LEFT JOIN task t ON p.id = t."projectId"
        WHERE p."organiationId" = $1 AND p.is_archived = false
        GROUP BY p.id
        HAVING 
          (p."endDate" < $2::timestamp + INTERVAL '7 days' AND p."endDate" > $2::timestamp) 
          OR 
          COUNT(CASE WHEN t."dueDate" < $2::timestamp AND t.status != 'completed' THEN 1 END) > 0`,
        [orgId, new Date().toISOString()]
      ),

      // 17. Task Insights (avg resolution time + stuck tasks)
      Promise.all([
        pool.query(
          `SELECT AVG(EXTRACT(EPOCH FROM (t."updatedAt" - t."createdAt"))/3600) as "avgResolutionHours"
           FROM task t
           JOIN projects p ON t."projectId" = p.id
           WHERE p."organiationId" = $1 AND t.status = 'completed'`,
          [orgId]
        ),
        pool.query(
          `SELECT t.id, t.description, t.status, t."updatedAt", u."firstName", u."lastName", u.id as "userId", p.id as "projectId"
           FROM task t
           JOIN projects p ON t."projectId" = p.id
           LEFT JOIN employee u ON t."assignedTo" = u.id::text
           WHERE p."organiationId" = $1 
             AND t.status != 'completed' 
             AND t."updatedAt" < $2::timestamp - INTERVAL '5 days'`,
          [orgId, new Date().toISOString()]
        ),
      ]),

      // 18. Employee Performance (workload + points + efficiency)
      pool.query(`
        SELECT 
          e.id, 
          e."firstName", 
          e."lastName", 
          e.position,
          e.image,
          COUNT(t.id) as "totalAssigned",
          COUNT(CASE WHEN LOWER(t.status) IN ('done', 'completed') THEN 1 END) as "completedTasks",
          COUNT(CASE WHEN LOWER(t.status) IN ('pending', 'todo', 'in-progress') THEN 1 END) as "pendingTasks",
          COUNT(CASE WHEN t."dueDate" < $2::timestamp AND LOWER(t.status) NOT IN ('done', 'completed') THEN 1 END) as "overdueTasks",
          COALESCE(SUM(CASE WHEN LOWER(t.status) IN ('done', 'completed') THEN t.points ELSE 0 END), 0) as "totalPoints",
          COALESCE(SUM(CASE WHEN LOWER(t.status) IN ('done', 'completed') AND t."updatedAt" > $2::timestamp - INTERVAL '30 days' THEN t.points ELSE 0 END), 0) as "pointsLast30Days",
          ROUND(AVG(CASE WHEN LOWER(t.status) IN ('done', 'completed') THEN EXTRACT(EPOCH FROM (t."updatedAt" - t."createdAt"))/3600 ELSE NULL END)::numeric, 1) as "avgCompletionTimeHours"
        FROM employee e
        LEFT JOIN task t ON e.id = t."assignedTo"::uuid
        WHERE e."organiationId" = $1 AND e.is_archived = false
        GROUP BY e.id
        ORDER BY "totalPoints" DESC`,
        [orgId, new Date().toISOString()]
      ),
    ]);

    // Process Active vs Archived
    const activeVsArchivedData = [
      { name: 'Active', value: activeVsArchived[0].rows[0].count },
      { name: 'Archived', value: activeVsArchived[1].rows[0].count }
    ];

    // Process Role Distribution
    const roleDistributionData = roleDistribution.rows.map(r => ({
      name: r.role,
      value: r.value
    }));

    // Process Recent Activity
    const recentActivityData = recentActivity.rows.map(r => ({
      id: r.id,
      user: r.user,
      time: new Date(r.time).toLocaleString(),
      action: r.action,
      target: r.target
    }));

    // Process Task Points (matrix format)
    const taskPointsProjects = [...new Set(taskPoints.rows.map(r => r.name))];
    const taskPointsEmployees = [...new Set(taskPoints.rows.map(r => r.employee))];
    const taskPointsData = taskPointsProjects.map(name => {
      const obj = { name };
      taskPoints.rows
        .filter(r => r.name === name)
        .forEach(r => { obj[r.employee] = r.points; });
      return obj;
    });

    // Process Projects at Risk (add derived fields)
    const projectsAtRiskData = projectsAtRisk.rows.map(p => ({
      ...p,
      riskFactor: p.overdueTasks > 0 ? 'High' : 'Medium',
      completionRate: p.totalTasks > 0 ? Math.round((p.completedTasks / p.totalTasks) * 100) : 0
    }));

    // Process Task Insights
    const taskInsightsData = {
      avgResolutionHours: Math.round(taskInsights[0].rows[0].avgResolutionHours || 0),
      stuckTasks: taskInsights[1].rows
    };

    // Process Monthly Productivity Trend (analysis metrics)
    const monthlyTrendRows = monthlyProductivityTrend.rows;
    let monthlyTrendAnalysis = null;
    if (monthlyTrendRows.length > 0) {
      const totalPoints = monthlyTrendRows.reduce((sum, row) => sum + row.points, 0);
      const avgPoints = Math.round(totalPoints / monthlyTrendRows.length);
      const bestMonth = monthlyTrendRows.reduce((max, row) => row.points > max.points ? row : max, monthlyTrendRows[0]);
      const worstMonth = monthlyTrendRows.reduce((min, row) => row.points < min.points ? row : min, monthlyTrendRows[0]);
      let trend = 0;
      if (monthlyTrendRows.length >= 2 && monthlyTrendRows[0].points > 0) {
        trend = Math.round(((monthlyTrendRows[monthlyTrendRows.length - 1].points - monthlyTrendRows[0].points) / monthlyTrendRows[0].points) * 100);
      }
      monthlyTrendAnalysis = {
        avgPoints,
        trend,
        bestMonth: { name: bestMonth.name, points: bestMonth.points },
        worstMonth: { name: worstMonth.name, points: worstMonth.points },
        totalTasks: monthlyTrendRows.reduce((sum, row) => sum + row.taskCount, 0)
      };
    }

    // Construct consolidated response
    const response = {
      summary: {
        totalEmployees: summary.rows[0].totalEmployees,
        totalProjects: summary.rows[0].totalProjects,
        totalPoints: summary.rows[0].totalPoints,
        tasksTodo: tasksByStatus.rows.find(r => r.name === 'pending')?.count || 0
      },
      employeeCount: employeeCount.rows,
      activeVsArchived: activeVsArchivedData,
      roleDistribution: roleDistributionData,
      projectsPerOrg: projectsData.rows,
      tasksByStatus: tasksByStatus.rows,
      tasksPerEmployee: tasksPerEmployee.rows,
      pointsLeaderboard: pointsLeaderboard.rows,
      productivityTrend: productivityTrend.rows,
      taskCompletionRate: taskCompletionRate.rows,
      averageCompletionTime: avgCompletionTime.rows,
      recentActivity: recentActivityData,
      taskPoints: {
        data: taskPointsData,
        employees: taskPointsEmployees
      },
      activeProjectsThisWeek: activeProjectsThisWeek.rows,
      monthlyProductivityTrend: {
        data: monthlyTrendRows,
        analysis: monthlyTrendAnalysis
      },
      projectsAtRisk: projectsAtRiskData,
      taskInsights: taskInsightsData,
      employeePerformance: employeePerformance.rows
    };

    res.json(response);
  } catch (error) {
    console.error('Dashboard consolidation error:', error);
    next(error);
  }
};

module.exports = {
  getDashboardAll
};
