// Shared IST work-calendar helpers for the 9-hour backlog system.
//
// Rules:
// - 9h required per working day (configurable per org via dailyRequiredHours).
// - Sundays (and any org weekOffs day names) are always non-working.
// - 2nd & 4th Saturdays of the month are off; all other Saturdays are working.
// - HR-marked holidays (organiation.holidays JSON) are non-working.
// - Approved leaves excuse the overlapped days.

const IST_TZ = 'Asia/Kolkata';
const DEFAULT_DAILY_REQUIRED_HOURS = 9;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

// Current date string in IST (YYYY-MM-DD)
function getTodayISTString(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// Normalize a DB or JSON date value to a YYYY-MM-DD IST calendar day.
// node-pg returns DATE/DATETIME columns as JS Dates (DATEs come back as
// midnight local time, so toISOString() would give the WRONG day — always
// convert Dates via the IST calendar). Plain strings pass through.
function toDateKey(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return getTodayISTString(v);
  if (typeof v === 'string' && v.length >= 10) return v.slice(0, 10);
  if (v == null || v === '') return '';
  return String(v).slice(0, 10);
}

// Day of week (0=Sun..6=Sat) for a YYYY-MM-DD date interpreted in IST.
// Noon IST avoids DST/offset edge issues (IST has no DST anyway).
function dayOfWeekIST(dateStr) {
  const d = new Date(`${dateStr}T12:00:00+05:30`);
  // getUTCDay of 12:00 IST (06:30 UTC) == IST weekday
  return d.getUTCDay();
}

function dayNameIST(dateStr) {
  return DAY_NAMES[dayOfWeekIST(dateStr)];
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00+05:30`);
  d.setUTCDate(d.getUTCDate() + n);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function dateRange(fromStr, toStr) {
  const out = [];
  let cur = fromStr;
  let guard = 0;
  while (cur <= toStr && guard < 370) {
    out.push(cur);
    cur = addDays(cur, 1);
    guard += 1;
  }
  return out;
}

// Monday of the week containing dateStr (Monday-first weeks)
function getMonday(dateStr) {
  const dow = dayOfWeekIST(dateStr); // 0 Sun .. 6 Sat
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(dateStr, diff);
}

// Which Saturday-of-month is this date? (1..5) — counts Saturdays only.
function getSaturdayOrdinal(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  const firstDow = dayOfWeekIST(`${y}-${pad2(m)}-01`);
  // offset from 1st to first Saturday (dow 6)
  const offsetToFirstSat = (6 - firstDow + 7) % 7;
  const dayOfMonth = Number(dateStr.split('-')[2]);
  const firstSatDate = 1 + offsetToFirstSat;
  return Math.floor((dayOfMonth - firstSatDate) / 7) + 1;
}

function isSaturday(dateStr) {
  return dayOfWeekIST(dateStr) === 6;
}

// True when the given Saturday is a 2nd or 4th Saturday.
function isSecondOrFourthSaturday(dateStr) {
  if (!isSaturday(dateStr)) return false;
  const ord = getSaturdayOrdinal(dateStr);
  return ord === 2 || ord === 4;
}

// Reminder-week info for a reference day (normally "today" IST).
// - weekStart: Monday
// - saturday: Saturday of this week
// - isOffWeek: that Saturday is 2nd/4th => Saturday off
// - reminderDay: Friday on off-weeks, Saturday otherwise
// - weekEnd: same as reminderDay (last day we track this week)
function getReminderWeekInfo(refDateStr) {
  const monday = getMonday(refDateStr);
  const saturday = addDays(monday, 5);
  const isOffWeek = isSecondOrFourthSaturday(saturday);
  const reminderDay = isOffWeek ? addDays(monday, 4) : saturday;
  return {
    weekStart: monday,
    weekEnd: reminderDay,
    saturday,
    friday: addDays(monday, 4),
    isOffWeek,
    reminderDay,
  };
}

function isReminderDay(refDateStr) {
  const info = getReminderWeekInfo(refDateStr);
  return refDateStr === info.reminderDay;
}

// Normalize one holidays JSON entry into {id,date,name,reason} or null.
// Accepts legacy shapes: {date,name,id} where date may be ISO datetime.
function normalizeHoliday(h, idx = 0) {
  if (!h || typeof h !== 'object') return null;
  let dateStr = toDateKey(h.date || h.holidayDate || null);
  if (!dateStr) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  return {
    id: String(h.id || h.holidayId || `${dateStr}-${idx}`),
    date: dateStr,
    name: String(h.name || h.title || 'Holiday'),
    reason: h.reason != null ? String(h.reason) : '',
    createdBy: h.createdBy || null,
    createdAt: h.createdAt || null,
  };
}

function normalizeHolidays(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((h, i) => normalizeHoliday(h, i))
    .filter(Boolean)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function holidayMap(holidays) {
  const m = new Map();
  for (const h of normalizeHolidays(holidays)) m.set(h.date, h);
  return m;
}

// Is this date a working day for the org (before considering leaves)?
function isWorkingDay(dateStr, { weekOffs = ['Sunday'], holidays = [], offSaturdays = true } = {}) {
  const name = dayNameIST(dateStr);
  if (Array.isArray(weekOffs) && weekOffs.includes(name)) return false;
  if (offSaturdays && isSecondOrFourthSaturday(dateStr)) return false;
  const hm = holidayMap(holidays);
  if (hm.has(dateStr)) return false;
  return true;
}

// Build a Set of YYYY-MM-DD strings covered by APPROVED leave rows
// ({startDate,endDate} inclusive). Caps expansion to 62 days per row.
function approvedLeaveDaySet(leaves) {
  const set = new Set();
  for (const l of leaves || []) {
    const s = toDateKey(l.startDate || l.startdate || '');
    const e = toDateKey(l.endDate || l.enddate || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !/^\d{4}-\d{2}-\d{2}$/.test(e)) continue;
    let cur = s;
    let guard = 0;
    while (cur <= e && guard < 62) {
      set.add(cur);
      cur = addDays(cur, 1);
      guard += 1;
    }
  }
  return set;
}

module.exports = {
  IST_TZ,
  DEFAULT_DAILY_REQUIRED_HOURS,
  getTodayISTString,
  toDateKey,
  dayOfWeekIST,
  dayNameIST,
  addDays,
  dateRange,
  getMonday,
  getSaturdayOrdinal,
  isSaturday,
  isSecondOrFourthSaturday,
  getReminderWeekInfo,
  isReminderDay,
  normalizeHoliday,
  normalizeHolidays,
  holidayMap,
  isWorkingDay,
  approvedLeaveDaySet,
};
