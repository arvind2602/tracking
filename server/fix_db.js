const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Drop the constraint that Prisma is complaining about
    const query = 'ALTER TABLE geofence DROP CONSTRAINT IF EXISTS geofence_organizationid_unique;';
    console.log(`Executing: ${query}`);
    await client.query(query);
    console.log('Successfully dropped constraint');

    // Also try to drop the index if it exists (though dropping the constraint usually handles it)
    try {
        await client.query('DROP INDEX IF EXISTS geofence_organizationid_unique;');
        console.log('Successfully dropped index');
    } catch (e) {
        console.log('Note: Index drop skipped (might have been dropped with constraint)');
    }

  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await client.end();
  }
}

run();
