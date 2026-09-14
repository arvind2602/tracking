const { pool } = require('../../config/db');
const { BadRequestError, NotFoundError } = require('../../utils/errors');
const { normalizeHolidays } = require('../../utils/workCalendar');
const { randomUUID } = require('crypto');

function toDateStr(v) {
  return String(v || '').slice(0, 10);
}

// HR: list holidays for the org (normalized, sorted)
const getHolidays = async (req, res, next) => {
  try {
    const r = await pool.query(`SELECT holidays FROM organiation WHERE id=$1`, [req.user.organization_uuid]);
    if (r.rowCount === 0) return next(new NotFoundError('Organization not found'));
    res.json(normalizeHolidays(r.rows[0].holidays));
  } catch (e) {
    next(e);
  }
};

// HR: mark a holiday on any day with a reason
const addHoliday = async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') return next(new BadRequestError('Only admins can mark holidays'));
    const { date, name, reason } = req.body || {};
    const dateStr = toDateStr(date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return next(new BadRequestError('date (YYYY-MM-DD) is required'));
    if (!name || !String(name).trim()) return next(new BadRequestError('name/reason is required'));
    const r = await pool.query(`SELECT holidays FROM organiation WHERE id=$1`, [req.user.organization_uuid]);
    if (r.rowCount === 0) return next(new NotFoundError('Organization not found'));
    const current = normalizeHolidays(r.rows[0].holidays);
    if (current.some((h) => h.date === dateStr)) {
      return next(new BadRequestError(`A holiday is already marked on ${dateStr}`));
    }
    const entry = {
      id: randomUUID(),
      date: dateStr,
      name: String(name).trim(),
      reason: reason != null ? String(reason).trim() : '',
      createdBy: req.user.user_uuid,
      createdAt: new Date().toISOString(),
    };
    const updated = [...current, entry].sort((a, b) => (a.date < b.date ? -1 : 1));
    await pool.query(`UPDATE organiation SET holidays=$2::jsonb[], "updatedAt"=NOW() WHERE id=$1`, [
      req.user.organization_uuid,
      updated.map((u) => JSON.stringify(u)),
    ]);
    res.status(201).json(entry);
  } catch (e) {
    next(e);
  }
};

// HR: remove a marked holiday (by id or date)
const deleteHoliday = async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') return next(new BadRequestError('Only admins can remove holidays'));
    const key = String(req.params.key || '');
    const r = await pool.query(`SELECT holidays FROM organiation WHERE id=$1`, [req.user.organization_uuid]);
    if (r.rowCount === 0) return next(new NotFoundError('Organization not found'));
    const current = normalizeHolidays(r.rows[0].holidays);
    const filtered = current.filter((h) => h.id !== key && h.date !== key);
    if (filtered.length === current.length) return next(new NotFoundError('Holiday not found'));
    await pool.query(`UPDATE organiation SET holidays=$2::jsonb[], "updatedAt"=NOW() WHERE id=$1`, [
      req.user.organization_uuid,
      filtered.map((h) => JSON.stringify(h)),
    ]);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};

module.exports = { getHolidays, addHoliday, deleteHoliday };
