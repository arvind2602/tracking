const dotenv = require('dotenv');

dotenv.config();

const jwtConfig = {
    secret: process.env.JWT_SECRET || 'default-secret-fallback',
    expiresIn: '24d',
    algorithm: 'HS256'
};

module.exports = {
    jwtConfig
};