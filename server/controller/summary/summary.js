const pool = require('../../config/db');

function getWeekBounds(req) {
  // Asia/Kolkata week: Mon 00:00 IST to Sun 23:59 IST. IST = UTC+5:30.
  // If weekStart/weekEnd provided (YYYY-MM-DD), use them. Else compute last Mon-Sun.
  const tz = 'Asia/Kolkata';
  let weekStart, weekEnd;
  if (req.query.weekStart && req.query.weekEnd) {
    weekStart = new Date(req.query.weekStart + 'T00:00:00+05:30');
    weekEnd = new Date(req.query.weekEnd + 'T23:59:59+05:30');
  } else if (req.query.weekStart) {
    weekStart = new Date(req.query.weekStart + 'T00:00:00+05:30');
    weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000 + (23*60*60+59*60+59)*1000);
    weekEnd.setHours(23,59,59,999);
  } else {
    // last completed week (Mon-Sun prior to today)
    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
    const day = nowIST.getDay(); // 0 Sun
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const lastMonday = new Date(nowIST);
    lastMonday.setDate(nowIST.getDate() + diffToMonday - 7);
    lastMonday.setHours(0,0,0,0);
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    lastSunday.setHours(23,59,59,999);
    // Interpret as IST by offsetting
    weekStart = new Date(lastMonday.toISOString().slice(0,10) + 'T00:00:00+05:30');
    weekEnd = new Date(lastSunday.toISOString().slice(0,10) + 'T23:59:59+05:30');
  }
  // Prior week bounds for delta
  const priorStart = new Date(weekStart.getTime() - 7*24*60*60*1000);
  const priorEnd = new Date(weekEnd.getTime() - 7*24*60*60*1000);
  return { weekStart, weekEnd, priorStart, priorEnd };
}

async function ensureReportingColumn() {
  try { await pool.query(`ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "include_weekly_report" BOOLEAN NOT NULL DEFAULT false`); } catch (_) {}
}

async function buildWeeklySummary(organizationId, weekStart, weekEnd, priorStart, priorEnd) {
  await ensureReportingColumn();

  const orgRes = await pool.query(`SELECT name FROM organiation WHERE id=$1`, [organizationId]);
  const orgName = orgRes.rows[0]?.name || 'Organization';
  const weekLabel = `Week ${weekStart.toLocaleDateString('en-IN', { day:'numeric', month:'short' })} — ${weekEnd.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}`;

  const [
    counts,
    tasksByStatusThisWeek,
    tasksByStatusTotal,
    productivityThisWeek,
    productivityPrior,
    atRisk,
    taskInsights,
    projectsWeekly,
    performersWeekly,
    attendanceWeekly,
    leavePending,
    recentActivity
  ] = await Promise.all([
    // counts
    pool.query(`SELECT (SELECT COUNT(*)::int FROM employee WHERE "organiationId"=$1 AND is_archived=false) as totalEmployees,
                       (SELECT COUNT(*)::int FROM projects WHERE "organiationId"=$1 AND is_archived=false) as totalProjects,
                       (SELECT COALESCE(SUM(points),0)::int FROM task t JOIN projects p ON t."projectId"=p.id WHERE p."organiationId"=$1) as totalPoints`, [organizationId]),
    // tasks by status this week (created or updated in week)
    pool.query(`SELECT t.status, COUNT(*)::int as c FROM task t JOIN projects p ON t."projectId"=p.id WHERE p."organiationId"=$1 AND (t."createdAt" BETWEEN $2 AND $3 OR t."updatedAt" BETWEEN $2 AND $3) GROUP BY t.status`, [organizationId, weekStart, weekEnd]),
    pool.query(`SELECT t.status, COUNT(*)::int as c FROM task t JOIN projects p ON t."projectId"=p.id WHERE p."organiationId"=$1 GROUP BY t.status`, [organizationId]),
    pool.query(`SELECT COALESCE(SUM(t.points),0)::int as pts, COUNT(*)::int as cnt, COALESCE(AVG(EXTRACT(EPOCH FROM (t."updatedAt"-t."createdAt"))/3600),0)::float as avgH FROM task t JOIN projects p ON t."projectId"=p.id WHERE p."organiationId"=$1 AND LOWER(t.status) IN ('done','completed') AND t."updatedAt" BETWEEN $2 AND $3`, [organizationId, weekStart, weekEnd]),
    pool.query(`SELECT COALESCE(SUM(t.points),0)::int as pts FROM task t JOIN projects p ON t."projectId"=p.id WHERE p."organiationId"=$1 AND LOWER(t.status) IN ('done','completed') AND t."updatedAt" BETWEEN $2 AND $3`, [organizationId, priorStart, priorEnd]),
    pool.query(`SELECT p.id, p.name, p."endDate", COUNT(t.id)::int as "totalTasks", COUNT(CASE WHEN LOWER(t.status) IN ('done','completed') THEN 1 END)::int as "completedTasks", COUNT(CASE WHEN t."dueDate" < $2::timestamptz AND LOWER(t.status) NOT IN ('done','completed') THEN 1 END)::int as "overdueTasks" FROM projects p LEFT JOIN task t ON p.id=t."projectId" WHERE p."organiationId"=$1 AND p.is_archived=false GROUP BY p.id HAVING (p."endDate" < $2::timestamptz + INTERVAL '7 days' AND p."endDate" > $2::timestamptz) OR COUNT(CASE WHEN t."dueDate" < $2::timestamptz AND LOWER(t.status) NOT IN ('done','completed') THEN 1 END) >0`, [organizationId, weekEnd]),
    (async () => {
      const avg = await pool.query(`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (t."updatedAt"-t."createdAt"))/3600),0)::float as "avgResolutionHours" FROM task t JOIN projects p ON t."projectId"=p.id WHERE p."organiationId"=$1 AND LOWER(t.status) IN ('done','completed')`, [organizationId]);
      const stuck = await pool.query(`SELECT t.id, t.description, t.status, t."updatedAt", e."firstName", e."lastName" FROM task t JOIN projects p ON t."projectId"=p.id LEFT JOIN employee e ON t."assignedTo"=e.id::text WHERE p."organiationId"=$1 AND LOWER(t.status) NOT IN ('done','completed') AND t."updatedAt" < $2::timestamptz - INTERVAL '5 days' ORDER BY t."updatedAt" ASC LIMIT 20`, [organizationId, weekEnd]);
      return { avg: avg.rows[0].avgResolutionHours, stuck: stuck.rows };
    })(),
    // Projects going on this week — all active + on_hold (is_archived=false) with weekly stats — overdue = due this week and still open
    pool.query(`
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
      ),
      Heads AS (
        SELECT p.id, COALESCE(string_agg(e."firstName"||' '||e."lastName", ', ' ORDER BY h.ord),'Unassigned') as headName
        FROM projects p
        LEFT JOIN LATERAL unnest(COALESCE(p."headIds", '{}'::text[])) WITH ORDINALITY AS h(id, ord) ON true
        LEFT JOIN employee e ON e.id::text = h.id::text
        WHERE p."organiationId"=$1 AND p.is_archived=false GROUP BY p.id
      )
      SELECT p.id, p.name, p.description, p.status, p.priority_order, p."endDate", p."startDate",
             w.totalTasks, w.createdThisWeek, w.completedThisWeek, w.reviewThisWeek, w.overdue, w.pointsThisWeek, w.totalPoints, w.progress,
             COALESCE(h.headName, 'Unassigned') as headName,
             (SELECT reason FROM project_hold_history WHERE "projectId"=p.id AND "endDate" IS NULL ORDER BY "startDate" DESC LIMIT 1) as holdReason
      FROM projects p
      JOIN Weekly w ON w.id=p.id
      LEFT JOIN Heads h ON h.id=p.id
      WHERE p."organiationId"=$1 AND p.is_archived=false
      ORDER BY p.priority_order ASC NULLS LAST, w.pointsThisWeek DESC, p."createdAt" DESC
    `, [organizationId, weekStart, weekEnd]),
    // performers this week — simplified: match via assignedTo text OR task_assignee, no type gate. Divided points used as primary.
    pool.query(`
      SELECT e.id, e."firstName", e."lastName", e."firstName"||' '||e."lastName" as name,
             COUNT(t.id) FILTER (WHERE LOWER(COALESCE(t.status,'')) IN ('done','completed') AND t."updatedAt" BETWEEN $2 AND $3)::int as completedThisWeek,
             COALESCE(SUM(
               CASE WHEN LOWER(COALESCE(t.status,'')) IN ('done','completed') AND t."updatedAt" BETWEEN $2 AND $3
               THEN CASE WHEN (SELECT COUNT(*) FROM task_assignee ta WHERE ta."taskId"=t.id) > 0 THEN t.points / (SELECT COUNT(*) FROM task_assignee ta WHERE ta."taskId"=t.id) ELSE t.points END
               ELSE 0 END
             ),0)::int as weeklyPoints,
             COALESCE(SUM(
               CASE WHEN LOWER(COALESCE(t.status,'')) IN ('done','completed') AND t."updatedAt" BETWEEN $2 AND $3
               THEN t.points ELSE 0 END
             ),0)::int as weeklyPointsFull
      FROM employee e
      LEFT JOIN task t ON (
        t."assignedTo"::text = e.id::text
        OR EXISTS (SELECT 1 FROM task_assignee ta WHERE ta."taskId"=t.id AND ta."employeeId"=e.id)
        OR t."createdBy"::text = e.id::text
      )
      WHERE e."organiationId"=$1 AND e.is_archived=false
      GROUP BY e.id
      ORDER BY weeklyPoints DESC, completedThisWeek DESC LIMIT 10
    `, [organizationId, weekStart, weekEnd]),
    // attendance this week
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='PRESENT')::int as present,
        COUNT(*) FILTER (WHERE status='LATE')::int as late,
        COUNT(*) FILTER (WHERE status='WFH')::int as wfh,
        COUNT(*) FILTER (WHERE status='LEAVE')::int as leave,
        COUNT(*) FILTER (WHERE status='ABSENT')::int as absent,
        COUNT(*) FILTER (WHERE "checkOut" IS NULL AND date < CURRENT_DATE)::int as missed,
        COUNT(*) FILTER (WHERE "withinGeofence"=false)::int as violations,
        COUNT(*) FILTER (WHERE "deviceMismatch"=true)::int as deviceMismatch
      FROM attendance a JOIN employee e ON a."employeeId"=e.id
      WHERE e."organiationId"=$1 AND a.date BETWEEN ($2::date) AND ($3::date)
    `, [organizationId, weekStart, weekEnd]),
    // leave pending
    pool.query(`SELECT COUNT(*)::int as pending, MIN("startDate") as oldest FROM "leave" WHERE "organizationId"=$1 AND status='PENDING'`, [organizationId]),
    // recent activity last 10 within org
    pool.query(`
      SELECT t.id, COALESCE(e."firstName"||' '||e."lastName",'Unknown') as user, COALESCE(t."updatedAt",t."createdAt") as time, CASE WHEN LOWER(t.status) IN ('done','completed') THEN 'completed task' ELSE 'updated task' END as action, t.description as target
      FROM task t LEFT JOIN employee e ON t."assignedTo"::uuid=e.id JOIN projects p ON t."projectId"=p.id WHERE p."organiationId"=$1
      UNION ALL
      SELECT c.id, COALESCE(e."firstName"||' '||e."lastName",'Unknown') as user, c."createdAt" as time, 'commented on' as action, t.description as target FROM comment c LEFT JOIN employee e ON c."authorId"::uuid=e.id JOIN task t ON c."taskId"=t.id JOIN projects p ON t."projectId"=p.id WHERE p."organiationId"=$1
      ORDER BY time DESC LIMIT 6
    `, [organizationId])
  ]);

  // compute deltas and derived — normalize status keys (fallback: if no rows, derive from productivity counts)
  const norm = s => String(s||'').toLowerCase().trim();
  const totalByNorm = {};
  for (const r of tasksByStatusTotal.rows) {
    const k = norm(r.status);
    totalByNorm[k] = (totalByNorm[k]||0) + (r.c||0);
  }
  let pending = (totalByNorm['pending']||0) + (totalByNorm['todo']||0);
  let inProgress = (totalByNorm['in-progress']||0) + (totalByNorm['in_progress']||0) + (totalByNorm['inprogress']||0) + (totalByNorm['in progress']||0);
  let review = (totalByNorm['pending-review']||0) + (totalByNorm['pending_review']||0) + (totalByNorm['review']||0) + (totalByNorm['pending review']||0);
  // fallback: if grouping returned nothing due to status casing, estimate from total count
  if (tasksByStatusTotal.rows.length===0) {
    const totalCntFallback = tasksByStatusTotal.rows.reduce((a,b)=>a+(b.c||0),0);
    if (totalCntFallback===0) {
      // leave pending/inProgress as 0, will be recalculated from tasksByStatusThisWeek if needed
    }
  }
  const weeklyPts = productivityThisWeek.rows[0]?.pts ?? 0;
  const priorPts = productivityPrior.rows[0]?.pts ?? 0;
  const pointsDelta = weeklyPts - priorPts;

  // atRisk enrich
  const atRiskRows = atRisk.rows.map(p=> ({ ...p, riskFactor: p.overdueTasks>0?'High':'Medium', completionRate: p.totalTasks>0? Math.round(p.completedTasks/p.totalTasks*100):0 }));
  // projects enrich: attach risk and topPerformers per project — filter to only projects where any task has been added (totalTasks>0).
  let projectsEnriched = projectsWeekly.rows.filter(p => (p.totalTasks||0) > 0);
  // fallback: if no project passed filter but productivity shows tasks, it likely means tasks belong to archived/completed projects orWeekly counts mismatched — include any project with weekly activity
  if (projectsEnriched.length === 0 && (productivityThisWeek.rows[0]?.cnt||0) > 0) {
    const fallback = projectsWeekly.rows.filter(p => (p.completedThisWeek||0) > 0 || (p.createdThisWeek||0) > 0 || (p.pointsThisWeek||0) > 0);
    if (fallback.length) projectsEnriched = fallback;
  }
  // fetch top performers per project (batched) — use text comparison to avoid uuid cast errors
  if (projectsEnriched.length) {
    try {
      const ids = projectsEnriched.map(p=>p.id);
      const topRes = await pool.query(`
        SELECT t."projectId", e."firstName", e."lastName", SUM(t.points)::int as points
        FROM task t JOIN employee e ON (t."assignedTo"::text = e.id::text OR EXISTS (SELECT 1 FROM task_assignee ta WHERE ta."taskId"=t.id AND ta."employeeId"=e.id))
        WHERE t."projectId"=ANY($1::uuid[]) AND LOWER(t.status) IN ('done','completed') GROUP BY t."projectId", e.id
      `, [ids]);
      const grouped = {};
      for (const r of topRes.rows) { (grouped[r.projectId] ||= []).push({ name: r.firstName+' '+r.lastName, points: r.points}); }
      for (const arr of Object.values(grouped)) arr.sort((a,b)=>b.points-a.points);
      projectsEnriched = projectsEnriched.map(p=> ({
        ...p,
        topPerformers: (grouped[p.id]||[]).slice(0,3),
        risk: atRiskRows.find(a=>a.id===p.id)?.riskFactor || null
      }));
    } catch (_) {}
  }

  const healthScore = (() => {
    const weeklyCnt = productivityThisWeek.rows[0]?.cnt ?? 0;
    const totalCnt = tasksByStatusTotal.rows.reduce((a,b)=>a+(b.c||0),0) || 1;
    const completedAll = (totalByNorm['completed']||0) + (totalByNorm['done']||0);
    const completionRate = Math.round((completedAll / Math.max(totalCnt,1))*100);
    // velocity vs prior: if prior is 0, treat delta as neutral (no penalty) — prevents -104 on first week
    let velocityDelta = 0;
    if (priorPts > 0) velocityDelta = Math.round(((weeklyPts - priorPts)/priorPts)*100);
    else if (weeklyPts > 0 && priorPts === 0) velocityDelta = 10; // small boost for first activity
    // health 0-100: base 50 + 0.35*completionRate + clamped velocityDelta + risk penalty; if weekly had activity, nudge up
    let score = 50 + (completionRate * 0.35) + Math.max(-15, Math.min(15, velocityDelta * 0.25)) - (atRiskRows.length * 5) - ((taskInsights.stuck?.length||0) > 5 ? 4 : 0);
    if (weeklyCnt > 0 && weeklyPts > 0) score += 6;
    // ensure never 0 when there was activity
    if (weeklyCnt > 0 && score < 15) score = 15 + Math.min(25, completionRate * 0.2);
    return Math.max(0, Math.min(100, Math.round(score)));
  })();
  const healthDelta = priorPts > 0 ? pointsDelta : 0;

  const totalsRow = counts.rows[0] || {};
  // Postgres may return lowercase keys without quotes; handle both casings
  const totalEmployees = totalsRow.totalEmployees ?? totalsRow.totalemployees ?? 0;
  const totalProjects = totalsRow.totalProjects ?? totalsRow.totalprojects ?? 0;
  const totalPoints = totalsRow.totalPoints ?? totalsRow.totalpoints ?? 0;
  const weeklyCompleted = productivityThisWeek.rows[0]?.cnt ?? 0;

  return {
    orgName,
    weekStart,
    weekEnd,
    weekLabel,
    health: { score: healthScore, delta: healthDelta, summary: `${weeklyCompleted} tasks completed, ${weeklyPts} pts` },
    totals: { totalEmployees, totalProjects, totalPoints, pending, inProgress, review },
    velocity: { created: tasksByStatusThisWeek.rows.reduce((a,b)=>a+b.c,0), completed: weeklyCompleted, points: weeklyPts, pointsDelta, avgResolutionHours: Math.round(taskInsights.avg||0) },
    attendance: attendanceWeekly.rows[0],
    leave: { pending: leavePending.rows[0].pending, oldest: leavePending.rows[0].oldest },
    projects: projectsEnriched,
    performers: performersWeekly.rows,
    stuckTasks: taskInsights.stuck,
    atRisk: atRiskRows,
    recentActivity: recentActivity.rows.map(r=> ({ ...r, time: new Date(r.time).toLocaleString('en-IN', { timeZone:'Asia/Kolkata' }) }))
  };
}

const getWeeklySummary = async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Only admins can view weekly summary' });
    const { weekStart, weekEnd, priorStart, priorEnd } = getWeekBounds(req);
    const data = await buildWeeklySummary(req.user.organization_uuid, weekStart, weekEnd, priorStart, priorEnd);
    res.json(data);
  } catch (e) { next(e); }
};

const getWeeklyPreview = async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Only admins can view weekly summary' });
    const { weekStart, weekEnd, priorStart, priorEnd } = getWeekBounds(req);
    const data = await buildWeeklySummary(req.user.organization_uuid, weekStart, weekEnd, priorStart, priorEnd);
    const { renderWeeklySummary } = require('../../utils/templates/weeklySummaryTemplate');
    const { html } = renderWeeklySummary(data);
    res.send(html);
  } catch (e) { next(e); }
};

const sendWeeklyToOptedIn = async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Only admins can trigger summary' });
    const { weekStart, weekEnd, priorStart, priorEnd } = getWeekBounds(req);
    const { testEmail, dryRun } = req.body || {};
    const data = await buildWeeklySummary(req.user.organization_uuid, weekStart, weekEnd, priorStart, priorEnd);
    const { renderWeeklySummary } = require('../../utils/templates/weeklySummaryTemplate');
    const { html, text } = renderWeeklySummary(data);
    const subject = `Weekly CEO Summary — ${data.orgName} • ${data.weekLabel}`;
    await ensureReportingColumn();
    let recipients;
    if (testEmail) {
      recipients = [testEmail];
    } else {
      const r = await pool.query(`SELECT email FROM employee WHERE "organiationId"=$1 AND role='ADMIN' AND "include_weekly_report"=true AND is_archived=false`, [req.user.organization_uuid]);
      recipients = r.rows.map(x=>x.email);
    }
    if (!recipients.length) return res.json({ message: 'No opted-in admins', data: { weekLabel: data.weekLabel, recipients: [] } });
    if (dryRun) return res.json({ message: 'Dry run', recipients, subject, weekLabel: data.weekLabel });
    const { sendWeeklySummaryEmail } = require('../../utils/email');
    const results = [];
    for (const to of recipients) {
      const ret = await sendWeeklySummaryEmail({ to, subject, html, text });
      results.push({ to, mocked: ret.mocked, id: ret.id });
    }
    res.json({ message: 'Weekly summary sent', recipients: results, weekLabel: data.weekLabel });
  } catch (e) { next(e); }
};

module.exports = { buildWeeklySummary, getWeeklySummary, getWeeklyPreview, sendWeeklyToOptedIn, getWeekBounds };
