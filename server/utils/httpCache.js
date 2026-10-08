/**
 * Tiny per-process in-memory TTL cache for expensive GET endpoints.
 *
 * Meant for read-only aggregate routes (dashboards, reports, analytics) that
 * recompute 10+ queries on every request. Mount AFTER authMiddleware and key
 * on the authenticated user + org so responses never cross users.
 *
 * Notes:
 * - Server-side only; responses are sent with `Cache-Control: no-store` so
 *   browsers/proxies never reuse a body across users.
 * - Each Vercel function instance keeps its own cache (no shared memory), so
 *   this helps most on warm instances and repeated navigation.
 */

const MAX_ENTRIES = 500;
const store = new Map(); // key -> { body: string, expiresAt: number }

// Periodically drop expired entries; unref so it never keeps the process alive.
const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
        if (entry.expiresAt <= now) store.delete(key);
    }
}, 60_000);
if (typeof sweeper.unref === 'function') sweeper.unref();

function buildKey(req) {
    const u = req.user || {};
    return `${u.user_uuid || 'anon'}|${u.organization_uuid || 'no-org'}|${req.originalUrl}`;
}

/**
 * @param {number} ttlMs time-to-live in milliseconds
 * @returns {import('express').RequestHandler}
 */
function httpCache(ttlMs) {
    return (req, res, next) => {
        // Only plain GETs; bypass on client-requested revalidation.
        const cacheControl = String(req.headers['cache-control'] || '');
        if (req.method !== 'GET' || cacheControl.includes('no-cache')) {
            return next();
        }

        const key = buildKey(req);
        const hit = store.get(key);
        if (hit && hit.expiresAt > Date.now()) {
            res.set('X-Cache', 'HIT');
            res.set('Cache-Control', 'no-store');
            res.type('application/json');
            return res.send(hit.body);
        }

        // Cache miss — capture the JSON body if this succeeds.
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            if (res.statusCode === 200) {
                const bodyString = JSON.stringify(body);
                if (bodyString.length <= 2_000_000) {
                    // Enforce the size cap (Map preserves insertion order → oldest first).
                    while (store.size >= MAX_ENTRIES) {
                        store.delete(store.keys().next().value);
                    }
                    store.set(key, { body: bodyString, expiresAt: Date.now() + ttlMs });
                }
            }
            return originalJson(body);
        };
        res.set('X-Cache', 'MISS');
        res.set('Cache-Control', 'no-store');
        next();
    };
}

module.exports = httpCache;
