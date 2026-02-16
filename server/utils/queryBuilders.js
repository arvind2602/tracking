/**
 * Shared SQL CTE builders to eliminate query duplication across controllers.
 * Each builder returns a SQL fragment that can be composed into larger queries.
 */

/**
 * Builds the WeeklyStats CTE for employee performance calculation.
 * Handles SINGLE, SHARED, and SEQUENTIAL task types with proportional point division.
 * @param {string} orgParamRef - The SQL parameter reference (e.g., '$1')
 * @returns {string} SQL CTE fragment
 */
const buildWeeklyStatsCTE = (orgParamRef) => `
  WeeklyStats AS (
    SELECT 
      e.id,
      COALESCE(SUM(
        CASE 
          WHEN t.type::text IN ('SHARED', 'SEQUENTIAL') THEN 
            t.points / GREATEST((SELECT COUNT(*) FROM "TaskAssignee" ta WHERE ta."taskId" = t.id), 1)
          ELSE t.points 
        END
      ), 0) as "weeklyPoints"
    FROM employee e
    LEFT JOIN task t ON (
      (t.type::text = 'SINGLE' AND t."assignedTo"::uuid = e.id) OR 
      (t.type::text IN ('SHARED', 'SEQUENTIAL') AND EXISTS (
        SELECT 1 FROM "TaskAssignee" ta WHERE ta."taskId" = t.id AND ta."employeeId" = e.id
      ))
    )
      AND LOWER(t.status) IN ('done', 'completed')
      AND t."completedAt" >= NOW() - INTERVAL '7 days'
    WHERE e."organiationId" = ${orgParamRef}
    GROUP BY e.id
  )`;

/**
 * Builds the YesterdayStats CTE for daily employee performance.
 * @param {string} orgParamRef - The SQL parameter reference (e.g., '$1')
 * @returns {string} SQL CTE fragment
 */
const buildYesterdayStatsCTE = (orgParamRef) => `
  YesterdayStats AS (
    SELECT 
      e.id,
      COALESCE(SUM(
        CASE 
          WHEN LOWER(t.status) IN ('done', 'completed') 
               AND t."completedAt" >= CURRENT_DATE - INTERVAL '1 day' 
               AND t."completedAt" < CURRENT_DATE THEN
            CASE 
              WHEN t.type::text IN ('SHARED', 'SEQUENTIAL') THEN 
                t.points / GREATEST((SELECT COUNT(*) FROM "TaskAssignee" ta WHERE ta."taskId" = t.id), 1)
              ELSE t.points 
            END
          ELSE 0
        END
      ), 0) as "yesterdayPoints",
      COUNT(t.id) as "yesterdayTaskCount"
    FROM employee e
    LEFT JOIN task t ON (
      (t.type::text = 'SINGLE' AND t."assignedTo"::uuid = e.id) OR 
      (t.type::text IN ('SHARED', 'SEQUENTIAL') AND EXISTS (
        SELECT 1 FROM "TaskAssignee" ta WHERE ta."taskId" = t.id AND ta."employeeId" = e.id
      ))
    )
      AND LOWER(t.status) IN ('done', 'completed')
      AND t."completedAt" >= CURRENT_DATE - INTERVAL '1 day'
      AND t."completedAt" < CURRENT_DATE
    WHERE e."organiationId" = ${orgParamRef}
    GROUP BY e.id
  )`;

/**
 * Builds the ProjectStats CTE for project performance metrics.
 * @param {string} orgParamRef - The SQL parameter reference (e.g., '$1')
 * @returns {string} SQL CTE fragment
 */
const buildProjectStatsCTE = (orgParamRef) => `
  ProjectStats AS (
    SELECT 
      p.id,
      COALESCE(SUM(t.points), 0) as "totalPoints",
      COALESCE(SUM(CASE WHEN LOWER(t.status) IN ('done', 'completed') 
        AND t."updatedAt"::date = (CURRENT_DATE - 1) THEN t.points ELSE 0 END), 0) as "yesterdayPoints"
    FROM projects p
    LEFT JOIN task t ON p.id = t."projectId"
    WHERE p."organiationId" = ${orgParamRef} AND p.is_archived = false
    GROUP BY p.id
  )`;

/**
 * Builds the PerformerStats + RankedPerformers CTEs for top performer ranking.
 * @returns {string} SQL CTE fragment (no org param needed — filters via JOIN with ProjectStats)
 */
const buildPerformerStatsCTEs = () => `
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
  )`;

/**
 * Executes a callback within a database transaction using a dedicated client.
 * Ensures proper BEGIN/COMMIT/ROLLBACK and client release.
 * @param {import('pg').Pool} pool - The pg Pool instance
 * @param {(client: import('pg').PoolClient) => Promise<any>} callback - Transaction logic
 * @returns {Promise<any>} Result of the callback
 */
const withTransaction = async (pool, callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    buildWeeklyStatsCTE,
    buildYesterdayStatsCTE,
    buildProjectStatsCTE,
    buildPerformerStatsCTEs,
    withTransaction,
};
