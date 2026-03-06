const jwt = require('jsonwebtoken');
const { jwtConfig } = require('../config/jwtConfig');

const generateJwtToken = (email, role, uuid, organization_uuid, options = {}) => {
    if (!email || typeof email !== 'string') throw new Error('Valid email required');

    const safeOptions = options || {};
    const tokenOptions = { ...jwtConfig, ...safeOptions, expiresIn: safeOptions.expiresIn || jwtConfig.expiresIn };
    const payload = { user: { email, role, uuid, organization_uuid } };

    const signOptions = {
        algorithm: tokenOptions.algorithm
    };

    if (tokenOptions.expiresIn) {
        signOptions.expiresIn = tokenOptions.expiresIn;
    }

    return jwt.sign(payload, tokenOptions.secret, signOptions);
};

module.exports = { generateJwtToken };