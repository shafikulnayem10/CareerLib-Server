const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

// Log whether the mail credentials work 
transporter
    .verify()
    .then(() => console.log('Email server is ready to send messages'))
    .catch((error) => console.error('Email configuration error:', error.message));

const escapeHtml = (value = '') =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const frontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:3000';

const getWelcomeEmail = (userName, userEmail) => {
    const name = escapeHtml(userName || 'there');
    const email = escapeHtml(userEmail);
    const year = new Date().getFullYear();

    return {
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: 'Welcome to CareerLib! 🎉',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to CareerLib</title>
</head>
<body style="margin:0;padding:0;background-color:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.6;color:#1a1a1a;">
    <div style="max-width:600px;margin:40px auto;padding:30px;background-color:#ffffff;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,0.1);">
        <div style="text-align:center;padding-bottom:20px;border-bottom:2px solid #f0f0f0;">
            <h1 style="color:#2563eb;font-size:28px;margin:0;">🚀 Welcome to CareerLib!</h1>
        </div>

        <div style="padding:30px 0;">
            <p style="font-size:18px;">Hi ${name}! 👋</p>
            <p>We're thrilled to have you join the CareerLib community. Your journey to finding the perfect job or the ideal candidate starts now!</p>

            <div style="background-color:#f8fafc;padding:20px;border-radius:8px;margin:25px 0;">
                <h3 style="margin-top:0;">What you can do with CareerLib:</h3>
                <ul style="padding-left:20px;margin:0;">
                    <li>Browse thousands of job opportunities</li>
                    <li>Connect with top companies and recruiters</li>
                    <li>Track your applications and interviews</li>
                    <li>Get personalized job recommendations</li>
                </ul>
            </div>

            <div style="text-align:center;">
                <a href="${frontendUrl()}" style="display:inline-block;background-color:#2563eb;color:#ffffff;padding:12px 30px;text-decoration:none;border-radius:8px;font-weight:600;margin-top:10px;">
                    Get Started Now
                </a>
            </div>

            <div style="margin-top:25px;padding:15px;background-color:#f0f9ff;border-radius:8px;border-left:4px solid #2563eb;">
                <p style="margin:0;color:#1e293b;font-size:15px;">
                    <strong>💡 Pro Tip:</strong> Complete your profile to get matched with the best opportunities!
                </p>
            </div>
        </div>

        <div style="margin-top:30px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:14px;">
            <p>Need help? Contact us at <a href="mailto:support@careerlib.com" style="color:#2563eb;text-decoration:none;">support@careerlib.com</a></p>
            <p style="font-size:13px;">This email was sent to ${email}</p>
            <p style="font-size:12px;color:#9ca3af;">© ${year} CareerLib. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`,
    };
};

// Generic sender, reused later for application status emails
const sendMail = async (mailOptions) => {
    try {
        const info = await transporter.sendMail(mailOptions);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error.message);
        return { success: false, error: error.message };
    }
};

const sendWelcomeEmail = (userEmail, userName) => sendMail(getWelcomeEmail(userName, userEmail));

module.exports = { sendMail, sendWelcomeEmail, escapeHtml };