const { pool } = require('./config/db');

async function checkAuthQuery() {
    try {
        console.log("Checking Auth Query for Organization...");
        // First get an org ID
        const orgRes = await pool.query('SELECT id FROM organiation LIMIT 1');
        const organizationId = orgRes.rows[0].id;
        console.log("Using Organization ID:", organizationId);

        const query = `
            WITH WeeklyStats AS (
                SELECT 
                    e.id,
                    COALESCE(SUM(t.points), 0) as "weeklyPoints"
                FROM employee e
                LEFT JOIN task t ON e.id = t."assignedTo"::uuid 
                    AND LOWER(t.status) IN ('done', 'completed')
                    AND t."completedAt" >= NOW() - INTERVAL '7 days'
                WHERE e."organiationId" = $1
                GROUP BY e.id
             ),
             YesterdayStats AS (
                SELECT 
                    e.id,
                    COALESCE(SUM(t.points), 0) as "yesterdayPoints"
                FROM employee e
                LEFT JOIN task t ON e.id = t."assignedTo"::uuid 
                    AND LOWER(t.status) IN ('done', 'completed')
                    AND t."completedAt" >= CURRENT_DATE - INTERVAL '1 day'
                    AND t."completedAt" < CURRENT_DATE
                WHERE e."organiationId" = $1
                GROUP BY e.id
             )
             SELECT 
                e.id, 
                e."firstName", 
                e."lastName", 
                e.role,
                COALESCE(ys."yesterdayPoints", 0) as "yesterdayPoints",
                ws."weeklyPoints"
             FROM employee e
             JOIN WeeklyStats ws ON e.id = ws.id
             LEFT JOIN YesterdayStats ys ON e.id = ys.id
             WHERE e."organiationId" = $1 AND e.is_archived = false
             ORDER BY ws."weeklyPoints" DESC, e."firstName" ASC
        `;

        const result = await pool.query(query, [organizationId]);
        console.log("Query Results:");
        result.rows.forEach(row => {
            console.log(`${row.firstName} ${row.lastName} (${row.role}): Yesterday=${row.yesterdayPoints}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

checkAuthQuery();
