const Joi = require('joi');
const bcrypt = require('bcrypt');
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
            admin.organiationId,
            null
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


module.exports = {
    registerOrganization
};