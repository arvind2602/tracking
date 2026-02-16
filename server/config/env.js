const dotenv = require('dotenv');
dotenv.config();

/**
 * Centralized environment configuration with fail-fast validation.
 * All environment-dependent values should be accessed through this module.
 */

const requiredVars = ['DATABASE_URL', 'JWT_SECRET', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];

for (const key of requiredVars) {
    if (!process.env[key]) {
        throw new Error(`Missing required environment variable: ${key}. See .env.example for reference.`);
    }
}

module.exports = {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRY: process.env.JWT_EXPIRY || '24h',
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    PORT: parseInt(process.env.PORT || '5000', 10),
    NODE_ENV: process.env.NODE_ENV || 'development',
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
    DB_POOL_MAX: parseInt(process.env.DB_POOL_MAX || '20', 10),
};
