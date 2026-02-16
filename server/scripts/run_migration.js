const pool = require('./config/db');
const fs = require('fs');
const path = require('path');

async function migrate() {
    const sqlPath = path.join(__dirname, 'prisma', 'migrations', 'hold_feature.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    try {
        console.log('Starting migration...');
        await pool.query(sql);
        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
