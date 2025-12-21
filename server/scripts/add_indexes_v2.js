require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../config/db');

async function addIndexes() {
    const indexes = [
        // Foreign Keys
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_org_id ON projects("organiationId");',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_project_id ON task("projectId");',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employee_org_id ON employee("organiationId");',

        // Filtering & Sorting
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_assigned_to ON task("assignedTo");',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_status ON task(status);',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_due_date ON task("dueDate");',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_created_at ON task("createdAt");',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_assigned_at ON task("assigned_at");',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_updated_at ON task("updatedAt");',

        // Composite Indexes for specific common queries
        // optimize: WHERE "assignedTo" = $1 AND "organiationId" = $2 (via Join)
        // optimize: WHERE "projectId" = $1 AND "organiationId" = $2 (via Join)
    ];

    console.log('Starting index creation...');

    try {
        // Indexes on 'projects' and 'task'
        for (const query of indexes) {
            console.log(`Executing: ${query}`);
            try {
                await pool.query(query);
                console.log('Success.');
            } catch (err) {
                console.warn(`Failed to create index (might already exist or other error): ${err.message}`);
            }
        }

        console.log('Index creation finished.');
    } catch (error) {
        console.error('Error running migration script:', error);
    } finally {
        await pool.shutdownPool();
    }
}

addIndexes();
