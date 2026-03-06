// loginPopupData.js - Returns star performer + personalized tips for the login popup
const pool = require('../../config/db');

const PLATFORM_TIPS = [
  { type: 'platform', message: 'Always comment properly on your tasks to keep the team informed.', icon: 'message' },
  { type: 'platform', message: 'Break down large tasks into smaller subtasks for better tracking.', icon: 'check' },
  { type: 'platform', message: 'Log your tasks daily to maintain an accurate productivity trend.', icon: 'calendar' },
  { type: 'platform', message: 'Set realistic due dates to avoid task backlogs.', icon: 'calendar' },
  { type: 'platform', message: 'Collaborate with team members on SHARED tasks for faster completion.', icon: 'star' },
  { type: 'platform', message: 'Use the "Pinned Notes" feature to keep important project details at your fingertips.', icon: 'star' },
  { type: 'platform', message: 'Update your task status as soon as you progress to keep team dashboards accurate.', icon: 'check' },
  { type: 'platform', message: 'Attach relevant docs or links to your tasks for easier context sharing.', icon: 'message' },
  { type: 'platform', message: 'Use specific and descriptive task titles to help the team understand the scope.', icon: 'target' },
  { type: 'platform', message: 'Prioritize tasks by urgency and importance to maximize your daily impact.', icon: 'calendar' },
  { type: 'platform', message: 'Take short breaks between intense task blocks to maintain long-term focus.', icon: 'target' },
  { type: 'platform', message: 'Mention colleagues in comments if you need their input on a specific task.', icon: 'message' },
  { type: 'platform', message: 'Ensure your profile is up to date with a professional photo for better recognition.', icon: 'star' },
  { type: 'platform', message: 'Mark task dependencies clearly to help the team manage complex project flows.', icon: 'check' },
];

/**
 * GET /performance/login-popup-data
 * Returns last month's star performer (org-wide) and the current employee's
 * performance tips based on their last-month activity.
 *
 * Tip criteria (last calendar month):
 *  - Avg daily points < 8  → suggest completing 8 pts/day
 *  - Days with at least one task logged < 80% of working days → suggest daily task logging
 *  - % of tasks with comments < 50%  → suggest proper commenting
 *  - Completion rate < 70% → suggest focusing on completion
 */
const getLoginPopupData = async (req, res, next) => {
  const orgId = req.user.organization_uuid;
  const employeeId = req.user.user_uuid;

  try {
    const [starResult, myStatsResult, commentStatsResult] = await Promise.all([
      // 1. Star performer: employee in this org with most points completed last calendar month
      pool.query(
        `SELECT
           e."firstName" || ' ' || e."lastName" AS name,
           e.image,
           COALESCE(SUM(
             CASE
               WHEN t.type::text IN ('SHARED', 'SEQUENTIAL') THEN
                 t.points / GREATEST((SELECT COUNT(*) FROM "TaskAssignee" ta WHERE ta."taskId" = t.id), 1)
               ELSE t.points
             END
           ), 0)::int AS points
         FROM employee e
         LEFT JOIN task t ON (
           (t.type::text = 'SINGLE' AND t."assignedTo" = e.id::text) OR
           (t.type::text IN ('SHARED', 'SEQUENTIAL') AND EXISTS (
             SELECT 1 FROM "TaskAssignee" ta WHERE ta."taskId" = t.id AND ta."employeeId" = e.id
           ))
         )
           AND LOWER(t.status) IN ('done', 'completed')
           AND t."completedAt" >= date_trunc('month', NOW() - INTERVAL '1 month')
           AND t."completedAt" < date_trunc('month', NOW())
         WHERE e."organiationId" = $1 AND e.is_archived = false
         GROUP BY e.id, e."firstName", e."lastName", e.image
         ORDER BY points DESC
         LIMIT 1`,
        [orgId]
      ),

      // 2. Current employee's last-month points/day and task creation stats
      pool.query(
        `SELECT
           -- Total points earned last month
           COALESCE(SUM(
             CASE
               WHEN t.type::text IN ('SHARED', 'SEQUENTIAL') THEN
                 t.points / GREATEST((SELECT COUNT(*) FROM "TaskAssignee" ta WHERE ta."taskId" = t.id), 1)
               ELSE t.points
             END
           ), 0)::float AS "totalPoints",
           -- Distinct days where at least one task was completed
           COUNT(DISTINCT date_trunc('day', t."completedAt"))::int AS "activeDays",
           -- Total completed tasks
           COUNT(t.id)::int AS "completedTasks",
           -- Total assigned tasks (to calculate completion rate)
           (SELECT COUNT(*)::int
            FROM task t2
            WHERE (t2."assignedTo" = $1::text OR EXISTS (
              SELECT 1 FROM "TaskAssignee" ta2 WHERE ta2."taskId" = t2.id AND ta2."employeeId" = $1::uuid
            ))
            AND t2."createdAt" >= date_trunc('month', NOW() - INTERVAL '1 month')
            AND t2."createdAt" < date_trunc('month', NOW())
           ) AS "totalAssigned"
         FROM task t
         WHERE (
           (t.type::text = 'SINGLE' AND t."assignedTo" = $1::text) OR
           (t.type::text IN ('SHARED', 'SEQUENTIAL') AND EXISTS (
             SELECT 1 FROM "TaskAssignee" ta WHERE ta."taskId" = t.id AND ta."employeeId" = $1::uuid
           ))
         )
           AND LOWER(t.status) IN ('done', 'completed')
           AND t."completedAt" >= date_trunc('month', NOW() - INTERVAL '1 month')
           AND t."completedAt" < date_trunc('month', NOW())`,
        [employeeId]
      ),

      // 3. Task comment stats for current employee last month
      pool.query(
        `SELECT
           COUNT(DISTINCT t.id)::int AS "tasksWithComments",
           COUNT(DISTINCT t.id) FILTER (
             WHERE EXISTS (SELECT 1 FROM comment c WHERE c."taskId" = t.id)
           )::int AS "tasksWithActualComments"
         FROM task t
         WHERE (
           (t.type::text = 'SINGLE' AND t."assignedTo" = $1::text) OR
           (t.type::text IN ('SHARED', 'SEQUENTIAL') AND EXISTS (
             SELECT 1 FROM "TaskAssignee" ta WHERE ta."taskId" = t.id AND ta."employeeId" = $1::uuid
           ))
         )
           AND t."createdAt" >= date_trunc('month', NOW() - INTERVAL '1 month')
           AND t."createdAt" < date_trunc('month', NOW())`,
        [employeeId]
      )
    ]);

    // --- Process star performer ---
    const starPerformer = starResult.rows.length > 0 && starResult.rows[0].points > 0
      ? { name: starResult.rows[0].name, points: starResult.rows[0].points, image: starResult.rows[0].image }
      : null;

    // --- Process employee stats ---
    const stats = myStatsResult.rows[0] || {};
    const commentStats = commentStatsResult.rows[0] || {};

    const totalPoints = parseFloat(stats.totalPoints) || 0;
    const activeDays = parseInt(stats.activeDays) || 0;
    const completedTasks = parseInt(stats.completedTasks) || 0;
    const totalAssigned = parseInt(stats.totalAssigned) || 0;
    const tasksWithComments = parseInt(commentStats.tasksWithActualComments) || 0;
    const totalTasksLastMonth = parseInt(commentStats.tasksWithComments) || 0;

    // Working days in last month (approximate: calendar days minus weekends)
    const lastMonth = new Date();
    lastMonth.setDate(1);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const daysInLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).getDate();
    const approxWorkingDays = Math.round(daysInLastMonth * 5 / 7);

    const avgPointsPerDay = activeDays > 0 ? (totalPoints / activeDays) : 0;
    const completionRate = totalAssigned > 0 ? (completedTasks / totalAssigned) * 100 : 100;
    const commentRate = totalTasksLastMonth > 0 ? (tasksWithComments / totalTasksLastMonth) * 100 : 100;
    const taskCreationRate = approxWorkingDays > 0 ? (activeDays / approxWorkingDays) * 100 : 100;

    // --- Generate tips ---
    const tips = [];

    if (avgPointsPerDay < 8) {
      tips.push({
        type: 'points',
        message: `Your average was ${avgPointsPerDay.toFixed(1)} pts/day last month. Aim for at least 8 points per day.`,
        icon: 'target'
      });
    }

    if (taskCreationRate < 80) {
      tips.push({
        type: 'consistency',
        message: `You logged tasks on only ${activeDays} of ~${approxWorkingDays} working days. Try to log tasks every working day.`,
        icon: 'calendar'
      });
    }

    if (commentRate < 50) {
      tips.push({
        type: 'comments',
        message: `Only ${Math.round(commentRate)}% of your tasks had comments. Add proper updates and comments to keep everyone informed.`,
        icon: 'message'
      });
    }

    if (completionRate < 70 && totalAssigned > 0) {
      tips.push({
        type: 'completion',
        message: `Your task completion rate was ${Math.round(completionRate)}% last month. Focus on completing tasks before picking up new ones.`,
        icon: 'check'
      });
    }

    // If they did great, give a positive message
    if (tips.length === 0) {
      tips.push({
        type: 'great',
        message: `Excellent work last month! Keep up the momentum — consistency is the key to staying at the top.`,
        icon: 'star'
      });
    }

    const randomPlatformTip = PLATFORM_TIPS[Math.floor(Math.random() * PLATFORM_TIPS.length)];

    res.json({
      starPerformer,
      myStats: {
        avgPointsPerDay: parseFloat(avgPointsPerDay.toFixed(1)),
        activeDays,
        completedTasks,
        totalAssigned,
        completionRate: parseFloat(completionRate.toFixed(1)),
        commentRate: parseFloat(commentRate.toFixed(1)),
        tips,
        randomPlatformTip
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getLoginPopupData };
