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
        logger.info(`[DEV] RESEND_API_KEY not set - mocking email. To: ${toEmail} ResetURL: ${resetUrl} Token: ${token}`);
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

module.exports = { sendResetEmail, getResend };
