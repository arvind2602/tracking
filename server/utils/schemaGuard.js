const { pool } = require('../config/db');

/**
 * One-time, idempotent schema guards.
 *
 * These DDL statements (`ALTER TABLE ... IF NOT EXISTS`) used to run on EVERY
 * request to several hot endpoints, taking an ACCESS EXCLUSIVE lock on the
 * table and adding 1-3 extra round-trips per call. Now each statement set runs
 * at most once per process (memoized promise), and a failed run is evicted so
 * the next call retries.
 *
 * Prefer applying these via `npm run db:schema` at deploy; the guards are a
 * safety net for instances that boot before a migration has been applied.
 */
const runs = new Map();

function once(key, statements) {
    if (!runs.has(key)) {
        const promise = (async () => {
            for (const sql of statements) {
                try {
                    await pool.query(sql);
                } catch (err) {
                    // Evict so the next request retries a transient failure.
                    runs.delete(key);
                    console.error(`schemaGuard[${key}] failed: ${err.message}`);
                    return;
                }
            }
        })();
        runs.set(key, promise);
    }
    return runs.get(key);
}

module.exports = {
    /** employee.include_weekly_report (weekly summary opt-in) */
    ensureReportingColumn: () =>
        once('employee:include_weekly_report', [
            `ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "include_weekly_report" BOOLEAN NOT NULL DEFAULT false`,
        ]),

    /** employee.areaOfExpertise / employee.yearsOfExperience (see prisma/migrations/expertise_experience.sql) */
    ensureExpertiseColumns: () =>
        once('employee:expertise', [
            `ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "areaOfExpertise" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`,
            `ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "yearsOfExperience" INTEGER`,
        ]),

    /** organiation.dailyRequiredHours */
    ensureDailyRequiredColumn: () =>
        once('organiation:dailyRequiredHours', [
            `ALTER TABLE organiation ADD COLUMN IF NOT EXISTS "dailyRequiredHours" DOUBLE PRECISION NOT NULL DEFAULT 9`,
        ]),

    /** organiation.aiTaskCheckerEnabled */
    ensureAiTaskCheckerColumn: () =>
        once('organiation:aiTaskCheckerEnabled', [
            `ALTER TABLE organiation ADD COLUMN IF NOT EXISTS "aiTaskCheckerEnabled" BOOLEAN DEFAULT false`,
        ]),

    /** password_reset_otp table + indexes (see prisma/migrations/password_reset_otp.sql) */
    ensurePasswordResetOtp: () =>
        once('password_reset_otp', [
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
        ]),

    /** project_member table + indexes (see prisma/migrations/project_members.sql) */
    ensureProjectMemberTable: () =>
        once('project_member', [
            `CREATE TABLE IF NOT EXISTS "project_member" (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "projectId" UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                "employeeId" UUID NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT "project_member_project_employee_key" UNIQUE ("projectId", "employeeId")
            )`,
            `CREATE INDEX IF NOT EXISTS "project_member_employeeId_idx" ON "project_member"("employeeId")`,
        ]),
};
