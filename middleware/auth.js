const jwt = require("jsonwebtoken");
const prisma = require("../utils/prisma");

// Track last check per user to avoid checking every request
const lastCheck = new Map();

const auth = async (req, res, next) => {
  try {
    let token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;

    // Check overdue goals once per hour per user
    const now = Date.now();
    const userId = user.id;
    if (!lastCheck.has(userId) || now - lastCheck.get(userId) > 60000) {
      lastCheck.set(userId, now);
      const { checkOverdueGoals } = require("../services/deadlineService");
      checkOverdueGoals(userId).catch(() => {});
    }

    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = auth;
