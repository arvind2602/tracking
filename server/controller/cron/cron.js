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

    // Cross-check preview for Vighnotech (and others) without sending email: ?preview=1&org=Vighnotech
    if (req.query.preview) {
      const targetOrgName = req.query.org || 'Vighnotech';
      const orgQ = await pool.query(`SELECT id, name FROM organiation WHERE name ILIKE $1`, [targetOrgName]);
      if (orgQ.rowCount===0) return res.status(404).json({ message: `Org ${targetOrgName} not found`, orgs: (await pool.query(`SELECT name FROM organiation`)).rows.map(r=>r.name) });
      const org = orgQ.rows[0];
      const data = await buildWeeklySummary(org.id, weekStart, weekEnd, priorStart, priorEnd);
      // Debug: also fetch raw projectsWeekly count for cross-check + full Weekly with headName
      let debug = {};
      try {
        const rawProj = await pool.query(`SELECT COUNT(*)::int as cnt FROM projects WHERE "organiationId"=$1 AND is_archived=false`, [org.id]);
        const rawTask = await pool.query(`SELECT COUNT(*)::int as cnt FROM task t JOIN projects p ON p.id=t."projectId" WHERE p."organiationId"=$1`, [org.id]);
        const rawWeekly = await pool.query(`SELECT p.id, p.name, COUNT(t.id)::int as totalTasks FROM projects p LEFT JOIN task t ON p.id=t."projectId" WHERE p."organiationId"=$1 AND p.is_archived=false GROUP BY p.id ORDER BY totalTasks DESC LIMIT 5`, [org.id]);
        // Run the exact full query from buildWeeklySummary to see why it returns 0
        const fullWeekly = await pool.query(`
          WITH Weekly AS (
            SELECT p.id,
              COUNT(t.id)::int as totalTasks,
              COUNT(t.id) FILTER (WHERE t."createdAt" BETWEEN $2 AND $3)::int as createdThisWeek,
              COUNT(t.id) FILTER (WHERE LOWER(t.status) IN ('done','completed') AND t."updatedAt" BETWEEN $2 AND $3)::int as completedThisWeek,
              COUNT(t.id) FILTER (WHERE LOWER(t.status) IN ('pending-review','pending_review') AND t."updatedAt" BETWEEN $2 AND $3)::int as reviewThisWeek,
              COUNT(t.id) FILTER (WHERE t."dueDate" BETWEEN $2 AND $3 AND LOWER(t.status) NOT IN ('done','completed'))::int as overdue,
              COALESCE(SUM(t.points) FILTER (WHERE LOWER(t.status) IN ('done','completed') AND t."updatedAt" BETWEEN $2 AND $3),0)::int as pointsThisWeek,
              COALESCE(SUM(t.points) FILTER (WHERE LOWER(t.status) IN ('done','completed')),0)::int as totalPoints,
              ROUND(COUNT(*) FILTER (WHERE LOWER(t.status) IN ('done','completed'))::numeric / NULLIF(COUNT(t.id),0)*100)::int as progress
            FROM projects p LEFT JOIN task t ON p.id=t."projectId"
            WHERE p."organiationId"=$1 AND p.is_archived=false GROUP BY p.id
          )
          SELECT p.id, p.name, w.totalTasks, w.createdThisWeek, w.completedThisWeek, w.pointsThisWeek FROM projects p JOIN Weekly w ON w.id=p.id WHERE p."organiationId"=$1 AND p.is_archived=false ORDER BY p.priority_order ASC NULLS LAST, w.pointsThisWeek DESC LIMIT 5
        `, [org.id, weekStart, weekEnd]);
        debug = { projectsTotal: rawProj.rows[0].cnt, tasksTotal: rawTask.rows[0].cnt, sampleProjects: rawWeekly.rows, projectsEnrichedCount: data.projects.length, performersCount: data.performers.length, fullWeeklyRows: fullWeekly.rows, fullWeeklyCount: fullWeekly.rowCount, weekStart, weekEnd, buildProjectsLen: data.projects.length };
      } catch(e){ debug = { error: e.message, stack: e.stack?.slice(0,1200) }; }
      // If ?preview=html return rendered HTML, else JSON
      if (req.query.preview==='html') {
        const { renderWeeklySummary } = require('../../utils/templates/weeklySummaryTemplate');
        const { html } = renderWeeklySummary(data);
        res.set('Content-Type','text/html'); return res.send(html);
      }
      return res.json({ preview:true, org, data, debug });
    }

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
