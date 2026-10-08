/**
 * Map over items with at most `limit` in flight, preserving result order.
 * Used instead of serial `for … await` loops for fan-out work (e.g. sending
 * one email per employee) where unbounded Promise.all would hammer the
 * provider / event loop.
 */
async function pooledMap(items, limit, fn) {
    const results = new Array(items.length);
    let next = 0;

    const workers = Array.from(
        { length: Math.max(1, Math.min(limit, items.length)) },
        async () => {
            while (next < items.length) {
                const idx = next++;
                results[idx] = await fn(items[idx], idx);
            }
        }
    );

    await Promise.all(workers);
    return results;
}

module.exports = { pooledMap };
