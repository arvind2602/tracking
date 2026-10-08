const Joi = require('joi');
const { pool } = require('../../config/db');
const { BadRequestError } = require('../../utils/errors');
const push = require('../../utils/pushNotifications');

/**
 * Cron-secret guard shared with the cron controller.
 * Accepts: X-CRON-SECRET / X-CRON-KEY headers, ?key= / ?secret=, or Bearer.
 */
const requireCronSecret = (req, res, next) => {
    const secret = process.env.CRON_SECRET || process.env.CRONJOB_SECRET;
    if (!secret) {
        return res.status(500).json({ message: 'CRON_SECRET not configured on server' });
    }
    const provided =
        req.headers['x-cron-secret'] ||
        req.headers['x-cron-key'] ||
        req.query.key ||
        req.query.secret ||
        (req.headers.authorization && req.headers.authorization.replace('Bearer ', ''));
    if (provided !== secret) {
        return res.status(401).json({ message: 'Invalid cron secret' });
    }
    next();
};

/**
 * Register (or refresh) the caller's FCM device token.
 * POST /api/notifications/devices  { token, platform?, deviceName? }
 */
const registerDevice = async (req, res, next) => {
    const schema = Joi.object({
        token: Joi.string().min(20).required(),
        platform: Joi.string().valid('android', 'ios', 'web').optional().allow(null),
        deviceName: Joi.string().max(255).optional().allow(null, ''),
    });
    const { error } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));

    const { token, platform, deviceName } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO "push_device" ("employeeId", "fcmToken", "platform", "deviceName", "isActive", "lastSeenAt")
             VALUES ($1, $2, $3, $4, true, NOW())
             ON CONFLICT ("fcmToken") DO UPDATE
                SET "employeeId" = EXCLUDED."employeeId",
                    "platform" = EXCLUDED."platform",
                    "deviceName" = EXCLUDED."deviceName",
                    "isActive" = true,
                    "lastSeenAt" = NOW()
             RETURNING id, platform, "deviceName", "isActive", "createdAt", "lastSeenAt"`,
            [req.user.user_uuid, token, platform || null, deviceName || null]
        );
        res.status(201).json({ success: true, device: result.rows[0] });
    } catch (err) {
        next(err);
    }
};

/**
 * Deactivate the caller's device token(s) — called on logout.
 * DELETE /api/notifications/devices  { token? }  (all tokens when omitted)
 */
const unregisterDevice = async (req, res, next) => {
    const token = req.body?.token;
    try {
        const params = [req.user.user_uuid];
        let sql = `UPDATE "push_device" SET "isActive" = false WHERE "employeeId" = $1`;
        if (token) {
            params.push(token);
            sql += ` AND "fcmToken" = $2`;
        }
        const result = await pool.query(sql, params);
        res.json({ success: true, deactivated: result.rowCount });
    } catch (err) {
        next(err);
    }
};

/** List the caller's registered devices (token redacted). */
const listMyDevices = async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT id, platform, "deviceName", "isActive", "createdAt", "lastSeenAt"
             FROM "push_device"
             WHERE "employeeId" = $1
             ORDER BY "lastSeenAt" DESC`,
            [req.user.user_uuid]
        );
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
};

/**
 * Verify Firebase credentials with an FCM dry-run (nothing is delivered).
 * Send { real: true } for an actual notification to the "global" topic.
 * POST /api/notifications/test   (cron secret)
 */
const testSend = async (req, res) => {
    const message = push.buildMessage({
        title: req.body?.title || 'VigTask test notification',
        body: req.body?.body || 'Push notifications are wired up correctly.',
        link: req.body?.link || '/dashboard',
        type: 'test',
    });
    const real = req.body?.real === true || req.query.real === '1';
    const result = real
        ? await push.sendToTopic('global', message)
        : await push.dryRunSend(message, { topic: 'global' });
    res.status(result.ok ? 200 : 502).json(result);
};

/**
 * Broadcast an announcement to every subscribed device.
 * POST /api/notifications/broadcast  { title, body, link?, topic? }  (cron secret)
 */
const broadcast = async (req, res, next) => {
    const schema = Joi.object({
        title: Joi.string().max(200).required(),
        body: Joi.string().max(1000).required(),
        link: Joi.string().max(2000).optional().allow(null, ''),
        topic: Joi.string().max(100).optional().default('global'),
    });
    const { error } = schema.validate(req.body);
    if (error) return next(new BadRequestError(error.details[0].message));

    const { title, body, link, topic } = req.body;
    const result = await push.sendToTopic(
        topic || 'global',
        push.buildMessage({ title, body, link, type: 'broadcast' })
    );
    res.status(result.ok ? 200 : 502).json(result);
};

module.exports = {
    requireCronSecret,
    registerDevice,
    unregisterDevice,
    listMyDevices,
    testSend,
    broadcast,
};
