const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

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

const createPool = () => {
    const pool = new Pool(dbConfig);

    pool.on('error', (err, _client) => {
        console.error('Unexpected error on idle client:', err.message);
    });

    pool.on('acquire', async (client) => {
        try {
            await client.query('SELECT NOW()');
        } catch (err) {
            console.error('Database connection validation failed:', err.message);
        }
    });

    return pool;
};

const dbPool = createPool();

// Create a separate query function that uses the original pool.query
const customQuery = async (text, params) => {
    try {
        // Use the prototype's query or the original pool instance's underlying query
        // Since we already overwrote pool.query, we need to be careful.
        // The safest way is to NOT overwrite pool.query if we want to use it inside customQuery.
        const result = await dbPool.query(text, params);
        return result;
    } catch (err) {
        throw new Error(`Database query failed: ${err.message}`, { cause: err });
    }
};

const shutdownPool = async () => {
    try {
        await dbPool.end();
        console.log('Database pool closed');
    } catch (err) {
        console.error('Error closing database pool:', err.message);
    }
};

// Instead of overwriting, we export an object that matches the expected patterns
// OR we export the pool and add a DIFFERENT function name for the wrapper.

module.exports = {
    pool: dbPool,
    query: customQuery,
    shutdownPool
};