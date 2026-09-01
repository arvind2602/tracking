const logger = require('./logger');

let resendClient = null;

function getResend() {
    if (resendClient) return resendClient;
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return null;
    const { Resend } = require('resend');
    resendClient = new Resend(apiKey);
    return resendClient;
}

async function sendResetEmail(toEmail, resetUrl, token) {
    const from = process.env.EMAIL_FROM || process.env.RESEND_FROM || 'Vighnotech <no-reply@vighnotech.com>';
    const appName = process.env.APP_NAME || 'Vighnotech Tracker';
    const subject = `${appName} - Password Reset Request`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; background:#ffffff; padding:24px; border-radius:12px; border:1px solid #eee;">
            <h2 style="color:#4F46E5; margin:0 0 12px;">Password Reset Request</h2>
            <p style="color:#333; line-height:1.5;">You requested a password reset for your account.</p>
            <p style="color:#333;">This link will expire in <b>15 minutes</b>.</p>
            <p style="text-align:center; margin: 24px 0;">
                <a href="${resetUrl}" style="background:#4F46E5; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; display:inline-block; font-weight:600;">Reset Password</a>
            </p>
            <p style="color:#333;">Or copy and paste this URL into your browser:</p>
            <p style="word-break: break-all; color:#666; background:#f8f8f8; padding:10px; border-radius:6px;">${resetUrl}</p>
            <hr style="margin:24px 0; border:none; border-top:1px solid #eee;" />
            <p style="font-size:12px; color:#888;">If you did not request this, you can safely ignore this email. Your password will remain unchanged.</p>
        </div>
    `;
    const text = `Password Reset Request\n\nYou requested a password reset. Use this link (expires in 15 minutes):\n${resetUrl}\n\nIf you did not request this, ignore this email.`;

    const resend = getResend();
    if (!resend) {
        logger.warn(`RESEND_API_KEY not set - mocking reset email to ${toEmail}`);
        return { mocked: true };
    }

    try {
        const { data, error } = await resend.emails.send({
            from,
            to: [toEmail],
            subject,
            html,
            text,
        });
        if (error) {
            logger.error(`Resend error sending reset email to ${toEmail}: ${JSON.stringify(error)}`);
            throw new Error(error.message || 'Resend failed');
        }
        logger.info(`Reset email sent via Resend to ${toEmail} id=${data?.id}`);
        return { mocked: false, id: data?.id };
    } catch (err) {
        logger.error(`Failed to send reset email to ${toEmail}: ${err.message}`);
        throw err;
    }
}

async function sendOtpEmail(toEmail, otp) {
    const from = process.env.EMAIL_FROM || process.env.RESEND_FROM || 'Vighnotech <no-reply@vighnotech.com>';
    const appName = process.env.APP_NAME || 'Vighnotech Tracker';
    const subject = `${appName} – Your password reset code`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; background:#ffffff; padding:24px; border-radius:12px; border:1px solid #eee;">
            <h2 style="color:#4F46E5; margin:0 0 12px;">Password Reset Code</h2>
            <p style="color:#333; line-height:1.5;">You requested a password reset for your account.</p>
            <p style="color:#333;">Your verification code is:</p>
            <p style="text-align:center; margin: 24px 0;">
                <span style="font-size:32px; letter-spacing:8px; font-weight:700; background:#f5f5ff; border:1px dashed #4F46E5; padding:12px 24px; border-radius:8px; display:inline-block; color:#4F46E5;">${otp}</span>
            </p>
            <p style="color:#333; text-align:center;">This code expires in <b>10 minutes</b>. Don't share it with anyone.</p>
            <hr style="margin:24px 0; border:none; border-top:1px solid #eee;" />
            <p style="font-size:12px; color:#888;">If you did not request this, you can safely ignore this email. Your password will remain unchanged.</p>
        </div>
    `;
    const text = `Your password reset code is ${otp}. It expires in 10 minutes. Don't share it. If you didn't request this, ignore this email.`;
    const resend = getResend();
    if (!resend) {
        logger.warn(`RESEND_API_KEY not set - mocking OTP email to ${toEmail}`);
        return { mocked: true };
    }
    try {
        const { data, error } = await resend.emails.send({ from, to: [toEmail], subject, html, text });
        if (error) {
            logger.error(`Resend error sending OTP to ${toEmail}: ${JSON.stringify(error)}`);
            throw new Error(error.message || 'Resend failed');
        }
        logger.info(`OTP email sent via Resend to ${toEmail} id=${data?.id}`);
        return { mocked: false, id: data?.id };
    } catch (err) {
        logger.error(`Failed to send OTP email to ${toEmail}: ${err.message}`);
        throw err;
    }
}

async function sendWeeklySummaryEmail({ to, subject, html, text }) {
    const from = process.env.EMAIL_FROM || process.env.RESEND_FROM || 'Vighnotech <no-reply@vighnotech.com>';
    const resend = getResend();
    if (!resend) {
        // Keep mock behaviour for local dev without key — log subject size and recipients
        logger.warn(`RESEND_API_KEY not set - mocking weekly summary email to ${Array.isArray(to) ? to.join(',') : to} subject="${subject}"`);
        return { mocked: true };
    }
    try {
        const { data, error } = await resend.emails.send({ from, to: Array.isArray(to) ? to : [to], subject, html, text });
        if (error) {
            logger.error(`Resend error sending weekly summary to ${to}: ${JSON.stringify(error)}`);
            throw new Error(error.message || 'Resend failed');
        }
        logger.info(`Weekly summary sent via Resend to ${Array.isArray(to) ? to.join(',') : to} id=${data?.id}`);
        return { mocked: false, id: data?.id };
    } catch (err) {
        logger.error(`Failed to send weekly summary to ${to}: ${err.message}`);
        throw err;
    }
}

module.exports = { sendResetEmail, sendOtpEmail, getResend, sendWeeklySummaryEmail };
