const Joi = require('joi');
const jwt = require('jsonwebtoken');
const pool = require('../../config/db');
const { BadRequestError, UnprocessableEntityError, NotFoundError } = require('../../utils/errors');
const { generateJwtToken } = require('../../utils/jwtGenerator');
const { jwtConfig } = require('../../config/jwtConfig');
const bcrypt = require('bcryptjs');
const { loginToAdmissionServer } = require('../../services/admissionService');


const login = async (req, res, next) => {
    const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(4).required(),
        deviceId: Joi.string().optional(), // For device tracking
        deviceName: Joi.string().optional(),
        deviceType: Joi.string().optional(),
        browser: Joi.string().optional(),
        os: Joi.string().optional()
    });

    const { error } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));

    const { email, password, deviceId, deviceName, deviceType, browser, os } = req.body;

    try {
        // 1. Attempt to authenticate with external Admission Server
        let admissionUser;
        try {
            const admissionResponse = await loginToAdmissionServer(email, password);
            const admissionToken = admissionResponse.token; // In Admission Server, it's at the top level
            
            if (admissionToken) {
                const decoded = jwt.verify(admissionToken, process.env.ADMISSION_JWT_SECRET || 'This is Secret');
                admissionUser = decoded.user;
            } else if (admissionResponse.data?.user) {
                // Fallback for different response shapes
                admissionUser = admissionResponse.data.user;
            }
        } catch (admissionError) {
            console.error('Admission Server Auth Failed:', admissionError.message);
            // If Admission Server is unreachable or returns 401, we can either fail or try local login
            // The requirement says "Organization and employee details will be retrieved directly from the admission server"
            // implying it should be the primary source.
            // However, we might want a fallback for local-only accounts (if any exist).
            // For now, let's proceed to local login if admission fails, but LOG it.
        }

        let user;
        let organizationId;

        if (admissionUser) {
            // 2. Sync Organization from Admission Server
            const admissionOrgId = admissionUser.organizationUuid || admissionUser.organizationId;
            if (admissionOrgId) {
                const orgResult = await pool.query(
                    'SELECT id FROM organiation WHERE external_id = $1',
                    [admissionOrgId]
                );

                if (orgResult.rowCount > 0) {
                    organizationId = orgResult.rows[0].id;
                } else {
                    // Create organization locally if it doesn't exist
                    const orgName = admissionUser.organization_name || admissionUser.institutes?.[0]?.name || `Organization ${admissionOrgId}`;
                    const newOrg = await pool.query(
                        'INSERT INTO organiation (name, external_id) VALUES ($1, $2) RETURNING id',
                        [orgName, admissionOrgId]
                    );
                    organizationId = newOrg.rows[0].id;
                }
            }

            // 3. Sync Employee from Admission Server
            const employeeResult = await pool.query(
                'SELECT id, email, role, "organiationId", "lastDeviceId" FROM employee WHERE email = $1 AND is_archived = false',
                [admissionUser.email]
            );

            if (employeeResult.rowCount > 0) {
                user = employeeResult.rows[0];
                // Update local role/org based on admission server
                const newRole = admissionUser.role?.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'USER';
                await pool.query(
                    'UPDATE employee SET role = $1, "organiationId" = $2 WHERE id = $3',
                    [newRole, organizationId, user.id]
                );
                user.role = newRole;
                user.organiationId = organizationId;
            } else {
                // Create new employee locally
                const nameParts = admissionUser.name?.split(' ') || ['User'];
                const firstName = nameParts[0];
                const lastName = nameParts.slice(1).join(' ') || '';
                const newRole = admissionUser.role?.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'USER';

                const newEmployee = await pool.query(
                    'INSERT INTO employee ("firstName", "lastName", email, role, "organiationId", password, position) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, email, role, "organiationId", "lastDeviceId"',
                    [firstName, lastName, admissionUser.email, newRole, organizationId, 'external_auth_placeholder', 'Employee']
                );
                user = newEmployee.rows[0];
            }
        } else {
            // 4. Fallback to local authentication if Admission Server didn't provide a user
            const result = await pool.query(
                'SELECT id, email, password, role, "organiationId", "lastDeviceId" FROM employee WHERE email = $1 AND is_archived = false',
                [email]
            );

            if (result.rowCount === 0) {
                return next(new UnprocessableEntityError('Invalid email or password'));
            }

            user = result.rows[0];
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return next(new UnprocessableEntityError('Invalid email or password'));
            }
        }

        const token = generateJwtToken(user.email, user.role, user.id, user.organiationId);

        res.cookie('token', token, { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 24 });

        // Update lastDeviceId on login if provided
        if (deviceId) {
            await pool.query(
                'UPDATE employee SET "lastDeviceId" = $1 WHERE id = $2',
                [deviceId, user.id]
            );
        }

        // Return login info
        res.status(200).json({
            user: {},
            token,
            lastDeviceId: deviceId || user.lastDeviceId
        });
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

    const { firstName, lastName, email, password, position, role, phoneNumber, emergencyContact, address } = req.body;

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
            `INSERT INTO employee ("firstName", "lastName", "email", "password", "position", "role", "organiationId", "phoneNumber", "emergencyContact", "address")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING id, email, role, "organiationId"`,
            [firstName, lastName, email, hashedPassword, position, role, organiationId, phoneNumber || null, emergencyContact || null, address || null]
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
            `SELECT e.id, e."firstName", e."lastName", e.email, e.position, e.role, e."organiationId", e."createdAt", e.skills, e.responsibilities, e.dob, e."bloodGroup", e.image, e."phoneNumber", e."emergencyContact", e.address, e."joiningDate", o.name as "organizationName"
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
            `SELECT e.id, e."firstName", e."lastName", e.email, e.position, e.role, e."organiationId", e."createdAt", e.skills, e.responsibilities, e.dob, e."bloodGroup", e.image, e."phoneNumber", e."emergencyContact", e.address, e."joiningDate", o.name as "organizationName"
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
                                t.points / GREATEST((SELECT COUNT(*) FROM task_assignee ta WHERE ta."taskId" = t.id), 1)
                            ELSE
                                t.points
                        END
                    ), 0) as "weeklyPoints"
                FROM employee e
                LEFT JOIN task t ON (
                    (t.type::text = 'SINGLE' AND t."assignedTo"::uuid = e.id) OR
                    (t.type::text IN ('SHARED', 'SEQUENTIAL') AND EXISTS (SELECT 1 FROM task_assignee ta WHERE ta."taskId" = t.id AND ta."employeeId" = e.id))
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
                                        t.points / GREATEST((SELECT COUNT(*) FROM task_assignee ta WHERE ta."taskId" = t.id), 1)
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
                    (t.type::text IN ('SHARED', 'SEQUENTIAL') AND EXISTS (SELECT 1 FROM task_assignee ta WHERE ta."taskId" = t.id AND ta."employeeId" = e.id))
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
        jwt.sign({ id: user.id }, jwtConfig.secret);
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

    const { firstName, lastName, email, position, role, skills: rawSkills, responsibilities: rawResponsibilities, dob, bloodGroup, phoneNumber, emergencyContact, address, joiningDate, removeImage } = req.body;
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
        let query = `UPDATE employee SET "firstName" = $1, "lastName" = $2, email = $3, position = $4, role = $5, skills = $6, responsibilities = $7, dob = $8, "bloodGroup" = $9, "phoneNumber" = $10, "emergencyContact" = $11, address = $12, "joiningDate" = $13`;
        const params = [firstName, lastName, email, position, role, skills || [], responsibilities || [], dob || null, bloodGroup || null, phoneNumber || null, emergencyContact || null, address || null, joiningDate || null];
        let paramIndex = 14;

        if (imageUrl) {
            query += `, image = $${paramIndex}`;
            params.push(imageUrl);
            paramIndex++;
        } else if (removeImage === 'true' || removeImage === true) {
            query += `, image = NULL`;
        }

        query += `, "updatedAt" = NOW() WHERE id = $${paramIndex} AND is_archived = false RETURNING id, "firstName", "lastName", email, position, role, skills, responsibilities, dob, "bloodGroup", "phoneNumber", "emergencyContact", address, "joiningDate", image`;
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
    getSkills
};