const Joi = require('joi');
const pool = require('../../config/db');
const { v4: uuidv4 } = require('uuid');
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
            'SELECT id, "firstName", "lastName", email, position, role, "organiationId" FROM employee WHERE id = $1 AND is_archived = false',
            [user_uuid]
        );
        if (result.rowCount === 0) return next(new NotFoundError('Employee not found'));
        res.json(result.rows[0]);
    } catch (error) { next(error); }
};

// View all in organization
const getEmployeesByOrg = async (req, res, next) => {
    const  organizationId  = req.user.organization_uuid;
    console.log('Fetching employees for organization:', organizationId);
    try {
        const result = await pool.query(
            'SELECT id, "firstName", "lastName", email, position, role FROM employee WHERE "organiationId" = $1 AND is_archived = false',
            [organizationId]
        );
        res.json(result.rows);
    } catch (error) { next(error); }
};



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
    const { firstName, lastName, position, role } = req.body;
    try {
        const result = await pool.query(
            `UPDATE employee SET "firstName" = $1, "lastName" = $2, position = $3, role = $4, "updatedAt" = NOW()
             WHERE id = $5 AND is_archived = false RETURNING id, "firstName", "lastName", email, position, role`,
            [firstName, lastName, position, role, id]
        );
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
    getEmployeesByOrg,
    forgetPassword,
    updateEmployee,
    deleteEmployee,
    
};