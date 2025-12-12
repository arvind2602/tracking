const pool = require('./config/db');

const seedData = async () => {
    try {
        console.log('Starting seed...');

        // 1. Get an organization and some employees
        const orgResult = await pool.query('SELECT id FROM organiation LIMIT 1');
        if (orgResult.rowCount === 0) {
            console.log('No organization found. Please create one first.');
            return;
        }
        const orgId = orgResult.rows[0].id;

        const empResult = await pool.query('SELECT id FROM employee WHERE "organiationId" = $1', [orgId]);
        if (empResult.rowCount === 0) {
            console.log('No employees found. Please create some first.');
            return;
        }
        const employees = empResult.rows.map(e => e.id);

        // 2. Update existing projects or create new ones with deadlines
        const projectsResult = await pool.query('SELECT id FROM projects WHERE "organiationId" = $1', [orgId]);
        let projectIds = projectsResult.rows.map(p => p.id);

        if (projectIds.length > 0) {
            // Update first project to be "At Risk" (deadline tomorrow)
            await pool.query(
                `UPDATE projects SET "endDate" = NOW() + INTERVAL '1 day' WHERE id = $1`,
                [projectIds[0]]
            );
            console.log('Updated project to be at risk.');
        } else {
            // Create a project
            const newProj = await pool.query(
                `INSERT INTO projects (name, description, "startDate", "endDate", "organiationId")
         VALUES ('Urgent Website Redesign', 'Critical overhaul', NOW(), NOW() + INTERVAL '2 days', $1)
         RETURNING id`,
                [orgId]
            );
            projectIds.push(newProj.rows[0].id);
            console.log('Created new risky project.');
        }

        // 3. Create Tasks for Insights
        const projectId = projectIds[0];
        const assignee = employees[0];

        // Completed tasks for Resolution Time & Top Contributors
        await pool.query(
            `INSERT INTO task (description, status, "createdBy", "assignedTo", points, "projectId", "createdAt", "updatedAt", "assigned_at")
       VALUES 
       ('Fix login bug', 'completed', $1, $1, 5, $2, NOW() - INTERVAL '5 hours', NOW(), NOW() - INTERVAL '4 hours'),
       ('Update homepage', 'completed', $1, $1, 8, $2, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 days'),
       ('Database optimization', 'completed', $1, $1, 13, $2, NOW() - INTERVAL '10 days', NOW() - INTERVAL '9 days', NOW() - INTERVAL '10 days')`,
            [assignee, projectId]
        );

        // Stuck Tasks (Pending/In-progress for > 5 days)
        await pool.query(
            `INSERT INTO task (description, status, "createdBy", "assignedTo", points, "projectId", "createdAt", "updatedAt", "assigned_at")
       VALUES 
       ('Legacy code refactor', 'in-progress', $1, $1, 20, $2, NOW() - INTERVAL '10 days', NOW() - INTERVAL '6 days', NOW() - INTERVAL '10 days'),
       ('Documentation update', 'pending', $1, $1, 3, $2, NOW() - INTERVAL '8 days', NOW() - INTERVAL '7 days', NOW() - INTERVAL '8 days')`,
            [assignee, projectId]
        );

        // Active tasks for Workload
        await pool.query(
            `INSERT INTO task (description, status, "createdBy", "assignedTo", points, "projectId", "createdAt", "updatedAt", "assigned_at")
       VALUES 
       ('New Feature A', 'in-progress', $1, $1, 5, $2, NOW(), NOW(), NOW()),
       ('New Feature B', 'pending', $1, $1, 8, $2, NOW(), NOW(), NOW())`,
            [assignee, projectId]
        );

        console.log('Seeding complete! Analytics should now show data.');
    } catch (error) {
        console.error('Seeding failed:', error);
    } finally {
        // We can't easily close the pool if it's imported from config/db, 
        // but the script will exit anyway.
        process.exit();
    }
};

seedData();
