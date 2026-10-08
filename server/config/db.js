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
    // Serverless (Vercel): each function instance opens its own pool, so keep it
    // small to avoid exhausting Postgres connections. Override via DB_POOL_MAX.
    max: parseInt(process.env.DB_POOL_MAX || '5', 10),
    idleTimeoutMillis: 30000,
    // Fail fast instead of hanging for 20s when the pool is saturated.
    connectionTimeoutMillis: 5000
};

const createPool = () => {
    const pool = new Pool(dbConfig);

    pool.on('error', (err, _client) => {
        console.error('Unexpected error on idle client:', err.message);
    });

    // NOTE: do NOT validate connections on 'acquire' — that handler used to run
    // `SELECT NOW()` before every real query, doubling DB round-trips per request.
    // `pg` already handles connection health via idle timeouts and error events.

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
    shutdownPool,
    // backward compat: allow `pool.connect()` where pool is this exported object
    connect: (...args) => dbPool.connect(...args),
};