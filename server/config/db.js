const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();
// Centralized database configuration
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
    throw new Error('DATABASE_URL is not defined.');
}

const dbConfig = {
    connectionString: `${dbUrl}?sslmode=require`,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000
};

/**
 * Creates and configures a PostgreSQL connection pool
 * @returns {Pool} Configured connection pool instance
 */
const createPool = () => {
    const pool = new Pool(dbConfig);

    // Error handling for idle clients
    pool.on('error', (err, _client) => {
        console.error('Unexpected error on idle client:', err.message);
    });

    // Connection validation on acquire
    pool.on('acquire', async (client) => {
        try {
            await client.query('SELECT NOW()');
        } catch (err) {
            console.error('Database connection validation failed:', err.message);
        }
    });

    return pool;
};

// Singleton pool instance
const dbPool = createPool();

// Graceful shutdown handler
const shutdownPool = async () => {
    try {
        await dbPool.end();
        console.log('Database pool closed');
    } catch (err) {
        console.error('Error closing database pool:', err.message);
    }
};

// Query wrapper for better error handling
const query = async (text, params) => {
    try {
        const result = await dbPool.query(text, params);
        return result;
    } catch (err) {
        throw new Error(`Database query failed: ${err.message}`, { cause: err });
    }
};

// Export database utilities
module.exports = {
    pool: dbPool,
    query,
    shutdownPool
};