const { pool } = require('./config/db');

async function checkPerformance() {
    try {
        console.log("Checking performance stats...");

        // Check timezone/current time in DB
        const timeRes = await pool.query("SELECT NOW(), CURRENT_DATE, CURRENT_DATE - INTERVAL '1 day' as yesterday_start");
        console.log("DB Time info:", timeRes.rows[0]);

        // Check tasks completed yesterday
        const query = `
            SELECT 
                t.id, 
                t.description, 
                t.status, 
                t.points, 
                t."completedAt",
                e."firstName",
                e.role
            FROM task t
            JOIN employee e ON t."assignedTo"::uuid = e.id
            WHERE t."completedAt" >= CURRENT_DATE - INTERVAL '1 day'
            AND t."completedAt" < CURRENT_DATE
        `;

        const result = await pool.query(query);
        console.log(`Found ${result.rowCount} tasks completed yesterday.`);

        if (result.rowCount > 0) {
            console.log(result.rows);
        } else {
            // Check tasks completed recently to see if we missed the window
            const recent = await pool.query(`
                SELECT "completedAt" FROM task 
                WHERE "completedAt" IS NOT NULL 
                ORDER BY "completedAt" DESC 
                LIMIT 5
            `);
            console.log("Most recent completed tasks:", recent.rows);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

checkPerformance();
