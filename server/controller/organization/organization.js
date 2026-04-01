const Joi = require('joi');
const bcrypt = require('bcryptjs');
const { pool } = require('../../config/db');
const { BadRequestError } = require('../../utils/errors');
const { generateJwtToken } = require('../../utils/jwtGenerator');


const registerOrganization = async (req, res, next) => {
    const schema = Joi.object({
        orgName: Joi.string().required(),
        adminFirstName: Joi.string().required(),
        adminLastName: Joi.string().required(),
        adminEmail: Joi.string().email().required(),
        adminPassword: Joi.string().min(6).required(),
        adminPosition: Joi.string().required()
    });

    const { error } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));

    const {
        orgName,
        adminFirstName,
        adminLastName,
        adminEmail,
        adminPassword,
        adminPosition
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Create Organization
        const orgResult = await client.query(
            'INSERT INTO organiation (name) VALUES ($1) RETURNING id',
            [orgName]
        );
        const orgId = orgResult.rows[0].id;

        // Hash password
        const hashedPassword = await bcrypt.hash(adminPassword, 12);

        // Create Admin Employee
        const adminResult = await client.query(
            `INSERT INTO employee ("firstName", "lastName", email, password, position, role, "organiationId")
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, email, role, "organiationId"`,
            [adminFirstName, adminLastName, adminEmail, hashedPassword, adminPosition, 'ADMIN', orgId]
        );

        const admin = adminResult.rows[0];

        // Generate token
        const token = generateJwtToken(
            admin.email,
            admin.role,
            admin.id,
            admin.organiationId
        );

        await client.query('COMMIT');

        res.status(201).json({
            organization: { id: orgId, name: orgName },
            admin: { id: admin.id, email: admin.email, role: 'admin' },
            token
        });
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
};


const getOrganizationSettings = async (req, res, next) => {
    const orgId = req.user.organization_uuid;

    try {
        const result = await pool.query(
            `SELECT o.id, o.name, "showBanner", "showLoginPopup", logo,
                    "weekOffs", holidays, "wfhEnabled",
                    og."isEnabled" as "geofencingEnabled",
                    g.latitude, g.longitude, g.radius
             FROM organiation o
             LEFT JOIN organizationgeofence og ON o.id = og."organizationId" AND og."isEnabled" = true
             LEFT JOIN geofence g ON g.id = og."geofenceId"
             WHERE o.id = $1`,
            [orgId]
        );

        if (result.rowCount === 0) {
            return next(new BadRequestError('Organization not found'));
        }

        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
};

const updateOrganizationSettings = async (req, res, next) => {
    const orgId = req.user.organization_uuid;
    const { name, showBanner, logo, geofencingEnabled, geofenceId, latitude, longitude, radius } = req.body;

    if (req.user.role !== 'ADMIN') {
        return next(new BadRequestError('Only admins can update organization settings'));
    }

    try {
        let logoUrl = logo;
        if (req.file) {
            const { uploadToCloudinary } = require('../../config/cloudinary');
            logoUrl = await uploadToCloudinary(req.file, 'logo');
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Build update query for organization
            let query = 'UPDATE organiation SET "updatedAt" = NOW()';
            const params = [];
            let paramIndex = 1;

            if (name !== undefined) {
                query += `, name = $${paramIndex}`;
                params.push(name);
                paramIndex++;
            }

            if (showBanner !== undefined) {
                const showBannerBool = showBanner === 'true' || showBanner === true;
                query += `, "showBanner" = $${paramIndex}`;
                params.push(showBannerBool);
                paramIndex++;
            }

            const { showLoginPopup } = req.body;
            if (showLoginPopup !== undefined) {
                const showLoginPopupBool = showLoginPopup === 'true' || showLoginPopup === true;
                query += `, "showLoginPopup" = $${paramIndex}`;
                params.push(showLoginPopupBool);
                paramIndex++;
            }

            if (logoUrl) {
                query += `, logo = $${paramIndex}`;
                params.push(logoUrl);
                paramIndex++;
            }

            const { weekOffs, holidays, wfhEnabled } = req.body;
            if (weekOffs !== undefined) {
                const weekOffsArr = Array.isArray(weekOffs) ? weekOffs : JSON.parse(weekOffs);
                query += `, "weekOffs" = $${paramIndex}`;
                params.push(weekOffsArr);
                paramIndex++;
            }

            if (holidays !== undefined) {
                const holidaysArr = Array.isArray(holidays) ? holidays : JSON.parse(holidays);
                query += `, holidays = $${paramIndex}`;
                params.push(JSON.stringify(holidaysArr));
                paramIndex++;
            }

            if (wfhEnabled !== undefined) {
                const wfhEnabledBool = wfhEnabled === 'true' || wfhEnabled === true;
                query += `, "wfhEnabled" = $${paramIndex}`;
                params.push(wfhEnabledBool);
                paramIndex++;
            }

            query += ` WHERE id = $${paramIndex} RETURNING id`;
            params.push(orgId);

            await client.query(query, params);

            // Handle geofencing settings
            if (geofencingEnabled !== undefined || latitude !== undefined || longitude !== undefined || radius !== undefined) {
                // Sanitize coordinates and radius to be numbers
                const lat = latitude === 'null' || latitude === null ? 0 : parseFloat(latitude) || 0;
                const lng = longitude === 'null' || longitude === null ? 0 : parseFloat(longitude) || 0;
                const rad = radius === 'null' || radius === null ? 0 : parseFloat(radius) || 0;

                // Get or create geofence
                let gfId = geofenceId;
                if (!gfId && (latitude !== undefined || longitude !== undefined || radius !== undefined)) {
                    const gfResult = await client.query(
                        `INSERT INTO geofence (name, latitude, longitude, radius, "organizationId")
                         VALUES ($1, $2, $3, $4, $5)
                         ON CONFLICT ("organizationId", name) DO UPDATE SET
                           latitude = EXCLUDED.latitude,
                           longitude = EXCLUDED.longitude,
                           radius = EXCLUDED.radius,
                           "updatedAt" = NOW()
                         RETURNING id`,
                        ['Office', lat, lng, rad, orgId]
                    );
                    gfId = gfResult.rows[0].id;
                }

                if (gfId) {
                    // Set or update organization geofence link
                    await client.query(
                        `INSERT INTO organizationgeofence ("organizationId", "geofenceId", "isEnabled")
                         VALUES ($1, $2, $3)
                         ON CONFLICT ("organizationId", "geofenceId")
                         DO UPDATE SET "isEnabled" = $3`,
                        [orgId, gfId, geofencingEnabled === 'true' || geofencingEnabled === true]
                    );
                }
            }

            // Fetch updated settings
            const result = await client.query(
                `SELECT o.id, o.name, "showBanner", "showLoginPopup", logo,
                        "weekOffs", holidays, "wfhEnabled",
                        og."isEnabled" as "geofencingEnabled",
                        g.latitude, g.longitude, g.radius
                 FROM organiation o
                 LEFT JOIN organizationgeofence og ON o.id = og."organizationId" AND og."isEnabled" = true
                 LEFT JOIN geofence g ON g.id = og."geofenceId"
                 WHERE o.id = $1`,
                [orgId]
            );

            await client.query('COMMIT');
            res.json(result.rows[0]);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        next(error);
    }
};

module.exports = {
    registerOrganization,
    getOrganizationSettings,
    updateOrganizationSettings
};