const { pool } = require('../config/db');

async function main() {
    try {
        await pool.query('ALTER TABLE organiation ADD COLUMN IF NOT EXISTS "showLoginPopup" BOOLEAN DEFAULT false');
        console.log('✓ Column "showLoginPopup" added to organiation table');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

main();
