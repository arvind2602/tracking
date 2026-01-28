const Joi = require('joi');
const pool = require('../../config/db');
const { BadRequestError, UnprocessableEntityError } = require('../../utils/errors');
const { generateJwtToken } = require('../../utils/jwtGenerator');
const bcrypt = require('bcryptjs');
const { get } = require('./_route');

const login = async (req, res, next) => {
    const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(4).required(),
        datetime: Joi.date().iso().required()
    });

    const { error } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));

    const { email, password, datetime } = req.body;

    try {
        const result = await pool.query(
            'SELECT id, email, password, role, "organiationId" FROM employee WHERE email = $1 AND is_archived = false',
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

        const token = generateJwtToken(user.email, user.role, user.id, user.organiationId);


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
    });

    const { error } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));

    const { firstName, lastName, email, password, position, role } = req.body;

    try {
        const existingResult = await pool.query(
            'SELECT id FROM employee WHERE email = $1 AND is_archived = false',
            [email]
        );

        if (existingResult.rowCount > 0) {
            return next(new UnprocessableEntityError('Email already exists'));
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        console.log('Registering user in organization:', req.user.organization_uuid);
        const organiationId = req.user.organization_uuid;

        const insertResult = await pool.query(
            `INSERT INTO employee ("firstName", "lastName", "email", "password", "position", "role", "organiationId") 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING id, email, role, "organiationId"`,
            [firstName, lastName, email, hashedPassword, position, role, organiationId]
        );

        res.status(201).json({ user: insertResult.rows[0] });
    } catch (error) {
        next(error);
    }

};

// View single employee
const getEmployee = async (req, res, next) => {
    const { user_uuid } = req.user;
    console.log('Fetching employee with ID:', user_uuid);
    try {
        const result = await pool.query(
            `SELECT e.id, e."firstName", e."lastName", e.email, e.position, e.role, e."organiationId", e."createdAt", e.skills, e.responsibilities, e.dob, e."bloodGroup", e.image, e."phoneNumber", o.name as "organizationName"
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
            `SELECT e.id, e."firstName", e."lastName", e.email, e.position, e.role, e."organiationId", e."createdAt", e.skills, e.responsibilities, e.dob, e."bloodGroup", e.image, e."phoneNumber", o.name as "organizationName"
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

    console.log('Fetching employees for organization:', organizationId);

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
                    COALESCE(SUM(t.points), 0) as "weeklyPoints"
                FROM employee e
                LEFT JOIN task t ON e.id = t."assignedTo"::uuid 
                    AND LOWER(t.status) IN ('done', 'completed')
                    AND t."completedAt" >= NOW() - INTERVAL '7 days'
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
                ws."weeklyPoints",
                e.skills,
                e.responsibilities,
                e.image,
                RANK() OVER (ORDER BY ws."weeklyPoints" DESC) as rank
             FROM employee e
             JOIN WeeklyStats ws ON e.id = ws.id
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
        const resetToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '15m' });
        // TODO: Send email with resetToken
        res.json({ message: 'Reset link sent' });
    } catch (error) { next(error); }
};

// Edit user
const updateEmployee = async (req, res, next) => {
    const { id } = req.params;
    // req.body might not have nested objects if valid JSON isn't sent with FormData
    // So we need to handle parsing if they come as strings (though axios usually handles this, 
    // appending arrays to FormData can be tricky).
    // For now assuming direct fields or simple parsing if needed.

    let { firstName, lastName, position, role, skills, responsibilities, dob, bloodGroup, phoneNumber, removeImage } = req.body;

    // Parse arrays if they come as strings (common with FormData)
    if (typeof skills === 'string') {
        try { skills = JSON.parse(skills); } catch (e) { skills = [skills]; }
    }
    if (typeof responsibilities === 'string') {
        try { responsibilities = JSON.parse(responsibilities); } catch (e) { responsibilities = [responsibilities]; }
    }

    let imageUrl;

    try {
        if (req.file) {
            const { uploadToCloudinary } = require('../../config/cloudinary');
            imageUrl = await uploadToCloudinary(req.file, 'image');
        }

        // Build the update query dynamically or simply
        let query = `UPDATE employee SET "firstName" = $1, "lastName" = $2, position = $3, role = $4, skills = $5, responsibilities = $6, dob = $7, "bloodGroup" = $8, "phoneNumber" = $9`;
        let params = [firstName, lastName, position, role, skills || [], responsibilities || [], dob || null, bloodGroup || null, phoneNumber || null];
        let paramIndex = 10;

        if (imageUrl) {
            query += `, image = $${paramIndex}`;
            params.push(imageUrl);
            paramIndex++;
        } else if (removeImage === 'true' || removeImage === true) {
            query += `, image = NULL`;
        }

        query += `, "updatedAt" = NOW() WHERE id = $${paramIndex} AND is_archived = false RETURNING id, "firstName", "lastName", email, position, role, skills, responsibilities, dob, "bloodGroup", "phoneNumber", image`;
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
                    COALESCE(SUM(t.points), 0) as "weeklyPoints"
                FROM employee e
                LEFT JOIN task t ON e.id = t."assignedTo"::uuid 
                    AND LOWER(t.status) IN ('done', 'completed')
                    AND t."updatedAt" >= NOW() - INTERVAL '7 days'
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
                e."createdAt",
                e.skills,
                e.responsibilities,
                ws."weeklyPoints",
                RANK() OVER (ORDER BY ws."weeklyPoints" DESC) as rank
             FROM employee e
             JOIN WeeklyStats ws ON e.id = ws.id
             WHERE e."organiationId" = $1 AND e.is_archived = false
             ORDER BY ws."weeklyPoints" DESC, e."firstName" ASC`,
            [organizationId]
        );

        const users = result.rows;

        // Convert to CSV
        const header = ['ID', 'Rank', 'First Name', 'Last Name', 'Email', 'Position', 'Role', 'Skills', 'Responsibilities', 'Weekly Points', 'Joined At'];
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
                `"${skills.replace(/"/g, '""')}"`,
                `"${responsibilities.replace(/"/g, '""')}"`,
                user.weeklyPoints,
                user.createdAt ? new Date(user.createdAt).toISOString().split('T')[0] : ''
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
    deleteEmployee,
    exportUsers,
    getSkills
};