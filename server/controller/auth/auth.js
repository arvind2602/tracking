const Joi = require('joi');
const jwt = require('jsonwebtoken');
const pool = require('../../config/db');
const { BadRequestError, UnprocessableEntityError, NotFoundError, AuthorizationError } = require('../../utils/errors');
const { generateJwtToken } = require('../../utils/jwtGenerator');
const { jwtConfig } = require('../../config/jwtConfig');
const bcrypt = require('bcryptjs');


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
        const result = await pool.query(
            'SELECT id, email, password, role, "organiationId", "lastDeviceId" FROM employee WHERE email = $1 AND is_archived = false',
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

        // Track device on login
        const deviceInfo = {
            deviceId,
            deviceName,
            deviceType,
            browser,
            os
        };

        // Return device tracking info for frontend
        res.status(200).json({
            user: {},
            token,
            deviceInfo,
            lastDeviceId: user.lastDeviceId
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

// Ensure weekly report column exists (idempotent, for deployments without manual migration)
async function ensureReportingColumn() {
    try {
        await pool.query(`ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "include_weekly_report" BOOLEAN NOT NULL DEFAULT false`);
    } catch (_) {}
}

// View single employee
const getEmployee = async (req, res, next) => {
    const { user_uuid } = req.user;
    try {
        await ensureReportingColumn();
        const result = await pool.query(
            `SELECT e.id, e."firstName", e."lastName", e.email, e.position, e.role, e."organiationId", e."createdAt", e.skills, e.responsibilities, e.dob, e."bloodGroup", e.image, e."phoneNumber", e."emergencyContact", e.address, e."joiningDate",
                    COALESCE(e."include_weekly_report", false) as "includeWeeklyReport",
                    o.name as "organizationName"
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
        await ensureReportingColumn();
        const result = await pool.query(
            `SELECT e.id, e."firstName", e."lastName", e.email, e.position, e.role, e."organiationId", e."createdAt", e.skills, e.responsibilities, e.dob, e."bloodGroup", e.image, e."phoneNumber", e."emergencyContact", e.address, e."joiningDate",
                    COALESCE(e."include_weekly_report", false) as "includeWeeklyReport",
                    o.name as "organizationName"
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




// Forgot password - OTP flow: send 6-digit code if email exists and not archived
const forgotPassword = async (req, res, next) => {
    const schema = Joi.object({
        email: Joi.string().email().required(),
    });
    const { error } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));

    const { email } = req.body;
    const genericMessage = 'If an account with that email exists, an OTP has been sent.';

    try {
        const result = await pool.query(
            'SELECT id, email FROM employee WHERE email = $1 AND is_archived = false',
            [email]
        );

        if (result.rowCount === 0) {
            return res.json({ message: genericMessage });
        }

        const user = result.rows[0];

        // Ensure OTP table exists (idempotent, for deployments without manual migration)
        try {
            await pool.query(`CREATE TABLE IF NOT EXISTS "password_reset_otp" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "employeeId" UUID NOT NULL REFERENCES employee(id) ON DELETE CASCADE, "otpHash" TEXT NOT NULL, "expiresAt" TIMESTAMPTZ NOT NULL, attempts INT DEFAULT 0, "createdAt" TIMESTAMPTZ DEFAULT NOW(), "verifiedAt" TIMESTAMPTZ); CREATE INDEX IF NOT EXISTS "password_reset_otp_employeeId_idx" ON "password_reset_otp"("employeeId"); CREATE INDEX IF NOT EXISTS "password_reset_otp_expiresAt_idx" ON "password_reset_otp"("expiresAt");`);
        } catch (tblErr) { void tblErr; }

        // Throttle: 60s per email
        const lastOtp = await pool.query(
            `SELECT "createdAt" FROM "password_reset_otp" WHERE "employeeId"=$1 ORDER BY "createdAt" DESC LIMIT 1`,
            [user.id]
        );
        if (lastOtp.rowCount > 0) {
            const diffMs = Date.now() - new Date(lastOtp.rows[0].createdAt).getTime();
            if (diffMs < 60 * 1000) {
                const wait = Math.ceil((60 * 1000 - diffMs) / 1000);
                return res.status(429).json({ error: { message: `Please wait ${wait}s before requesting another OTP`, code: 'TOO_MANY_REQUESTS' } });
            }
        }

        // Cleanup expired
        await pool.query(`DELETE FROM "password_reset_otp" WHERE "expiresAt" < NOW()`);

        // Generate 6-digit OTP
        const crypto = require('crypto');
        const otp = String(crypto.randomInt(100000, 1000000));
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

        await pool.query(
            `INSERT INTO "password_reset_otp" ("employeeId", "otpHash", "expiresAt") VALUES ($1,$2,$3)`,
            [user.id, otpHash, expiresAt]
        );

        try {
            const { sendOtpEmail } = require('../../utils/email');
            await sendOtpEmail(user.email, otp);
        } catch (emailError) {
            const logger = require('../../utils/logger');
            logger.error(`Forgot password OTP email error: ${emailError.message}`);
        }

        res.json({ message: genericMessage });
    } catch (err) {
        // If table doesn't exist yet, fallback to link flow
        if (err.message && err.message.includes('password_reset_otp')) {
            const logger = require('../../utils/logger');
            logger.error(`OTP table missing, fallback: ${err.message}`);
            return next(new BadRequestError('OTP service not ready. Please run DB migration.'));
        }
        next(err);
    }
};

// Alias for backward compatibility (old spelling)
const forgetPassword = forgotPassword;

// Verify OTP -> returns otpToken (JWT purpose:otp-verified)
const verifyOtp = async (req, res, next) => {
    const schema = Joi.object({
        email: Joi.string().email().required(),
        otp: Joi.string().length(6).required(),
    });
    const { error } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));

    const { email, otp } = req.body;
    try {
        try { await pool.query(`CREATE TABLE IF NOT EXISTS "password_reset_otp" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "employeeId" UUID NOT NULL REFERENCES employee(id) ON DELETE CASCADE, "otpHash" TEXT NOT NULL, "expiresAt" TIMESTAMPTZ NOT NULL, attempts INT DEFAULT 0, "createdAt" TIMESTAMPTZ DEFAULT NOW(), "verifiedAt" TIMESTAMPTZ);`); } catch (_) {}
        const userRes = await pool.query('SELECT id, email FROM employee WHERE email=$1 AND is_archived=false', [email]);
        if (userRes.rowCount === 0) return next(new BadRequestError('Invalid OTP'));

        const userId = userRes.rows[0].id;

        const otpRes = await pool.query(
            `SELECT id, "otpHash", "expiresAt", attempts, "verifiedAt" FROM "password_reset_otp" WHERE "employeeId"=$1 AND "expiresAt" > NOW() AND "verifiedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 1`,
            [userId]
        );
        if (otpRes.rowCount === 0) return next(new BadRequestError('OTP expired or not found. Please request a new one.'));

        const row = otpRes.rows[0];
        if (row.attempts >= 5) return next(new BadRequestError('Too many incorrect attempts. Please request a new OTP.'));

        const isMatch = await bcrypt.compare(otp, row.otpHash);
        if (!isMatch) {
            await pool.query(`UPDATE "password_reset_otp" SET attempts = attempts + 1 WHERE id=$1`, [row.id]);
            return next(new BadRequestError('Invalid OTP'));
        }

        await pool.query(`UPDATE "password_reset_otp" SET "verifiedAt"=NOW(), attempts = attempts + 1 WHERE id=$1`, [row.id]);

        const otpToken = jwt.sign(
            { id: userId, email, purpose: 'otp-verified', otpId: row.id },
            jwtConfig.secret,
            { algorithm: jwtConfig.algorithm, expiresIn: '10m' }
        );

        const response = { message: 'OTP verified', otpToken };
        res.json(response);
    } catch (err) { next(err); }
};

// Legacy link-based forgot (kept for backward compat, not used)
const forgotPasswordLink = async (req, res, next) => {
    const schema = Joi.object({ email: Joi.string().email().required() });
    const { error } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));
    const { email } = req.body;
    const genericMessage = 'If an account with that email exists, a password reset link has been sent.';
    try {
        const result = await pool.query('SELECT id, email FROM employee WHERE email = $1 AND is_archived = false', [email]);
        if (result.rowCount === 0) return res.json({ message: genericMessage });
        const user = result.rows[0];
        const resetToken = jwt.sign({ id: user.id, email: user.email, purpose: 'password-reset' }, jwtConfig.secret, { algorithm: jwtConfig.algorithm, expiresIn: '15m' });
        const frontendUrl = (process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:3000').split(',')[0].trim();
        const resetUrl = `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(resetToken)}`;
        try { const { sendResetEmail } = require('../../utils/email'); await sendResetEmail(user.email, resetUrl, resetToken); } catch (e) { require('../../utils/logger').error(`Link email error: ${e.message}`); }
        res.json({ message: genericMessage });
    } catch (err) { next(err); }
};

const resetPassword = async (req, res, next) => {
    // Supports both OTP flow (otpToken) and legacy link flow (token) for backward compat
    const schema = Joi.object({
        otpToken: Joi.string().optional(),
        token: Joi.string().optional(),
        password: Joi.string().min(6).required(),
        confirmPassword: Joi.string().optional(),
    }).or('otpToken', 'token');
    const { error } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));

    const { otpToken, token, password, confirmPassword } = req.body;

    if (confirmPassword && password !== confirmPassword) {
        return next(new BadRequestError('Passwords do not match'));
    }

    try {
        let decoded;
        let userId;
        const rawToken = otpToken || token;
        try {
            decoded = jwt.verify(rawToken, jwtConfig.secret);
        } catch (jwtErr) {
            if (jwtErr.name === 'TokenExpiredError') {
                return next(new BadRequestError(otpToken ? 'OTP verification expired. Please request a new OTP.' : 'Reset link has expired. Please request a new one.'));
            }
            return next(new BadRequestError('Invalid or malformed token'));
        }

        // OTP flow
        if (decoded.purpose === 'otp-verified') {
            userId = decoded.id;
            // Ensure OTP still valid and not reused (optional: check otpId still verified)
        } else if (decoded.purpose === 'password-reset') {
            // Legacy link flow
            userId = decoded.id;
        } else {
            return next(new BadRequestError('Invalid token purpose'));
        }

        if (!userId) return next(new BadRequestError('Invalid token'));

        const userResult = await pool.query('SELECT id, email FROM employee WHERE id = $1 AND is_archived = false', [userId]);
        if (userResult.rowCount === 0) return next(new NotFoundError('User not found'));

        const hashedPassword = await bcrypt.hash(password, 12);
        await pool.query('UPDATE employee SET password = $1, "updatedAt" = NOW() WHERE id = $2', [hashedPassword, userId]);

        // Cleanup OTPs after successful reset
        try { await pool.query('DELETE FROM "password_reset_otp" WHERE "employeeId"=$1', [userId]); } catch (_) {}

        res.json({ message: 'Password has been reset successfully. You can now log in.' });
    } catch (err) { next(err); }
};

const verifyResetToken = async (req, res, next) => {
    const schema = Joi.object({
        token: Joi.string().required(),
    });
    const { error } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));

    try {
        const decoded = jwt.verify(req.body.token, jwtConfig.secret);
        if (decoded.purpose !== 'password-reset') {
            return next(new BadRequestError('Invalid token purpose'));
        }
        res.json({ valid: true, email: decoded.email });
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return next(new BadRequestError('Token expired'));
        }
        return next(new BadRequestError('Invalid token'));
    }
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

    const { firstName, lastName, email, position, role, skills: rawSkills, responsibilities: rawResponsibilities, dob, bloodGroup, phoneNumber, emergencyContact, address, joiningDate, removeImage, includeWeeklyReport: rawIncludeWeeklyReport } = req.body;
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

        // Handle weekly report opt-in (ADMIN only, any ADMIN target in same org)
        await ensureReportingColumn();
        if (rawIncludeWeeklyReport !== undefined) {
            const parsedVal = rawIncludeWeeklyReport === 'true' || rawIncludeWeeklyReport === true;
            const isAdmin = req.user.role === 'ADMIN';
            if (!isAdmin) {
                return next(new BadRequestError('Only admins can enable weekly reports'));
            }
            // Verify target exists, is ADMIN, and in same org; allow self or admin managing another admin
            const targetRes = await pool.query(`SELECT role, "organiationId" FROM employee WHERE id=$1 AND is_archived=false`, [id]);
            if (targetRes.rowCount===0) return next(new NotFoundError('Employee not found'));
            if (targetRes.rows[0].organiationId !== req.user.organization_uuid) return next(new BadRequestError('Cannot modify user from another organization'));
            if (targetRes.rows[0].role !== 'ADMIN') return next(new BadRequestError('Only admins can be subscribed to weekly reports'));
            // If this is a reporting-only request (no other profile fields sent), handle as lightweight toggle
            const isReportingOnly = firstName===undefined && lastName===undefined && email===undefined && position===undefined && role===undefined && rawSkills===undefined && rawResponsibilities===undefined && dob===undefined && bloodGroup===undefined && phoneNumber===undefined && emergencyContact===undefined && address===undefined && joiningDate===undefined && !req.file && removeImage===undefined;
            if (isReportingOnly) {
                const r = await pool.query(`UPDATE employee SET "include_weekly_report"=$1, "updatedAt"=NOW() WHERE id=$2 RETURNING id, "include_weekly_report" as "includeWeeklyReport", email, role`, [parsedVal, id]);
                return res.json(r.rows[0]);
            }
            query += `, "include_weekly_report" = $${paramIndex}`;
            params.push(parsedVal);
            paramIndex++;
        }

        query += `, "updatedAt" = NOW() WHERE id = $${paramIndex} AND is_archived = false RETURNING id, "firstName", "lastName", email, position, role, skills, responsibilities, dob, "bloodGroup", "phoneNumber", "emergencyContact", address, "joiningDate", image, "include_weekly_report" as "includeWeeklyReport"`;
        params.push(id);

        const result = await pool.query(query, params);

        if (result.rowCount === 0) return next(new NotFoundError('Employee not found'));
        res.json(result.rows[0]);
    } catch (error) { next(error); }
};

// Delete user (soft delete)
const deleteEmployee = async (req, res, next) => {
    const { id } = req.params;
    const organizationId = req.user.organization_uuid;
    try {
        // Org isolation for soft delete
        const result = await pool.query(
            'UPDATE employee SET is_archived = true, "updatedAt" = NOW() WHERE id = $1 AND "organiationId" = $2 AND is_archived = false RETURNING id',
            [id, organizationId]
        );
        if (result.rowCount === 0) return next(new NotFoundError('Employee not found'));
        res.json({ message: 'Employee deleted' });
    } catch (error) { next(error); }
};

// Get archived employees (ADMIN only)
const getArchivedEmployees = async (req, res, next) => {
    const organizationId = req.user.organization_uuid;
    if (req.user.role !== 'ADMIN') return next(new AuthorizationError('Only admins can view archived users'));
    const { search, limit = 50, offset = 0 } = req.query;
    try {
        let query = `
            SELECT e.id, e."firstName", e."lastName", e.email, e.position, e.role, e.image, e."updatedAt" as "archivedAt", e."createdAt", e."joiningDate", e."phoneNumber"
            FROM employee e
            WHERE e."organiationId" = $1 AND e.is_archived = true
        `;
        const params = [organizationId];
        let paramIdx = 2;
        if (search) {
            query += ` AND (e."firstName" ILIKE $${paramIdx} OR e."lastName" ILIKE $${paramIdx} OR e.email ILIKE $${paramIdx})`;
            params.push(`%${search}%`);
            paramIdx++;
        }
        query += ` ORDER BY e."updatedAt" DESC LIMIT $${paramIdx} OFFSET $${paramIdx+1}`;
        params.push(parseInt(limit,10), parseInt(offset,10));
        const result = await pool.query(query, params);
        const countResult = await pool.query(
            `SELECT COUNT(*)::int as total FROM employee WHERE "organiationId"=$1 AND is_archived=true` + (search ? ` AND ("firstName" ILIKE $2 OR "lastName" ILIKE $2 OR email ILIKE $2)` : ''),
            search ? [organizationId, `%${search}%`] : [organizationId]
        );
        res.json({ users: result.rows, total: countResult.rows[0].total });
    } catch (error) { next(error); }
};

// Restore archived employee (ADMIN only)
const restoreEmployee = async (req, res, next) => {
    const { id } = req.params;
    const organizationId = req.user.organization_uuid;
    if (req.user.role !== 'ADMIN') return next(new AuthorizationError('Only admins can restore users'));
    try {
        // Check if already active or not found
        const check = await pool.query('SELECT id, email, is_archived FROM employee WHERE id=$1 AND "organiationId"=$2', [id, organizationId]);
        if (check.rowCount===0) return next(new NotFoundError('Employee not found'));
        if (!check.rows[0].is_archived) return next(new BadRequestError('User is not archived'));
        // Prevent email collision with active user (should not happen but guard)
        const emailCollision = await pool.query('SELECT id FROM employee WHERE email=$1 AND "organiationId"=$2 AND is_archived=false AND id!=$3', [check.rows[0].email, organizationId, id]);
        if (emailCollision.rowCount>0) return next(new BadRequestError('Cannot restore: email already taken by active user'));
        const result = await pool.query('UPDATE employee SET is_archived=false, "updatedAt"=NOW() WHERE id=$1 AND "organiationId"=$2 AND is_archived=true RETURNING id, "firstName", "lastName", email', [id, organizationId]);
        res.json({ message: 'User restored', user: result.rows[0] });
    } catch (error) { next(error); }
};

// Permanent delete (hard delete) - ADMIN only, anonymise comments/notes, keep assignment history
const permanentlyDeleteEmployee = async (req, res, next) => {
    const { id } = req.params;
    const organizationId = req.user.organization_uuid;
    const actorId = req.user.user_uuid;
    if (req.user.role !== 'ADMIN') return next(new AuthorizationError('Only admins can permanently delete users'));
    if (actorId === id) return next(new BadRequestError('You cannot permanently delete yourself'));
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Lock and verify
        const empRes = await client.query('SELECT id, "organiationId", is_archived, role FROM employee WHERE id=$1 FOR UPDATE', [id]);
        if (empRes.rowCount===0) { await client.query('ROLLBACK'); return next(new NotFoundError('Employee not found')); }
        const emp = empRes.rows[0];
        if (emp.organiationId !== organizationId) { await client.query('ROLLBACK'); return next(new AuthorizationError('Cannot delete user from another organization')); }
        if (!emp.is_archived) { await client.query('ROLLBACK'); return next(new BadRequestError('User must be archived before permanent deletion')); }
        // Last admin guard
        if (emp.role === 'ADMIN') {
            const adminCount = await client.query('SELECT COUNT(*)::int as cnt FROM employee WHERE "organiationId"=$1 AND role=\'ADMIN\' AND is_archived=false', [organizationId]);
            if (adminCount.rows[0].cnt === 0) {
                // No active admins left; still allow if there's another archived admin being deleted? But check total admins
                const totalAdmins = await client.query('SELECT COUNT(*)::int as cnt FROM employee WHERE "organiationId"=$1 AND role=\'ADMIN\'', [organizationId]);
                if (totalAdmins.rows[0].cnt <= 1) { await client.query('ROLLBACK'); return next(new BadRequestError('Cannot delete the last admin of organization')); }
            }
        }
        // Purge / anonymise in FK-safe order
        // 1. Devices, attendances, shifts, leaves, qr_visits, note_tags (tagged)
        await client.query('DELETE FROM "device" WHERE "employeeId"=$1', [id]);
        await client.query('DELETE FROM "attendance" WHERE "employeeId"=$1', [id]);
        await client.query('DELETE FROM "employeeshift" WHERE "employeeId"=$1', [id]);
        await client.query('DELETE FROM "leave" WHERE "employeeId"=$1', [id]);
        // qr_visit: try both table names
        try { await client.query('DELETE FROM "qr_visit" WHERE "employeeId"=$1', [id]); } catch (e1) { try{ await client.query('DELETE FROM "QRVisit" WHERE "employeeId"=$1', [id]); }catch(e2){ void e1; void e2; } }
        await client.query('DELETE FROM "note_tag" WHERE "employeeId"=$1', [id]);
        // 2. Anonymise comments/notes (keep rows, nullify author, prefix content)
        // Note: columns must be nullable (migration archive_permanent_delete.sql). If not nullable, fallback to reassign or delete.
        try {
            await client.query(`UPDATE "comment" SET "authorId"=NULL, content = '[Deleted user] ' || content, "updatedAt"=NOW() WHERE "authorId"=$1`, [id]);
        } catch (e) {
            // Fallback: if NOT NULL constraint, delete comments
            if (e.message && e.message.includes('null')) {
                await client.query('DELETE FROM "comment" WHERE "authorId"=$1', [id]);
            } else throw e;
        }
        try {
            await client.query(`UPDATE "note" SET "authorId"=NULL, "updatedAt"=NOW() WHERE "authorId"=$1`, [id]);
        } catch (e) {
            if (e.message && e.message.includes('null')) {
                await client.query('DELETE FROM "note" WHERE "authorId"=$1', [id]);
            } else throw e;
        }
        // 3. Keep assignment history: do NOT delete task_assignee; instead nullify employeeId to retain task history
        try {
            await client.query('UPDATE "task_assignee" SET "employeeId"=NULL WHERE "employeeId"=$1', [id]);
        } catch (errTaskAssignee) {
            void errTaskAssignee;
            await client.query('DELETE FROM "task_assignee" WHERE "employeeId"=$1', [id]);
        }
        // 4. Nullify project heads (headIds is uuid[] - use uuid cast)
        await client.query('UPDATE "projects" SET "headId"=NULL WHERE "headId"=$1::uuid', [id]);
        try {
            await client.query(`UPDATE "projects" SET "headIds" = array_remove("headIds", $1::uuid) WHERE $1::uuid = ANY("headIds")`, [id]);
        } catch (errHeadIds) {
            void errHeadIds;
            // Fallback: try text[] variant if column is text (legacy)
            try { await client.query(`UPDATE "projects" SET "headIds" = array_remove("headIds", $1::text) WHERE $1::text = ANY("headIds")`, [id]); } catch (e2) { void e2; }
        }
        // 5. Finally delete employee
        await client.query('DELETE FROM "employee" WHERE id=$1', [id]);
        await client.query('COMMIT');
        const logger = require('../../utils/logger');
        logger.info(`Permanent delete: actor=${actorId} deleted=${id} org=${organizationId}`);
        res.json({ message: 'User permanently deleted' });
    } catch (error) {
        try { await client.query('ROLLBACK'); } catch (errRollback) { void errRollback; }
        next(error);
    } finally {
        client.release();
    }
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
                            WHEN t.type::text IN ('SHARED', 'SEQUENTIAL') THEN
                                t.points / GREATEST((SELECT COUNT(*) FROM task_assignee ta WHERE ta."taskId" = t.id), 1)
                            ELSE
                                t.points
                        END
                    ), 0) as "yesterdayPoints"
                FROM employee e
                LEFT JOIN task t ON (
                    (t.type::text = 'SINGLE' AND t."assignedTo"::uuid = e.id) OR
                    (t.type::text IN ('SHARED', 'SEQUENTIAL') AND EXISTS (SELECT 1 FROM task_assignee ta WHERE ta."taskId" = t.id AND ta."employeeId" = e.id))
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
        const header = ['ID', 'Rank', 'First Name', 'Last Name', 'Email', 'Position', 'Role', 'Skills', 'Responsibilities', 'Weekly Points', 'Joined At', 'Date of Birth', 'Blood Group', 'Phone Number', 'Emergency Contact', 'Address', 'Image URL', 'Last Updated'];
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

// ==================== DEVICE TRACKING ====================

// Set primary device on first login
const setPrimaryDevice = async (req, res, next) => {
    const { user_uuid } = req.user;
    const { deviceId, deviceName, deviceType, browser, os } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const existingResult = await client.query(
            `SELECT id, "isPrimary" FROM device WHERE "deviceId" = $1 AND "employeeId" = $2`,
            [deviceId, user_uuid]
        );

        if (existingResult.rowCount > 0) {
            // Update existing device
            await client.query(
                `UPDATE device SET "deviceName" = $1, "deviceType" = $2, browser = $3, os = $4, "lastUsedAt" = NOW() WHERE id = $5`,
                [deviceName, deviceType, browser, os, existingResult.rows[0].id]
            );
        } else {
            // Insert new device
            await client.query(
                `INSERT INTO device ("deviceId", "deviceName", "deviceType", browser, os, "employeeId", "isPrimary")
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [deviceId, deviceName || null, deviceType || null, browser || null, os || null, user_uuid, true]
            );
        }

        // Update employee's lastDeviceId
        await client.query(
            `UPDATE employee SET "lastDeviceId" = $1 WHERE id = $2`,
            [deviceId, user_uuid]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Device registered' });
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
};

// Check for device change on login
const checkDeviceChange = async (req, res, next) => {
    const { user_uuid } = req.user;
    const { deviceId } = req.body;

    try {
        const result = await pool.query(
            `SELECT id FROM device WHERE "deviceId" = $1 AND "employeeId" = $2`,
            [deviceId, user_uuid]
        );

        if (result.rowCount === 0) {
            return res.json({ isNewDevice: true, message: 'New device detected' });
        }

        // Check if device differs from last attendance
        const attendanceResult = await pool.query(
            `SELECT "deviceId", "checkIn" FROM attendance
             WHERE "employeeId" = $1
             ORDER BY "checkIn" DESC
             LIMIT 1`,
            [user_uuid]
        );

        if (attendanceResult.rowCount > 0) {
            const lastAttendance = attendanceResult.rows[0];
            if (lastAttendance.deviceId !== deviceId) {
                return res.json({
                    deviceChanged: true,
                    lastUsedDevice: lastAttendance.deviceId,
                    lastAttendanceAt: lastAttendance.checkIn
                });
            }
        }

        res.json({ isNewDevice: false, message: 'Device recognized' });
    } catch (error) {
        next(error);
    }
};

// Reporting preference (ADMIN opt-in for weekly summary)
const getReportingPreference = async (req, res, next) => {
    try {
        await ensureReportingColumn();
        const result = await pool.query(
            `SELECT COALESCE("include_weekly_report", false) as "includeWeeklyReport" FROM employee WHERE id=$1`,
            [req.user.user_uuid]
        );
        if (result.rowCount === 0) return next(new NotFoundError('Employee not found'));
        res.json(result.rows[0]);
    } catch (error) { next(error); }
};

const updateReportingPreference = async (req, res, next) => {
    const schema = Joi.object({ includeWeeklyReport: Joi.boolean().required() });
    const { error } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));
    if (req.user.role !== 'ADMIN') return next(new BadRequestError('Only admins can enable weekly reports'));
    try {
        await ensureReportingColumn();
        const { includeWeeklyReport } = req.body;
        const result = await pool.query(
            `UPDATE employee SET "include_weekly_report"=$1, "updatedAt"=NOW() WHERE id=$2 RETURNING COALESCE("include_weekly_report", false) as "includeWeeklyReport"`,
            [includeWeeklyReport, req.user.user_uuid]
        );
        res.json(result.rows[0]);
    } catch (err) { next(err); }
};

module.exports = {
    login,
    register,
    getEmployee,
    getEmployeeById,
    getEmployeesByOrg,
    getArchivedEmployees,
    restoreEmployee,
    permanentlyDeleteEmployee,
    forgetPassword,
    forgotPassword,
    forgotPasswordLink,
    verifyOtp,
    resetPassword,
    verifyResetToken,
    updateEmployee,
    changePassword,
    deleteEmployee,
    exportUsers,
    getSkills,
    setPrimaryDevice,
    checkDeviceChange,
    getReportingPreference,
    updateReportingPreference
};