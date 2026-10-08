/* eslint-disable no-console */
/**
 * Verifies the push-notification setup end-to-end (no side effects):
 *   1. push_device table exists in the database
 *   2. firebase-admin can authenticate with FIREBASE_SERVICE_ACCOUNT
 *   3. FCM accepts a dry-run message to the "global" topic
 *
 * Usage: node scripts/verify-notifications-setup.js
 */
require('dotenv').config();

const checks = [];

async function main() {
  // --- 1. Database table -------------------------------------------------
  try {
    const { pool } = require('../config/db');
    const r = await pool.query(
      `SELECT to_regclass('public.push_device') AS table_name,
              (SELECT COUNT(*)::int FROM "push_device") AS rows`
    );
    const name = r.rows[0].table_name;
    checks.push({
      name: 'push_device table exists',
      ok: name === 'push_device',
      detail: `to_regclass=${name}, rows=${r.rows[0].rows}`,
    });
    await pool.end();
  } catch (err) {
    checks.push({ name: 'push_device table exists', ok: false, detail: err.message });
  }

  // --- 2 + 3. Firebase credentials + FCM dry-run --------------------------
  const push = require('../utils/pushNotifications');
  checks.push({
    name: 'FIREBASE_SERVICE_ACCOUNT configured & valid',
    ok: push.isConfigured(),
    detail: push.isConfigured() ? 'firebase-admin initialized' : 'not configured (check .env / key contents)',
  });

  const dry = await push.dryRunSend(
    push.buildMessage({
      title: 'VigTask setup check',
      body: 'Dry-run only — nothing was delivered.',
      link: '/dashboard',
      type: 'setup_check',
    }),
    { topic: 'global' }
  );
  checks.push({
    name: 'FCM dry-run send to topic "global"',
    ok: dry.ok,
    detail: dry.ok ? `messageId=${dry.messageId}` : dry.error,
  });

  // --- Report -------------------------------------------------------------
  let failed = 0;
  for (const c of checks) {
    if (!c.ok) failed += 1;
    console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name} — ${c.detail}`);
  }
  console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) FAILED.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Verifier crashed:', err);
  process.exit(1);
});
