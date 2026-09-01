const pool = require('../../config/db');
const { buildWeeklySummary, getWeekBounds } = require('../summary/summary');

// Cron endpoint for cron-job.com — validates CRON_SECRET via header/query
const triggerWeeklyCron = async (req, res, next) => {
  try {
    const secret = process.env.CRON_SECRET || process.env.CRONJOB_SECRET;
    if (!secret) {
      return res.status(500).json({ message: 'CRON_SECRET not configured on server' });
    }
    const provided = req.headers['x-cron-secret'] || req.headers['x-cron-key'] || req.query.key || req.query.secret || (req.headers.authorization && req.headers.authorization.replace('Bearer ',''));
    if (provided !== secret) {
      return res.status(401).json({ message: 'Invalid cron secret' });
    }

    const force = req.query.force === 'true';
    const testEmail = req.query.testEmail;

    // Determine week bounds (reuse summary logic with empty req)
    const mockReq = { query: {} };
    if (req.query.weekStart) mockReq.query.weekStart = req.query.weekStart;
    if (req.query.weekEnd) mockReq.query.weekEnd = req.query.weekEnd;
    const { weekStart, weekEnd, priorStart, priorEnd } = getWeekBounds(mockReq);

    // Ensure column
    try { await pool.query(`ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "include_weekly_report" BOOLEAN NOT NULL DEFAULT false`); } catch (_) {}

    // Iterate organizations
    const orgs = await pool.query(`SELECT id, name FROM organiation`);
    const { renderWeeklySummary } = require('../../utils/templates/weeklySummaryTemplate');
    const { sendWeeklySummaryEmail } = require('../../utils/email');

    const results = [];
    for (const org of orgs.rows) {
      let recipients;
      if (testEmail) {
        recipients = [testEmail];
      } else {
        const r = await pool.query(`SELECT email FROM employee WHERE "organiationId"=$1 AND role='ADMIN' AND "include_weekly_report"=true AND is_archived=false`, [org.id]);
        recipients = r.rows.map(x=>x.email);
      }
      if (!recipients.length) {
        results.push({ org: org.name, orgId: org.id, skipped: 'no opted-in admins' });
        continue;
      }
      const data = await buildWeeklySummary(org.id, weekStart, weekEnd, priorStart, priorEnd);
      const { html, text } = renderWeeklySummary(data);
      const subject = `Weekly CEO Summary — ${data.orgName} • ${data.weekLabel}`;
      const sent = [];
      for (const to of recipients) {
        const ret = await sendWeeklySummaryEmail({ to, subject, html, text });
        sent.push({ to, mocked: ret.mocked, id: ret.id });
      }
      results.push({ org: org.name, orgId: org.id, recipients: sent, weekLabel: data.weekLabel });
    }

    res.json({ success: true, weekStart, weekEnd, orgsProcessed: orgs.rowCount, results });
  } catch (e) { next(e); }
};

module.exports = { triggerWeeklyCron };
