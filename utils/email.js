const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendVerificationEmail(email, token) {
  const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Verify your TimeFlow account",
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #6366F1; font-size: 28px; margin: 0;">⏱️ TimeFlow</h1>
            <p style="color: #94A3B8; margin-top: 5px;">Master your time, achieve your goals</p>
          </div>
          
          <div style="background: #F8FAFC; border-radius: 12px; padding: 30px; text-align: center;">
            <h2 style="color: #0F172A; margin: 0 0 15px;">Verify your email address</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
              Thanks for signing up! Click the button below to verify your email and complete your registration.
            </p>
            <a href="${verificationUrl}" style="display: inline-block; padding: 14px 32px; background: #6366F1; color: white; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px;">
              Verify Email
            </a>
            <p style="color: #94A3B8; font-size: 14px; margin-top: 20px;">
              Or copy this link:<br>
              <a href="${verificationUrl}" style="color: #6366F1; word-break: break-all;">${verificationUrl}</a>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #94A3B8; font-size: 13px;">
              If you didn't create an account, you can safely ignore this email.
            </p>
          </div>
        </div>
      `,
    });
    console.log("Verification email sent to:", email);
  } catch (error) {
    console.error("Failed to send verification email:", error.message);
  }
}

async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Reset your TimeFlow password",
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: sans-serif;">
        <h1 style="color: #6366F1;">TimeFlow</h1>
        <h2>Reset your password</h2>
        <p>Click the button below to reset your password. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #6366F1; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
          Reset Password
        </a>
        <p style="color: #94A3B8; margin-top: 20px; font-size: 14px;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
