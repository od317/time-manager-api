const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const prisma = require("../utils/prisma");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require("../utils/email");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};

// @desc    Register user
// @route   POST /api/auth/register
const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      if (!existingUser.emailVerified) {
        const accountAge =
          Date.now() - new Date(existingUser.createdAt).getTime();
        const isOld = accountAge > 30 * 24 * 60 * 60 * 1000; // 30 days

        if (isOld) {
          // Delete old unverified account
          await prisma.user.delete({ where: { id: existingUser.id } });
          // Fall through to create new account
        } else {
          // Recent unverified account - auto-resend verification
          const verificationToken = crypto.randomBytes(32).toString("hex");
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { verificationToken },
          });

          try {
            await sendVerificationEmail(email, verificationToken);
            console.log(`Verification email resent to: ${email}`);
          } catch (emailError) {
            console.error(
              `Failed to send verification email to ${email}:`,
              emailError.message,
            );
          }

          return res.status(400).json({
            message:
              "An unverified account exists. A new verification email has been sent. Please check your inbox.",
            code: "UNVERIFIED",
          });
        }
      } else {
        return res
          .status(400)
          .json({ message: "An account with this email already exists." });
      }
    }

    // Create new user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name, verificationToken },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    try {
      await sendVerificationEmail(email, verificationToken);
      console.log(`Verification email sent to: ${email}`);
    } catch (emailError) {
      console.error(
        `Failed to send verification email to ${email}:`,
        emailError.message,
      );
    }

    const token = generateToken(user.id);
    res.status(201).json({ user, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    prisma.timeEntry
      .updateMany({
        where: {
          userId: user.id,
          status: "RUNNING",
          startTime: { lt: twelveHoursAgo },
        },
        data: {
          status: "COMPLETED",
          endTime: new Date(),
          duration: 0,
          note: "Auto-closed (abandoned)",
        },
      })
      .catch(() => {});

    // Check for overdue goals
    const { checkOverdueGoals } = require("../services/deadlineService");
    checkOverdueGoals(user.id).catch(console.error);

    const token = generateToken(user.id);

    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        timezone: true,
        emailVerified: true,
        createdAt: true,
        settings: true,
      },
    });

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
const logout = async (req, res) => {
  res.cookie("token", "", { httpOnly: true, expires: new Date(0), path: "/" });
  res.json({ message: "Logged out" });
};

// @desc    Verify email
// @route   POST /api/auth/verify-email
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    const user = await prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired verification token" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
      },
    });

    res.json({ message: "Email verified successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.emailVerified) {
      return res.json({
        message:
          "If that account exists and is unverified, a new link has been sent.",
      });
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken },
    });

    try {
      await sendVerificationEmail(email, verificationToken);
      console.log(`Verification email resent to: ${email}`);
    } catch (emailError) {
      console.error(
        `Failed to resend verification email to ${email}:`,
        emailError.message,
      );
    }
    res.json({ message: "Verification email sent." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.json({
        message: "If that email exists, a reset link has been sent.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    });

    await sendPasswordResetEmail(email, resetToken);

    res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset token" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Update profile
// @route   PUT /api/auth/profile
const updateProfile = async (req, res) => {
  try {
    const { name } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name },
      select: {
        id: true,
        email: true,
        name: true,
        timezone: true,
        createdAt: true,
      },
    });
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Update settings
// @route   PUT /api/auth/settings
const updateSettings = async (req, res) => {
  try {
    const { timezone, ...settingsData } = req.body;

    if (timezone) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { timezone },
      });
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, ...settingsData },
      update: settingsData,
    });

    res.json(settings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  register,
  login,
  getMe,
  logout,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  updateProfile,
  updateSettings,
};
