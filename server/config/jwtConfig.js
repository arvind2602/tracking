const dotenv = require('dotenv');

dotenv.config();

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
}

/**
 * JWT configuration object.
 * @property {string} secret - Signing key from environment (no fallback for security)
 * @property {string} algorithm - HMAC SHA-256
 */
const jwtConfig = {
    secret: process.env.JWT_SECRET,
    algorithm: 'HS256'
};

module.exports = {
    jwtConfig
};