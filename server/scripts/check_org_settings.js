const { pool } = require('../config/db');

async function check() {
    try {
        const res = await pool.query('SELECT name, "showLoginPopup" FROM organiation');
        console.log('--- Organization Settings ---');
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

check();
