const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendVerificationEmail(email, token) {
  const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;

  try {
    await resend.emails.send({
      from: "TimeFlow <onboarding@resend.dev>",
      to: email,
      subject: "Verify your TimeFlow account",
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #6366F1; font-size: 28px; margin: 0;">⏱️ TimeFlow</h1>
            <p style="color: #94A3B8; margin-top: 5px;">Master your time, achieve your goals</p>
          </div>
          <div style="background: #F8FAFC; border-radius: 12px; padding: 30px; text-align: center;">
            <h2 style="color: #0F172A; margin: 0 0 15px;">Verify your email</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">Click below to verify your email and complete registration.</p>
            <a href="${verificationUrl}" style="display: inline-block; padding: 14px 32px; background: #6366F1; color: white; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px; margin-top: 20px;">Verify Email</a>
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

  try {
    await resend.emails.send({
      from: "TimeFlow <onboarding@resend.dev>",
      to: email,
      subject: "Reset your TimeFlow password",
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', sans-serif; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #6366F1; font-size: 28px; margin: 0;">⏱️ TimeFlow</h1>
          </div>
          <div style="background: #F8FAFC; border-radius: 12px; padding: 30px; text-align: center;">
            <h2 style="color: #0F172A; margin: 0 0 15px;">Reset your password</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">Click below to reset your password. This link expires in 1 hour.</p>
            <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background: #6366F1; color: white; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px; margin-top: 20px;">Reset Password</a>
          </div>
        </div>
      `,
    });
    console.log("Password reset email sent to:", email);
  } catch (error) {
    console.error("Failed to send password reset email:", error.message);
  }
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
