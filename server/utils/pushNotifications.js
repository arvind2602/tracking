const logger = require('./logger');

/**
 * Push notifications via Firebase Cloud Messaging (Admin SDK).
 *
 * Follows the same lazy/mocked pattern as utils/email.js: if
 * FIREBASE_SERVICE_ACCOUNT is missing or invalid, sends are mocked and
 * logged so development never breaks.
 *
 * FIREBASE_SERVICE_ACCOUNT accepts either:
 *   - the raw JSON service-account file contents, or
 *   - base64-encoded JSON (recommended for .env / Vercel).
 */

const NOTIFICATION_CHANNEL = 'vigtask_high_importance_channel';
const MULTICAST_BATCH_SIZE = 500; // FCM multicast limit
const DEAD_TOKEN_CODES = [
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
];

/** True when FCM rejected the token itself (vs. a payload problem). */
function isDeadTokenError(error) {
    const code = error?.code || '';
    if (DEAD_TOKEN_CODES.some((c) => code.includes(c))) return true;
    // Malformed tokens surface as invalid-argument with a token-specific message
    return code.includes('messaging/invalid-argument') && /registration token/i.test(error?.message || '');
}

let messagingInstance = null;
let initAttempted = false;

function getServiceAccount() {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw || !raw.trim()) return null;
    try {
        const text = raw.trim().startsWith('{')
            ? raw
            : Buffer.from(raw, 'base64').toString('utf8');
        return JSON.parse(text);
    } catch (err) {
        logger.error(`FIREBASE_SERVICE_ACCOUNT is not valid JSON/base64: ${err.message}`);
        return null;
    }
}

function getMessaging() {
    if (messagingInstance) return messagingInstance;
    if (initAttempted) return null;
    initAttempted = true;

    const serviceAccount = getServiceAccount();
    if (!serviceAccount) return null;

    try {
        const { initializeApp, getApps, getApp, cert } = require('firebase-admin/app');
        const { getMessaging: getMessagingFn } = require('firebase-admin/messaging');
        const app = getApps().length ? getApp() : initializeApp({ credential: cert(serviceAccount) });
        messagingInstance = getMessagingFn(app);
        return messagingInstance;
    } catch (err) {
        logger.error(`firebase-admin initialization failed: ${err.message}`);
        return null;
    }
}

/** Shortens text for notification bodies. */
function truncate(text, max = 90) {
    const str = String(text ?? '').replace(/\s+/g, ' ').trim();
    return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

/**
 * Builds an FCM message. `data` values must be strings; the Flutter app
 * reads `link` on tap to open the page inside the WebView.
 */
function buildMessage({ title, body, link, type, extra }) {
    const data = {};
    if (link) data.link = String(link);
    if (type) data.type = String(type);
    if (extra) {
        for (const [key, value] of Object.entries(extra)) {
            if (value !== undefined && value !== null) data[key] = String(value);
        }
    }
    return {
        notification: { title, body },
        data,
        android: {
            priority: 'high',
            notification: { channelId: NOTIFICATION_CHANNEL },
        },
        apns: { payload: { aps: { sound: 'default' } } },
    };
}

/** Active FCM tokens for a set of employees (deduped). */
async function getActiveTokens(employeeIds) {
    const ids = [...new Set((employeeIds || []).filter(Boolean))];
    if (!ids.length) return [];

    const { pool } = require('../config/db');
    const result = await pool.query(
        `SELECT "fcmToken" FROM "push_device"
         WHERE "employeeId" = ANY($1::uuid[]) AND "isActive" = true`,
        [ids]
    );
    return result.rows.map((row) => row.fcmToken);
}

/** Marks a token inactive (FCM said it no longer exists). */
async function purgeToken(token) {
    try {
        const { pool } = require('../config/db');
        await pool.query(
            `UPDATE "push_device" SET "isActive" = false WHERE "fcmToken" = $1`,
            [token]
        );
    } catch (err) {
        logger.warn(`Failed to deactivate stale FCM token: ${err.message}`);
    }
}

/**
 * Sends a notification to every registered device of the given employees.
 * Never throws — safe to fire-and-forget from controllers.
 *
 * @returns {Promise<{ok: boolean, mocked?: boolean, sent?: number, failed?: number, error?: string}>}
 */
async function sendToEmployeeIds(employeeIds, message) {
    try {
        const messaging = getMessaging();
        if (!messaging) {
            logger.warn('Push not configured (FIREBASE_SERVICE_ACCOUNT missing) - mocking push send');
            return { ok: true, mocked: true };
        }

        const tokens = await getActiveTokens(employeeIds);
        if (!tokens.length) return { ok: true, sent: 0, skipped: 'no active tokens' };

        let sent = 0;
        let failed = 0;
        for (let i = 0; i < tokens.length; i += MULTICAST_BATCH_SIZE) {
            const batch = tokens.slice(i, i + MULTICAST_BATCH_SIZE);
            const response = await messaging.sendEachForMulticast({ tokens: batch, ...message });

            response.responses.forEach((res, idx) => {
                if (res.success) {
                    sent += 1;
                } else {
                    failed += 1;
                    logger.warn(`FCM rejected token (${res.error?.code || 'unknown'}): ${res.error?.message || ''}`);
                    if (isDeadTokenError(res.error)) {
                        purgeToken(batch[idx]);
                    }
                }
            });
        }
        logger.info(`Push send: ${sent} delivered, ${failed} failed (target employees: ${[...new Set(employeeIds)].length})`);
        return { ok: true, sent, failed };
    } catch (err) {
        logger.error(`Push send failed: ${err.message}`);
        return { ok: false, error: err.message };
    }
}

/**
 * Sends to an FCM topic (e.g. "global" — every device auto-subscribes
 * in the Flutter app). Never throws.
 */
async function sendToTopic(topic, message) {
    try {
        const messaging = getMessaging();
        if (!messaging) {
            logger.warn('Push not configured (FIREBASE_SERVICE_ACCOUNT missing) - mocking topic push');
            return { ok: true, mocked: true };
        }
        const messageId = await messaging.send({ topic, ...message });
        logger.info(`Push sent to topic "${topic}" id=${messageId}`);
        return { ok: true, messageId, topic };
    } catch (err) {
        logger.error(`Topic push to "${topic}" failed: ${err.message}`);
        return { ok: false, error: err.message };
    }
}

/**
 * Validates credentials + payload without delivering anything
 * (FCM dry-run). Never throws.
 */
async function dryRunSend(message, { topic = 'global' } = {}) {
    try {
        const messaging = getMessaging();
        if (!messaging) {
            return { ok: false, error: 'Push not configured (FIREBASE_SERVICE_ACCOUNT missing)' };
        }
        const messageId = await messaging.send({ topic, ...message }, true);
        return { ok: true, messageId, dryRun: true, topic };
    } catch (err) {
        logger.error(`Push dry-run failed: ${err.message}`);
        return { ok: false, error: err.message };
    }
}

module.exports = {
    buildMessage,
    truncate,
    getActiveTokens,
    sendToEmployeeIds,
    sendToTopic,
    dryRunSend,
    isConfigured: () => Boolean(getMessaging()),
};
