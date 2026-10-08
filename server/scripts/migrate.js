/**
 * Idempotent schema migration — run with: npm run db:schema
 *
 * Ensures everything the app lazily relied on actually exists in the database:
 *   1. Columns/tables previously created by per-request DDL (now in utils/schemaGuard)
 *   2. Every index declared in prisma/schema.prisma (prod may never have had them —
 *      prisma/migrations contains only hand-written SQL, no real migrations)
 *   3. Additional performance indexes for hot filters/sorts
 *
 * Every statement is checked against pg_indexes first (by column list, not just
 * name), so re-running never creates duplicates. Safe to run on every deploy.
 *
 * Note: CREATE INDEX takes a lock that blocks writes on that table for the
 * duration — run against a quiet database (first deploy / off-peak).
 */
const { pool, shutdownPool } = require('../config/db');

// ---------------------------------------------------------------------------
// 1. DDL previously run per-request (see utils/schemaGuard.js)
// ---------------------------------------------------------------------------
const DDL = [
    `ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "include_weekly_report" BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "areaOfExpertise" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`,
    `ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "yearsOfExperience" INTEGER`,
    `ALTER TABLE "organiation" ADD COLUMN IF NOT EXISTS "dailyRequiredHours" DOUBLE PRECISION NOT NULL DEFAULT 9`,
    `ALTER TABLE "organiation" ADD COLUMN IF NOT EXISTS "aiTaskCheckerEnabled" BOOLEAN DEFAULT false`,
    `CREATE TABLE IF NOT EXISTS "password_reset_otp" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "employeeId" UUID NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
        "otpHash" TEXT NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        attempts INT DEFAULT 0,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "verifiedAt" TIMESTAMPTZ
    )`,
    `CREATE INDEX IF NOT EXISTS "password_reset_otp_employeeId_idx" ON "password_reset_otp"("employeeId")`,
    `CREATE INDEX IF NOT EXISTS "password_reset_otp_expiresAt_idx" ON "password_reset_otp"("expiresAt")`,
];

// ---------------------------------------------------------------------------
// 2 + 3. Indexes: [table, columns]
//   - "columns" is the exact SQL column list for CREATE INDEX (identifiers
//     quoted as in the real schema, expressions and DESC allowed).
//   - The duplicate check compares a normalized (lowercased, de-quoted) form
//     against pg_indexes.indexdef, so casing never causes duplicates.
// ---------------------------------------------------------------------------
const INDEXES = [
    // --- from prisma/schema.prisma ---
    ['organiation', 'name'],
    ['employee', '"organiationId", is_archived'],
    ['employee', '"organiationId", role'],
    ['employee', 'email'],
    ['employee', '"organiationId", role, include_weekly_report'],
    ['projects', '"organiationId", is_archived'],
    ['projects', '"organiationId", priority_order'],
    ['projects', '"organiationId", status'],
    ['project_hold_history', '"projectId"'],
    ['task', '"projectId", status'],
    ['task', '"assignedTo", status, "updatedAt" DESC'],
    ['task', '"projectId"'],
    ['task', '"projectId", "order", "createdAt" DESC'],
    ['task', '"parentId"'],
    ['task_assignee', '"taskId", "employeeId"'],
    ['task_assignee', '"taskId"'],
    ['task_assignee', '"employeeId"'],
    ['comment', '"authorId"'],
    ['comment', '"taskId", "createdAt" DESC'],
    ['comment_attachment', '"commentId"'],
    ['comment_link', '"commentId"'],
    ['note', '"organizationId", type'],
    ['note', '"authorId"'],
    ['note', '"projectId"'],
    ['note', '"isPinned", "organizationId"'],
    ['note_attachment', '"noteId"'],
    ['note_link', '"noteId"'],
    ['note_tag', '"noteId", "employeeId"'],
    ['note_tag', '"noteId"'],
    ['note_tag', '"employeeId"'],
    ['device', '"deviceId", "employeeId"'],
    ['device', '"employeeId", "isPrimary"'],
    ['device', '"deviceId"'],
    ['attendance', '"employeeId", date'],
    ['attendance', 'date'],
    ['attendance', 'status'],
    ['attendance', '"shiftId"'],
    ['"leave"', '"employeeId"'],
    ['"leave"', '"organizationId"'],
    ['"leave"', 'status'],
    ['employeeshift', '"employeeId", "shiftId"'],
    ['employeeshift', '"employeeId"'],
    ['employeeshift', '"shiftId"'],
    ['geofence', '"organizationId", name'],
    ['geofence', '"organizationId"'],
    ['organizationgeofence', '"organizationId", "geofenceId"'],
    ['organizationgeofence', '"geofenceId"'],
    ['qr_location', '"organizationId"'],
    ['building', '"organizationId"'],
    ['floor', '"buildingId"'],
    ['zone', '"floorId"'],
    ['qr_visit', '"employeeId"'],
    ['qr_visit', '"locationId"'],
    ['push_device', '"employeeId", "isActive"'],

    // --- new performance indexes (audit) ---
    ['task', '"completedAt"'],                                // range scans (queryBuilders, loginPopup, auth)
    ['task', '"createdAt"'],                                  // default sort / recency filters
    ['task', '"updatedAt"'],                                  // 12-week windows, recent activity
    ['task', '"dueDate"'],                                    // overdue filters (task, analytics, summary)
    ['task', '"createdBy"'],                                  // filter + join
    ['task', 'status'],                                       // org-wide group/filter (composites lead with projectId)
    ['task', 'lower(status)'],                                // LOWER(status) IN (...) filters everywhere
    ['"leave"', '"organizationId", status'],                  // PENDING leave counts per org
];

function normalizeIndexDef(def) {
    // "CREATE [UNIQUE] INDEX name ON public.tbl USING btree (cols)" → "cols"
    return def
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/"/g, '')
        .replace(/.*?using (btree|hash|gin|gist) /, '')
        .replace(/ where .*$/, '')
        .replace(/[;,]$/, '')
        .trim()
        // strip the OUTER parens only, so targets compare column-for-column
        // (inner parens in expression indexes like (lower(status)) survive)
        .replace(/^\((.*)\)$/, '$1');
}

async function ensureIndex(table, cols) {
    const bareTable = table.replace(/"/g, '');
    const { rows } = await pool.query(
        `SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1`,
        [bareTable]
    );
    const target = cols.toLowerCase().replace(/\s+/g, ' ').replace(/"/g, '').trim();

    const covered = rows.some((r) => {
        const existing = normalizeIndexDef(r.indexdef);
        // Exact column list, or an existing index whose columns start with ours.
        return existing === target || existing.startsWith(`${target},`);
    });

    if (covered) return false;

    // Name derived from the NORMALIZED target, so it stays lowercase and
    // stable regardless of how cols are written above.
    const indexName = `idx_${bareTable}_${target.replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '')}`;
    await pool.query(`CREATE INDEX IF NOT EXISTS "${indexName}" ON "${bareTable}" (${cols})`);
    return true;
}

(async () => {
    let created = 0;

    for (const sql of DDL) {
        try {
            await pool.query(sql);
        } catch (err) {
            // e.g. ALTER without IF NOT EXISTS support quirks — report, keep going.
            console.error(`DDL failed: ${err.message}\n  > ${sql.split('\n')[0]}`);
        }
    }
    console.log(`DDL ensured (${DDL.length} statements).`);

    for (const [table, cols] of INDEXES) {
        try {
            if (await ensureIndex(table, cols)) {
                created += 1;
                console.log(`  + index on ${table} (${cols})`);
            }
        } catch (err) {
            console.error(`  ! index ${table}(${cols}) failed: ${err.message}`);
        }
    }

    console.log(created === 0 ? 'All indexes already present.' : `Created ${created} index(es).`);
    await shutdownPool();
    process.exit(0);
})().catch(async (err) => {
    console.error(err);
    await shutdownPool().catch(() => {});
    process.exit(1);
});
