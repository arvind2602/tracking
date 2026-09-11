// 9-hour daily backlog engine.
//
// Week definition (IST): Monday -> Friday on 2nd/4th-Saturday-off weeks,
// Monday -> Saturday otherwise. Sundays / weekOffs / HR holidays / approved
// leaves carry 0 required hours. HALF_DAY attendance carries 4.5h required.

const pool = require('../../config/db');
const cal = require('../../utils/workCalendar');
const { renderBacklogReminder, renderBacklogHrReport } = require('../../utils/templates/backlogTemplates');

const DEFAULTER_THRESHOLD_HOURS = 0.25;
const HALF_DAY_REQUIRED = 4.5;

async function ensureDailyRequiredColumn() {
  try {
    await pool.query(
      `ALTER TABLE organiation ADD COLUMN IF NOT EXISTS "dailyRequiredHours" DOUBLE PRECISION NOT NULL DEFAULT 9`
    );
  } catch (_) {}
}

async function getOrgCalendar(orgId) {
  await ensureDailyRequiredColumn();
  const r = await pool.query(
    `SELECT id, name, "weekOffs", holidays, "dailyRequiredHours" FROM organiation WHERE id=$1`,
    [orgId]
  );
  if (r.rowCount === 0) return null;
  const row = r.rows[0];
  return {
    id: row.id,
    name: row.name,
    weekOffs: Array.isArray(row.weekOffs) && row.weekOffs.length ? row.weekOffs : ['Sunday'],
    holidays: row.holidays || [],
    dailyRequired: Number(row.dailyRequiredHours) > 0 ? Number(row.dailyRequiredHours) : cal.DEFAULT_DAILY_REQUIRED_HOURS,
  };
}

// Core computation for one org. todayStr defaults to today IST.
// mode: 'morning' (worked excludes reminder day) or 'closing' (includes it).
async function computeOrgBacklog(orgId, { todayStr, mode = 'closing' } = {}) {
  const today = todayStr || cal.getTodayISTString();
  const org = await getOrgCalendar(orgId);
  if (!org) throw new Error('Organization not found');
  const week = cal.getReminderWeekInfo(today);
  const days = cal.dateRange(week.weekStart, week.weekEnd);
  const holidayByDate = cal.holidayMap(org.holidays);

  const empRes = await pool.query(
    `SELECT id, "firstName", "lastName", email, role, "joiningDate" FROM employee
     WHERE "organiationId"=$1 AND is_archived=false ORDER BY "firstName", "lastName"`,
    [orgId]
  );
  const employees = empRes.rows;
  const empIds = employees.map((e) => e.id);

  let attByEmp = new Map();
  let leavesByEmp = new Map();
  if (empIds.length) {
    const attRes = await pool.query(
      `SELECT "employeeId", date, "workHours", "checkOut", status FROM attendance
       WHERE "employeeId" = ANY($1::uuid[]) AND date BETWEEN $2::date AND $3::date`,
      [empIds, week.weekStart, week.weekEnd]
    );
    for (const a of attRes.rows) {
      const key = String(a.employeeId);
      if (!attByEmp.has(key)) attByEmp.set(key, new Map());
      const d = cal.toDateKey(a.date);
      attByEmp.get(key).set(d, a);
    }
    const leaveRes = await pool.query(
      `SELECT "employeeId", "startDate", "endDate" FROM "leave"
       WHERE "organizationId"=$1 AND status='APPROVED' AND "startDate" <= $3::date AND "endDate" >= $2::date`,
      [orgId, week.weekStart, week.weekEnd]
    );
    for (const l of leaveRes.rows) {
      const key = String(l.employeeId);
      if (!leavesByEmp.has(key)) leavesByEmp.set(key, []);
      leavesByEmp.get(key).push(l);
    }
  }

  const results = employees.map((e) => {
    const key = String(e.id);
    const attMap = attByEmp.get(key) || new Map();
    const leaveSet = cal.approvedLeaveDaySet(leavesByEmp.get(key) || []);
    const joining = e.joiningDate ? cal.toDateKey(e.joiningDate) : null;
    const dayRows = [];
    let requiredTotal = 0;
    let workedTotal = 0;
    const flags = new Set();

    for (const d of days) {
      const att = attMap.get(d) || null;
      const isLeave = leaveSet.has(d);
      const holiday = holidayByDate.get(d) || null;
      const attStatus = att ? String(att.status || '') : '';
      let required = org.dailyRequired;
      let reason = cal.dayNameIST(d);

      if (joining && d < joining) {
        required = 0;
        reason = 'before-joining';
      } else if (holiday) {
        required = 0;
        reason = `holiday:${holiday.name}`;
        flags.add('holiday');
      } else if (isLeave || attStatus === 'LEAVE') {
        required = 0;
        reason = 'leave';
        flags.add('on-leave');
      } else if (attStatus === 'HOLIDAY') {
        required = 0;
        reason = 'holiday(marked)';
      } else if (attStatus === 'HALF_DAY') {
        required = HALF_DAY_REQUIRED;
        reason = 'half-day';
        flags.add('half-day');
      } else if (!cal.isWorkingDay(d, { weekOffs: org.weekOffs, holidays: org.holidays })) {
        required = 0;
        reason = 'week-off';
      }

      let worked = att && att.workHours != null ? Number(att.workHours) : 0;
      if (Number.isNaN(worked)) worked = 0;
      if (att && !att.checkOut && d <= today) flags.add('missing-checkout');
      if (!att && required > 0 && d <= today) flags.add('no-record');

      // Morning mode: don't count today's worked hours yet (reminder goes out in the morning)
      const includeWorked = mode === 'morning' ? d < today : d <= today;
      requiredTotal += d <= today ? required : 0;
      if (includeWorked) workedTotal += worked;

      dayRows.push({
        date: d,
        label: reason,
        required: d <= today ? Math.round(required * 100) / 100 : 0,
        worked: includeWorked ? Math.round(worked * 100) / 100 : 0,
        isLeave,
        isHoliday: !!holiday,
        missingCheckout: !!(att && !att.checkOut),
      });
    }

    requiredTotal = Math.round(requiredTotal * 100) / 100;
    workedTotal = Math.round(workedTotal * 100) / 100;
    const backlog = Math.round((requiredTotal - workedTotal) * 100) / 100;
    // Today's target = outstanding backlog + today's required (morning mode)
    const todayRow = dayRows.find((r) => r.date === today);
    const todayRequired = todayRow ? todayRow.required : 0;
    const backlogSoFarRows = dayRows.filter((r) => r.date < today);
    const reqSoFar = backlogSoFarRows.reduce((a, r) => a + r.required, 0);
    const workedSoFar = backlogSoFarRows.reduce((a, r) => a + r.worked, 0);
    const backlogSoFar = Math.round((reqSoFar - workedSoFar) * 100) / 100;

    return {
      id: e.id,
      name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email,
      email: e.email,
      role: e.role,
      required: requiredTotal,
      worked: workedTotal,
      remaining: backlog,
      backlogSoFar,
      todayRequired: Math.round(todayRequired * 100) / 100,
      todayTarget: Math.round((Math.max(0, backlogSoFar) + todayRequired) * 100) / 100,
      requiredSoFar: Math.round(reqSoFar * 100) / 100,
      workedSoFar: Math.round(workedSoFar * 100) / 100,
      flags: [...flags].join(', '),
      days: dayRows,
    };
  });

  const defaulters = results
    .filter((r) => r.remaining > DEFAULTER_THRESHOLD_HOURS)
    .sort((a, b) => b.remaining - a.remaining);

  return { org, week, today, employees: results, defaulters, totalEmployees: results.length };
}

// ---------- cron handlers (CRON_SECRET validated, same as weekly cron) ----------

function checkCronSecret(req, res) {
  const secret = process.env.CRON_SECRET || process.env.CRONJOB_SECRET;
  if (!secret) {
    res.status(500).json({ message: 'CRON_SECRET not configured on server' });
    return null;
  }
  const provided =
    req.headers['x-cron-secret'] ||
    req.headers['x-cron-key'] ||
    req.query.key ||
    req.query.secret ||
    (req.headers.authorization && req.headers.authorization.replace('Bearer ', ''));
  if (provided !== secret) {
    res.status(401).json({ message: 'Invalid cron secret' });
    return null;
  }
  return true;
}

async function listTargetOrgs(req) {
  if (req.query.org) {
    const q = await pool.query(`SELECT id, name FROM organiation WHERE name ILIKE $1`, [req.query.org]);
    return q.rows;
  }
  const q = await pool.query(`SELECT id, name FROM organiation`);
  return q.rows;
}

// Morning reminder: only runs on each org's reminder day (Fri off-weeks / Sat working weeks).
const triggerBacklogReminder = async (req, res, next) => {
  try {
    if (!checkCronSecret(req, res)) return;
    const todayStr = req.query.date || cal.getTodayISTString();
    const testEmail = req.query.testEmail;
    const preview = req.query.preview === '1' || req.query.preview === 'true';
    const orgs = await listTargetOrgs(req);
    const { sendBacklogReminderEmail } = require('../../utils/email');
    const results = [];

    for (const org of orgs) {
      const data = await computeOrgBacklog(org.id, { todayStr, mode: 'morning' });
      if (data.today !== data.week.reminderDay && !req.query.force) {
        results.push({ org: org.name, skipped: `today ${data.today} is not reminder day ${data.week.reminderDay}` });
        continue;
      }
      if (preview && !testEmail) {
        results.push({ org: org.name, preview: true, week: data.week, sample: data.employees.slice(0, 3) });
        continue;
      }
      const sent = [];
      for (const emp of data.employees) {
        const to = testEmail || emp.email;
        const tpl = renderBacklogReminder({
          employeeName: emp.name,
          orgName: data.org.name,
          weekStart: data.week.weekStart,
          weekEnd: data.week.weekEnd,
          isOffWeek: data.week.isOffWeek,
          backlogSoFar: emp.backlogSoFar,
          todayTarget: emp.todayTarget,
          requiredSoFar: emp.requiredSoFar,
          workedSoFar: emp.workedSoFar,
          days: emp.days,
        });
        const ret = await sendBacklogReminderEmail({ to, subject: tpl.subject, html: tpl.html, text: tpl.text });
        sent.push({ to, mocked: ret.mocked, id: ret.id });
        if (testEmail) break; // one sample when testing
      }
      results.push({ org: org.name, week: data.week, sent: sent.length, detail: testEmail ? sent : undefined });
    }
    res.json({ success: true, today: todayStr, results });
  } catch (e) {
    next(e);
  }
};

// Evening HR report: one consolidated email per org to active ADMINs.
const triggerBacklogHrReport = async (req, res, next) => {
  try {
    if (!checkCronSecret(req, res)) return;
    const todayStr = req.query.date || cal.getTodayISTString();
    const testEmail = req.query.testEmail;
    const preview = req.query.preview === '1' || req.query.preview === 'true';
    const orgs = await listTargetOrgs(req);
    const { sendBacklogHrEmail } = require('../../utils/email');
    const results = [];

    for (const org of orgs) {
      const data = await computeOrgBacklog(org.id, { todayStr, mode: 'closing' });
      if (data.today !== data.week.reminderDay && !req.query.force) {
        results.push({ org: org.name, skipped: `today ${data.today} is not report day ${data.week.reminderDay}` });
        continue;
      }
      const tpl = renderBacklogHrReport({
        orgName: data.org.name,
        weekStart: data.week.weekStart,
        weekEnd: data.week.weekEnd,
        isOffWeek: data.week.isOffWeek,
        defaulters: data.defaulters.map((d) => ({
          name: d.name,
          email: d.email,
          required: d.required,
          worked: d.worked,
          remaining: d.remaining,
          flags: d.flags,
        })),
        totalEmployees: data.totalEmployees,
        allClear: data.defaulters.length === 0,
      });
      if (preview && !testEmail) {
        results.push({ org: org.name, preview: true, week: data.week, defaulters: tpl.text.slice(0, 2000) });
        continue;
      }
      let recipients;
      if (testEmail) {
        recipients = [testEmail];
      } else {
        const r = await pool.query(
          `SELECT email FROM employee WHERE "organiationId"=$1 AND role='ADMIN' AND is_archived=false`,
          [org.id]
        );
        recipients = r.rows.map((x) => x.email);
      }
      if (!recipients.length) {
        results.push({ org: org.name, skipped: 'no admins' });
        continue;
      }
      const sent = [];
      for (const to of recipients) {
        const ret = await sendBacklogHrEmail({ to, subject: tpl.subject, html: tpl.html, text: tpl.text });
        sent.push({ to, mocked: ret.mocked, id: ret.id });
      }
      results.push({ org: org.name, week: data.week, defaulters: data.defaulters.length, recipients: sent });
    }
    res.json({ success: true, today: todayStr, results });
  } catch (e) {
    next(e);
  }
};

// ---------- authenticated API ----------

const getMyBacklog = async (req, res, next) => {
  try {
    const todayStr = req.query.date || cal.getTodayISTString();
    const data = await computeOrgBacklog(req.user.organization_uuid, {
      todayStr,
      mode: req.query.mode === 'morning' ? 'morning' : 'closing',
    });
    const me = data.employees.find((e) => String(e.id) === String(req.user.user_uuid));
    if (!me) return res.status(404).json({ message: 'Employee not found' });
    res.json({ org: data.org.name, week: data.week, today: data.today, backlog: me });
  } catch (e) {
    next(e);
  }
};

const getBacklogPreview = async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Only admins can preview backlog' });
    const todayStr = req.query.date || cal.getTodayISTString();
    const data = await computeOrgBacklog(req.user.organization_uuid, {
      todayStr,
      mode: req.query.mode === 'morning' ? 'morning' : 'closing',
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

module.exports = {
  computeOrgBacklog,
  triggerBacklogReminder,
  triggerBacklogHrReport,
  getMyBacklog,
  getBacklogPreview,
  DEFAULTER_THRESHOLD_HOURS,
};
