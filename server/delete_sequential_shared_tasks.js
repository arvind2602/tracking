const { pool, shutdownPool } = require('./config/db');

const deleteSequentialAndSharedTasks = async () => {
    try {
        console.log('Starting deletion of SEQUENTIAL and SHARED tasks...');

        // 1. Get counts for verification before deletion
        const countQuery = `
      SELECT type, COUNT(*) as count 
      FROM task 
      WHERE type IN ('SEQUENTIAL', 'SHARED') 
      GROUP BY type
    `;
        const countResult = await pool.query(countQuery);

        if (countResult.rows.length === 0) {
            console.log('No SEQUENTIAL or SHARED tasks found to delete.');
            await shutdownPool();
            return;
        }

        console.log('Tasks to be deleted:', countResult.rows);

        // 2. Start Transaction
        await pool.query('BEGIN');

        // 3. Delete Comments associated with these tasks
        // We need to delete comments for the tasks AND their subtasks (if any subtasks exist for these types, though schema implies they might be top level)
        console.log('Deleting associated comments...');
        await pool.query(`
      DELETE FROM comment 
      WHERE "taskId" IN (
        SELECT id FROM task WHERE type IN ('SEQUENTIAL', 'SHARED')
      )
    `);

        // 4. Delete Subtasks (if any)
        // Assuming SEQUENTIAL/SHARED tasks might have subtasks.
        // We need to delete comments of subtasks first
        console.log('Deleting comments of subtasks...');
        await pool.query(`
      DELETE FROM comment 
      WHERE "taskId" IN (
        SELECT t.id FROM task t
        JOIN task parent ON t."parentId" = parent.id
        WHERE parent.type IN ('SEQUENTIAL', 'SHARED')
      )
    `);

        console.log('Deleting subtasks...');
        await pool.query(`
      DELETE FROM task 
      WHERE "parentId" IN (
        SELECT id FROM task WHERE type IN ('SEQUENTIAL', 'SHARED')
      )
    `);

        // 5. Delete TaskAssignees
        // Although foreign keys might have ON DELETE CASCADE, it's safer to be explicit or at least acknowledge.
        // The schema shows:   task     task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
        // So deleting the task should cascade to TaskAssignee. 
        // However, let's explicitely delete to be sure and logged.
        console.log('Deleting TaskAssignee records...');
        await pool.query(`
      DELETE FROM "TaskAssignee"
      WHERE "taskId" IN (
        SELECT id FROM task WHERE type IN ('SEQUENTIAL', 'SHARED')
      )
    `);

        // 6. Delete the Tasks themselves
        console.log('Deleting the tasks...');
        const deleteResult = await pool.query(`
      DELETE FROM task 
      WHERE type IN ('SEQUENTIAL', 'SHARED')
      RETURNING id, type
    `);

        console.log(`Successfully deleted ${deleteResult.rowCount} tasks.`);

        // 7. Commit
        await pool.query('COMMIT');
        console.log('Transaction COMMITTED.');

    } catch (error) {
        console.error('Error during deletion:', error);
        await pool.query('ROLLBACK');
        console.log('Transaction ROLLED BACK.');
    } finally {
        await shutdownPool();
    }
};

deleteSequentialAndSharedTasks();
