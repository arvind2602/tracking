const jwt = require('jsonwebtoken');
const { jwtConfig } = require('../config/jwtConfig');

const generateJwtToken = (email, role, uuid, organization_uuid, options = {}) => {
    if (!email || typeof email !== 'string') throw new Error('Valid email required');
    console.log('Generating JWT for:', { email, role, uuid, organization_uuid });

    const tokenOptions = { ...jwtConfig, ...options, expiresIn: options.expiresIn || jwtConfig.expiresIn };

    const payload = { user: { email, role, uuid, organization_uuid } };

    return jwt.sign(payload, tokenOptions.secret, {
        expiresIn: tokenOptions.expiresIn,
        algorithm: tokenOptions.algorithm
    });
};

module.exports = { generateJwtToken };