const Joi = require('joi');
const jwt = require('jsonwebtoken');
const pool = require('../../config/db');
const { BadRequestError, UnprocessableEntityError, NotFoundError } = require('../../utils/errors');
const { generateJwtToken } = require('../../utils/jwtGenerator');
const { jwtConfig } = require('../../config/jwtConfig');
const bcrypt = require('bcryptjs');


const login = async (req, res, next) => {
    const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(4).required()
    });

    const { error } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));

    const { email, password } = req.body;

    try {
        const result = await pool.query(
            'SELECT id, email, password, role, "organiationId", "isHR" FROM employee WHERE email = $1 AND is_archived = false',
            [email]
        );

        if (result.rowCount === 0) {
            return next(new UnprocessableEntityError('Invalid email or password'));
        }

        const user = result.rows[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return next(new UnprocessableEntityError('Invalid email or password'));
        }

        const token = generateJwtToken(user.email, user.role, user.id, user.organiationId, user.isHR);


        res.cookie('token', token, { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 24 });

        res.status(200).json({ user: {}, token });
    } catch (error) {
        next(error);
    }
};


const register = async (req, res, next) => {
    const schema = Joi.object({
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        position: Joi.string().required(),
        role: Joi.string().required(),
        phoneNumber: Joi.string().optional().allow(null, ''),
        emergencyContact: Joi.string().optional().allow(null, ''),
        address: Joi.string().optional().allow(null, '')
    });

    const { error } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));

    const { firstName, lastName, email, password, position, role, phoneNumber, emergencyContact, address, isHR } = req.body;

    try {
        const existingResult = await pool.query(
            'SELECT id FROM employee WHERE email = $1 AND is_archived = false',
            [email]
        );

        if (existingResult.rowCount > 0) {
            return next(new UnprocessableEntityError('Email already exists'));
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const organiationId = req.user.organization_uuid;

        const insertResult = await pool.query(
            `INSERT INTO employee ("firstName", "lastName", "email", "password", "position", "role", "organiationId", "phoneNumber", "emergencyContact", "address", "isHR") 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
             RETURNING id, email, role, "organiationId", "isHR"`,
            [firstName, lastName, email, hashedPassword, position, role, organiationId, phoneNumber || null, emergencyContact || null, address || null, isHR || false]
        );

        res.status(201).json({ user: insertResult.rows[0] });
    } catch (error) {
        next(error);
    }

};

// View single employee
const getEmployee = async (req, res, next) => {
    const { user_uuid } = req.user;
    try {
        const result = await pool.query(
            `SELECT e.id, e."firstName", e."lastName", e.email, e.position, e.role, e."organiationId", e."createdAt", e.skills, e.responsibilities, e.dob, e."bloodGroup", e.image, e."phoneNumber", e."emergencyContact", e.address, e."joiningDate", e."isHR", o.name as "organizationName"
             FROM employee e
             LEFT JOIN organiation o ON e."organiationId" = o.id
             WHERE e.id = $1 AND e.is_archived = false`,
            [user_uuid]
        );
        if (result.rowCount === 0) return next(new NotFoundError('Employee not found'));
        res.json(result.rows[0]);
    } catch (error) { next(error); }
};

// View specific employee by ID (Admin/Manager view)
const getEmployeeById = async (req, res, next) => {
    const { id } = req.params;
    const organizationId = req.user.organization_uuid; // Ensure they belong to same org

    try {
        const result = await pool.query(
            `SELECT e.id, e."firstName", e."lastName", e.email, e.position, e.role, e."organiationId", e."createdAt", e.skills, e.responsibilities, e.dob, e."bloodGroup", e.image, e."phoneNumber", e."emergencyContact", e.address, e."joiningDate", e."isHR", o.name as "organizationName"
             FROM employee e
             LEFT JOIN organiation o ON e."organiationId" = o.id
             WHERE e.id = $1 AND e."organiationId" = $2 AND e.is_archived = false`,
            [id, organizationId]
        );
        if (result.rowCount === 0) return next(new NotFoundError('Employee not found'));
        res.json(result.rows[0]);
    } catch (error) { next(error); }
};

// View all in organization with ranking
const getEmployeesByOrg = async (req, res, next) => {
    const organizationId = req.user.organization_uuid;
    const { sortBy, sortOrder } = req.query;



    // Build ORDER BY clause
    const validSortColumns = {
        'firstName': 'e."firstName"',
        'lastName': 'e."lastName"',
        'email': 'e.email',
        'position': 'e.position',
        'role': 'e.role',
        'weeklyPoints': 'ws."weeklyPoints"',
        'rank': 'rank'
    };

    let orderByClause = 'ORDER BY ws."weeklyPoints" DESC, e."firstName" ASC'; // default
    if (sortBy && validSortColumns[sortBy]) {
        const direction = sortOrder && sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        orderByClause = `ORDER BY ${validSortColumns[sortBy]} ${direction}`;

        // Add secondary sort for consistency
        if (sortBy !== 'firstName') {
            orderByClause += `, e."firstName" ASC`;
        }
    }

    try {
        const result = await pool.query(
            `WITH WeeklyStats AS (
                SELECT 
                    e.id,
                    COALESCE(SUM(
                        CASE 
                            WHEN t.type::text IN ('SHARED', 'SEQUENTIAL') THEN 
                                t.points / GREATEST((SELECT COUNT(*) FROM "TaskAssignee" ta WHERE ta."taskId" = t.id), 1)
                            ELSE 
                                t.points 
                        END
                    ), 0) as "weeklyPoints"
                FROM employee e
                LEFT JOIN task t ON (
                    (t.type::text = 'SINGLE' AND t."assignedTo"::uuid = e.id) OR 
                    (t.type::text IN ('SHARED', 'SEQUENTIAL') AND EXISTS (SELECT 1 FROM "TaskAssignee" ta WHERE ta."taskId" = t.id AND ta."employeeId" = e.id))
                )
                    AND LOWER(t.status) IN ('done', 'completed')
                    AND t."completedAt" >= NOW() - INTERVAL '7 days'
                WHERE e."organiationId" = $1
                GROUP BY e.id
             ),
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
                                    ELSE 
                                        t.points 
                                END
                            ELSE 0
                        END
                    ), 0) as "yesterdayPoints",
                    COUNT(t.id) as "yesterdayTaskCount"
                FROM employee e
                LEFT JOIN task t ON (
                    (t.type::text = 'SINGLE' AND t."assignedTo"::uuid = e.id) OR 
                    (t.type::text IN ('SHARED', 'SEQUENTIAL') AND EXISTS (SELECT 1 FROM "TaskAssignee" ta WHERE ta."taskId" = t.id AND ta."employeeId" = e.id))
                )
                -- We only count tasks that were assigned/existing yesterday
                AND t."createdAt" < CURRENT_DATE 
                AND (t.status != 'completed' OR t."completedAt" >= CURRENT_DATE - INTERVAL '1 day')
                WHERE e."organiationId" = $1
                GROUP BY e.id
             )
             SELECT 
                e.id, 
                e."firstName", 
                e."lastName", 
                e.email, 
                e.position, 
                e.role,
                e."isHR",
                ws."weeklyPoints",
                COALESCE(ys."yesterdayPoints", 0) as "yesterdayPoints",
                COALESCE(ys."yesterdayTaskCount", 0) as "yesterdayTaskCount",
                e.skills,
                e.responsibilities,
                e.image,
                e.dob,
                e."phoneNumber",
                e."emergencyContact",
                e.address,
                e."joiningDate",
                RANK() OVER (ORDER BY ws."weeklyPoints" DESC) as rank
             FROM employee e
             JOIN WeeklyStats ws ON e.id = ws.id
             LEFT JOIN YesterdayStats ys ON e.id = ys.id
             WHERE e."organiationId" = $1 AND e.is_archived = false
             ${orderByClause}`,
            [organizationId]
        );
        res.json(result.rows);
    } catch (error) { next(error); }
};

const getSkills = async (req, res, next) => {
    const organizationId = req.user.organization_uuid;
    const { search } = req.query;
    try {
        let query = `
            SELECT DISTINCT skill 
            FROM (
                SELECT unnest(skills) as skill 
                FROM employee 
                WHERE "organiationId" = $1 AND is_archived = false
            ) as distinct_skills
        `;
        const params = [organizationId];

        if (search) {
            query += ` WHERE skill ILIKE $2`;
            params.push(`%${search}%`);
        }

        query += ` ORDER BY skill ASC LIMIT 50`;

        const result = await pool.query(query, params);
        res.json(result.rows.map(r => r.skill));
    } catch (error) { next(error); }
};

// ... existing code ...




// Forget password (send reset token)
const forgetPassword = async (req, res, next) => {
    const { email } = req.body;
    try {
        const result = await pool.query(
            'SELECT id, email FROM employee WHERE email = $1 AND is_archived = false',
            [email]
        );
        if (result.rowCount === 0) return res.json({ message: 'If email exists, reset link sent' });

        const user = result.rows[0];
        jwt.sign({ id: user.id }, jwtConfig.secret, { expiresIn: '15m' });
        // TODO: Send email with resetToken
        res.json({ message: 'Reset link sent' });
    } catch (error) { next(error); }
};

const changePassword = async (req, res, next) => {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
        return next(new BadRequestError('Password must be at least 6 characters long'));
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 12);
        const result = await pool.query(
            'UPDATE employee SET password = $1, "updatedAt" = NOW() WHERE id = $2 AND is_archived = false RETURNING id',
            [hashedPassword, id]
        );

        if (result.rowCount === 0) return next(new NotFoundError('Employee not found'));
        res.json({ message: 'Password updated successfully' });
    } catch (error) { next(error); }
};

// Edit user
const updateEmployee = async (req, res, next) => {
    const { id } = req.params;
    // req.body might not have nested objects if valid JSON isn't sent with FormData
    // So we need to handle parsing if they come as strings (though axios usually handles this, 
    // appending arrays to FormData can be tricky).
    // For now assuming direct fields or simple parsing if needed.

    const { firstName, lastName, email, position, role, skills: rawSkills, responsibilities: rawResponsibilities, dob, bloodGroup, phoneNumber, emergencyContact, address, joiningDate, removeImage, isHR } = req.body;
    let skills = rawSkills;
    let responsibilities = rawResponsibilities;

    // Parse arrays if they come as strings (common with FormData)
    if (typeof skills === 'string') {
        try { skills = JSON.parse(skills); } catch (_) { skills = [skills]; }
    }
    if (typeof responsibilities === 'string') {
        try { responsibilities = JSON.parse(responsibilities); } catch (_) { responsibilities = [responsibilities]; }
    }

    let imageUrl;

    try {
        if (email) {
            const emailCheck = await pool.query(
                'SELECT id FROM employee WHERE email = $1 AND id != $2 AND is_archived = false',
                [email, id]
            );
            if (emailCheck.rowCount > 0) {
                return next(new UnprocessableEntityError('Email already exists'));
            }
        }

        if (req.file) {
            const { uploadToCloudinary } = require('../../config/cloudinary');
            imageUrl = await uploadToCloudinary(req.file, 'image');
        }

        // Build the update query dynamically or simply
        let query = `UPDATE employee SET "firstName" = $1, "lastName" = $2, email = $3, position = $4, role = $5, skills = $6, responsibilities = $7, dob = $8, "bloodGroup" = $9, "phoneNumber" = $10, "emergencyContact" = $11, address = $12, "joiningDate" = $13, "isHR" = $14`;
        const params = [firstName, lastName, email, position, role, skills || [], responsibilities || [], dob || null, bloodGroup || null, phoneNumber || null, emergencyContact || null, address || null, joiningDate || null, isHR || false];
        let paramIndex = 15;

        if (imageUrl) {
            query += `, image = $${paramIndex}`;
            params.push(imageUrl);
            paramIndex++;
        } else if (removeImage === 'true' || removeImage === true) {
            query += `, image = NULL`;
        }

        query += `, "updatedAt" = NOW() WHERE id = $${paramIndex} AND is_archived = false RETURNING id, "firstName", "lastName", email, position, role, skills, responsibilities, dob, "bloodGroup", "phoneNumber", "emergencyContact", address, "joiningDate", image, "isHR"`;
        params.push(id);

        const result = await pool.query(query, params);

        if (result.rowCount === 0) return next(new NotFoundError('Employee not found'));
        res.json(result.rows[0]);
    } catch (error) { next(error); }
};

// Delete user (soft delete)
const deleteEmployee = async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'UPDATE employee SET is_archived = true WHERE id = $1 AND is_archived = false RETURNING id',
            [id]
        );
        if (result.rowCount === 0) return next(new NotFoundError('Employee not found'));
        res.json({ message: 'Employee deleted' });
    } catch (error) { next(error); }
};

// Export Employees
const exportUsers = async (req, res, next) => {
    const organizationId = req.user.organization_uuid;
    try {
        const result = await pool.query(
            `WITH WeeklyStats AS (
                SELECT 
                    e.id,
                    COALESCE(SUM(
                        CASE 
                            WHEN t.type::text IN ('SHARED', 'SEQUENTIAL') THEN 
                                t.points / GREATEST((SELECT COUNT(*) FROM "TaskAssignee" ta WHERE ta."taskId" = t.id), 1)
                            ELSE 
                                t.points 
                        END
                    ), 0) as "weeklyPoints"
                FROM employee e
                LEFT JOIN task t ON (
                    (t.type::text = 'SINGLE' AND t."assignedTo"::uuid = e.id) OR 
                    (t.type::text IN ('SHARED', 'SEQUENTIAL') AND EXISTS (SELECT 1 FROM "TaskAssignee" ta WHERE ta."taskId" = t.id AND ta."employeeId" = e.id))
                )
                    AND LOWER(t.status) IN ('done', 'completed')
                    AND t."completedAt" >= NOW() - INTERVAL '7 days'
                WHERE e."organiationId" = $1
                GROUP BY e.id
             ),
             YesterdayStats AS (
                SELECT 
                    e.id,
                    COALESCE(SUM(
                        CASE 
                            WHEN t.type::text IN ('SHARED', 'SEQUENTIAL') THEN 
                                t.points / GREATEST((SELECT COUNT(*) FROM "TaskAssignee" ta WHERE ta."taskId" = t.id), 1)
                            ELSE 
                                t.points 
                        END
                    ), 0) as "yesterdayPoints"
                FROM employee e
                LEFT JOIN task t ON (
                    (t.type::text = 'SINGLE' AND t."assignedTo"::uuid = e.id) OR 
                    (t.type::text IN ('SHARED', 'SEQUENTIAL') AND EXISTS (SELECT 1 FROM "TaskAssignee" ta WHERE ta."taskId" = t.id AND ta."employeeId" = e.id))
                )
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
                e.email, 
                e.position, 
                e.role,
                e."updatedAt",
                e.dob,
                e."bloodGroup",
                e."phoneNumber",
                e."emergencyContact",
                e.address,
                e.image,
                e."createdAt",
                e."joiningDate",
                e.skills,
                e.responsibilities,
                ws."weeklyPoints",
                COALESCE(ys."yesterdayPoints", 0) as "yesterdayPoints",
                RANK() OVER (ORDER BY ws."weeklyPoints" DESC) as rank
             FROM employee e
             JOIN WeeklyStats ws ON e.id = ws.id
             LEFT JOIN YesterdayStats ys ON e.id = ys.id
             WHERE e."organiationId" = $1 AND e.is_archived = false
             ORDER BY ws."weeklyPoints" DESC, e."firstName" ASC`,
            [organizationId]
        );

        const users = result.rows;

        // Convert to CSV
        const header = ['ID', 'Rank', 'First Name', 'Last Name', 'Email', 'Position', 'Role', 'Is HR', 'Skills', 'Responsibilities', 'Weekly Points', 'Joined At', 'Date of Birth', 'Blood Group', 'Phone Number', 'Emergency Contact', 'Address', 'Image URL', 'Last Updated'];
        const csvRows = [header.join(',')];

        users.forEach(user => {
            const skills = (user.skills || []).join('; ');
            const responsibilities = (user.responsibilities || []).join('; ');

            const row = [
                user.id,
                user.rank,
                `"${(user.firstName || '').replace(/"/g, '""')}"`,
                `"${(user.lastName || '').replace(/"/g, '""')}"`,
                `"${(user.email || '').replace(/"/g, '""')}"`,
                `"${(user.position || '').replace(/"/g, '""')}"`,
                user.role,
                user.isHR ? 'YES' : 'NO',
                `"${skills.replace(/"/g, '""')}"`,
                `"${responsibilities.replace(/"/g, '""')}"`,
                user.weeklyPoints,
                user.joiningDate ? new Date(user.joiningDate).toISOString().split('T')[0] : (user.createdAt ? new Date(user.createdAt).toISOString().split('T')[0] : ''),
                user.dob ? new Date(user.dob).toISOString().split('T')[0] : '',
                `"${(user.bloodGroup || '').replace(/"/g, '""')}"`,
                `"${(user.phoneNumber || '').replace(/"/g, '""')}"`,
                `"${(user.emergencyContact || '').replace(/"/g, '""')}"`,
                `"${(user.address || '').replace(/"/g, '""')}"`,
                `"${(user.image || '').replace(/"/g, '""')}"`,
                user.updatedAt ? new Date(user.updatedAt).toISOString() : ''
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="users_export.csv"');
        res.send(csvContent);
    } catch (error) { next(error); }
};


module.exports = {
    login,
    register,
    getEmployee,
    getEmployeeById,
    getEmployeesByOrg,
    forgetPassword,
    updateEmployee,
    changePassword,
    deleteEmployee,
    exportUsers,
    getSkills
};