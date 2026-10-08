/* global fetch */
/* eslint-disable no-console */
/**
 * End-to-end API smoke test for the push-notification endpoints.
 *
 * What it proves:
 *   T1  POST /api/notifications/devices registers a fake device token (201)
 *   T2  GET  /api/notifications/devices lists it back (200)
 *   T3  POST /api/notifications/test performs an FCM dry-run (200 + messageId)
 *   T4  POST /api/notifications/test rejects a wrong cron secret (401)
 *   T5  POST /api/notifications/devices rejects a missing JWT (401)
 *   T6  Leave hook end-to-end: applyLeave notifies the org admin's device,
 *       FCM reports the fake token invalid → server purges it (isActive=false)
 *   T7  POST /api/notifications/broadcast really sends to topic "global" (200)
 *   T8  createTask hook → "New task assigned" push (token purged)
 *   T9  createComment hook → "New comment" push (token purged)
 *   T10 changeTaskStatus hook → "Task status updated" push (token purged)
 *
 * Test rows (fake device + smoke leave) are deleted afterwards.
 * Usage: node scripts/smoke-notifications.js
 */
require('dotenv').config();

const { spawn } = require('child_process');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const PORT = 3999;
const BASE = `http://localhost:${PORT}`;
const FAKE_TOKEN = 'smoke-test-fcm-token-0000000000000000000';
const LEAVE_REASON = 'smoke-test-leave (safe to delete)';

const results = [];
const serverLog = [];
let serverProc = null;
let smokeTaskId = null;

const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const call = async (method, urlPath, { body, headers = {} } = {}) => {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch (_) { /* non-JSON */ }
  return { status: res.status, json };
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitReady(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/notifications/devices`);
      if (res.status === 401 || res.status === 200) return true; // server up (auth required)
    } catch (_) { /* not up yet */ }
    await sleep(400);
  }
  return false;
}

async function main() {
  // --- Pick an org that has both an admin and a non-admin employee --------
  const org = await pool.query(`
    SELECT
      (SELECT id FROM employee a WHERE a."organiationId" = o."organiationId"
         AND a.role = 'ADMIN' AND a.is_archived = false LIMIT 1) AS admin_id,
      (SELECT id FROM employee e WHERE e."organiationId" = o."organiationId"
         AND e.role <> 'ADMIN' AND e.is_archived = false LIMIT 1) AS applicant_id,
      (SELECT e."organiationId" FROM employee e WHERE e."organiationId" = o."organiationId"
         AND e.is_archived = false LIMIT 1) AS org_id,
      (SELECT p.id FROM projects p WHERE p."organiationId" = o."organiationId"
         AND p.is_archived = false LIMIT 1) AS project_id
    FROM (SELECT DISTINCT "organiationId" FROM employee WHERE is_archived = false) o
    WHERE EXISTS (SELECT 1 FROM employee a2 WHERE a2."organiationId" = o."organiationId"
                    AND a2.role = 'ADMIN' AND a2.is_archived = false)
      AND EXISTS (SELECT 1 FROM employee e2 WHERE e2."organiationId" = o."organiationId"
                    AND e2.role <> 'ADMIN' AND e2.is_archived = false)
      AND EXISTS (SELECT 1 FROM projects p2 WHERE p2."organiationId" = o."organiationId"
                    AND p2.is_archived = false)
    LIMIT 1
  `);
  if (org.rowCount === 0) {
    check('seed data (admin + non-admin + project in one org)', false, 'no suitable org found in DB');
    return finish(null);
  }
  const { admin_id: adminId, applicant_id: applicantId, org_id: orgId, project_id: projectId } = org.rows[0];
  check('seed data (admin + non-admin + project in one org)', true, `org=${orgId}, project=${projectId}`);

  const signFor = (uuid, email, role) =>
    jwt.sign({ user: { uuid, email, role, organization_uuid: orgId } },
      process.env.JWT_SECRET, { expiresIn: '1h' });
  const adminEmail = (await pool.query(`SELECT email FROM employee WHERE id = $1`, [adminId])).rows[0].email;
  const applicantEmail = (await pool.query(`SELECT email FROM employee WHERE id = $1`, [applicantId])).rows[0].email;
  const adminToken = signFor(adminId, adminEmail, 'ADMIN');
  const applicantToken = signFor(applicantId, applicantEmail, 'USER');

  // --- Start the server ----------------------------------------------------
  serverProc = spawn(process.execPath, ['api/index.js'], {
    cwd: require('path').resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  serverProc.stdout.on('data', (d) => serverLog.push(d.toString()));
  serverProc.stderr.on('data', (d) => serverLog.push(d.toString()));

  if (!(await waitReady())) {
    check('server starts', false, `not reachable at ${BASE} within 30s`);
    return finish(null);
  }
  check('server starts', true, BASE);

  let leaveId = null;
  try {
    // --- T1: register fake device as admin ---------------------------------
    const t1 = await call('POST', '/api/notifications/devices', {
      body: { token: FAKE_TOKEN, platform: 'android', deviceName: 'smoke-test-device' },
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    check('T1 register device (JWT)', t1.status === 201 && t1.json?.success === true,
      `status=${t1.status}`);

    // --- T2: list devices ---------------------------------------------------
    const t2 = await call('GET', '/api/notifications/devices', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const listed = Array.isArray(t2.json) && t2.json.some((d) => d.deviceName === 'smoke-test-device');
    check('T2 list devices (JWT)', t2.status === 200 && listed,
      `status=${t2.status}, devices=${Array.isArray(t2.json) ? t2.json.length : 'n/a'}`);

    // --- T3: dry-run test endpoint -----------------------------------------
    const t3 = await call('POST', '/api/notifications/test', {
      body: {},
      headers: { 'X-CRON-SECRET': process.env.CRON_SECRET },
    });
    check('T3 FCM dry-run via /test (cron secret)',
      t3.status === 200 && t3.json?.ok === true && t3.json?.dryRun === true,
      `status=${t3.status}, messageId=${t3.json?.messageId || t3.json?.error}`);

    // --- T4: wrong cron secret ---------------------------------------------
    const t4 = await call('POST', '/api/notifications/test', {
      body: {},
      headers: { 'X-CRON-SECRET': 'wrong-secret' },
    });
    check('T4 /test rejects wrong cron secret', t4.status === 401, `status=${t4.status}`);

    // --- T5: no JWT ---------------------------------------------------------
    const t5 = await call('POST', '/api/notifications/devices', {
      body: { token: FAKE_TOKEN },
    });
    check('T5 /devices rejects missing JWT', t5.status === 401, `status=${t5.status}`);

    // --- T6: leave hook end-to-end -----------------------------------------
    const activeBefore = (await pool.query(
      `SELECT "isActive" FROM "push_device" WHERE "fcmToken" = $1`, [FAKE_TOKEN])).rows[0]?.isActive;
    const t6 = await call('POST', '/api/attendance/leave/apply', {
      body: {
        startDate: '2026-10-10',
        endDate: '2026-10-10',
        type: 'Casual',
        reason: LEAVE_REASON,
      },
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    const leaveIdResp = t6.json?.data?.id;
    leaveId = leaveIdResp || null;
    check('T6a applyLeave accepted (hook fired)', t6.status === 200 && t6.json?.success === true,
      `status=${t6.status}, leaveId=${leaveIdResp || 'n/a'}`);

    // give the fire-and-forget push time to reach FCM and purge the bad token
    await sleep(4000);
    const afterRow = (await pool.query(
      `SELECT "isActive" FROM "push_device" WHERE "fcmToken" = $1`, [FAKE_TOKEN])).rows[0];
    check('T6b leave hook pushed to admin device → invalid token purged',
      activeBefore === true && afterRow?.isActive === false,
      `activeBefore=${activeBefore}, activeAfter=${afterRow?.isActive}`);

    // --- T7: real broadcast to topic "global" -------------------------------
    const t7 = await call('POST', '/api/notifications/broadcast', {
      body: {
        title: 'VigTask smoke test',
        body: 'API broadcast endpoint is working.',
        link: '/dashboard',
      },
      headers: { 'X-CRON-SECRET': process.env.CRON_SECRET },
    });
    check('T7 real broadcast to topic "global"',
      t7.status === 200 && t7.json?.ok === true,
      `status=${t7.status}, messageId=${t7.json?.messageId || t7.json?.error}`);

    // --- T8-T10: task hooks end-to-end --------------------------------------
    const registerDeviceAgain = async () => {
      const r = await call('POST', '/api/notifications/devices', {
        body: { token: FAKE_TOKEN, platform: 'android', deviceName: 'smoke-test-device' },
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      return r.status === 201;
    };
    const tokenActive = async () =>
      (await pool.query(`SELECT "isActive" FROM "push_device" WHERE "fcmToken" = $1`, [FAKE_TOKEN]))
        .rows[0]?.isActive;

    // T8: createTask → "New task assigned" to the admin assignee
    await registerDeviceAgain();
    const t8 = await call('POST', '/api/tasks', {
      body: {
        description: 'smoke-test task (safe to delete)',
        status: 'pending', // required: createTask reads raw req.body (Joi defaults not applied)
        points: 1,
        projectId,
        assignedTo: adminId,
        priority: 'LOW',
        dueDate: null,
        parentId: null,
        type: 'SINGLE',
      },
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    smokeTaskId = t8.json?.id || null;
    check('T8a createTask accepted (hook fired)', t8.status === 201 && Boolean(smokeTaskId),
      `status=${t8.status}, taskId=${smokeTaskId || 'n/a'}, body=${JSON.stringify(t8.json)}`);
    await sleep(4000);
    const t8active = await tokenActive();
    check('T8b createTask push → invalid token purged', t8active === false, `activeAfter=${t8active}`);

    // T9: createComment → "New comment" to the admin assignee
    await registerDeviceAgain();
    const t9 = await call('POST', `/api/tasks/comments/${smokeTaskId}`, {
      body: { content: 'smoke-test comment (safe to delete)' },
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    check('T9a createComment accepted (hook fired)', t9.status === 201, `status=${t9.status}`);
    await sleep(4000);
    const t9active = await tokenActive();
    check('T9b createComment push → invalid token purged', t9active === false, `activeAfter=${t9active}`);

    // T10: changeTaskStatus → "Task status updated" to the admin assignee
    await registerDeviceAgain();
    const t10 = await call('PATCH', `/api/tasks/${smokeTaskId}/status`, {
      body: { status: 'in-progress' },
      headers: { Authorization: `Bearer ${applicantToken}` },
    });
    check('T10a changeTaskStatus accepted (hook fired)', t10.status === 200, `status=${t10.status}`);
    await sleep(4000);
    const t10active = await tokenActive();
    check('T10b changeTaskStatus push → invalid token purged', t10active === false, `activeAfter=${t10active}`);
  } catch (err) {
    check('smoke test execution', false, err.message);
  } finally {
    finish({ leaveId });
  }
}

async function finish(cleanup) {
  // --- Cleanup test rows ---------------------------------------------------
  try {
    if (cleanup?.leaveId) {
      const r = await pool.query(
        `DELETE FROM "leave" WHERE id = $1 AND reason = $2`, [cleanup.leaveId, LEAVE_REASON]);
      console.log(`cleanup: removed ${r.rowCount} smoke leave row(s)`);
    }
    const d = await pool.query(`DELETE FROM "push_device" WHERE "fcmToken" = $1`, [FAKE_TOKEN]);
    console.log(`cleanup: removed ${d.rowCount} smoke device row(s)`);
    if (smokeTaskId) {
      await pool.query(`DELETE FROM comment WHERE "taskId" = $1`, [smokeTaskId]);
      const t = await pool.query(`DELETE FROM task WHERE id = $1`, [smokeTaskId]);
      console.log(`cleanup: removed ${t.rowCount} smoke task row(s) (+ cascade)`);
    }
    await pool.end();
  } catch (err) {
    console.log(`cleanup warning: ${err.message}`);
  }

  // --- Stop the server -----------------------------------------------------
  if (serverProc) {
    serverProc.kill();
    serverProc = null;
  }

  // --- Server-side push log evidence ---------------------------------------
  const pushLines = serverLog.join('').split(/\r?\n/)
    .filter((l) => /push/i.test(l) || /Server running/i.test(l) || /error/i.test(l));
  if (pushLines.length) {
    console.log('\n--- server log (push lines) ---');
    pushLines.forEach((l) => console.log(`  ${l}`));
  }

  const failed = results.filter((r) => !r.ok);
  console.log(failed.length === 0
    ? `\nAll ${results.length} checks passed.`
    : `\n${failed.length}/${results.length} checks FAILED: ${failed.map((f) => f.name).join('; ')}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  if (serverProc) serverProc.kill();
  process.exit(1);
});
