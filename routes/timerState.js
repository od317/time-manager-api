// backend/routes/timerState.js
const express = require("express");
const router = express.Router();
const prisma = require("../utils/prisma");
const auth = require("../middleware/auth");

router.use(auth);

// ============================================================================
// PUT /api/timer-state - Save or update timer state
// ============================================================================
router.put("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const { timerMode, state } = req.body;

    // Upsert: create if not exists, update if exists
    const existing = await prisma.timerState.findUnique({ where: { userId } });

    if (existing) {
      const updated = await prisma.timerState.update({
        where: { userId },
        data: {
          timerMode,
          state: JSON.stringify(state),
          updatedAt: new Date(),
        },
      });
      return res.json({ id: updated.id, savedAt: updated.updatedAt });
    }

    const created = await prisma.timerState.create({
      data: {
        userId,
        timerMode,
        state: JSON.stringify(state),
      },
    });
    res.status(201).json({ id: created.id, savedAt: created.updatedAt });
  } catch (error) {
    console.error("Timer state save error:", error);
    res.status(500).json({ message: "Failed to save timer state" });
  }
});

// ============================================================================
// GET /api/timer-state - Retrieve current timer state
// ============================================================================
router.get("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const timerState = await prisma.timerState.findUnique({
      where: { userId },
    });

    if (!timerState) {
      return res.json(null);
    }

    // If timer was last updated more than 12 hours ago, it's stale
    const hoursSinceUpdate =
      (Date.now() - new Date(timerState.updatedAt).getTime()) / 3600000;
    if (hoursSinceUpdate > 12) {
      await prisma.timerState.delete({ where: { userId } });
      return res.json(null);
    }

    res.json({
      timerMode: timerState.timerMode,
      state:
        typeof timerState.state === "string"
          ? JSON.parse(timerState.state)
          : timerState.state,
      savedAt: timerState.updatedAt,
    });
  } catch (error) {
    console.error("Timer state load error:", error);
    res.status(500).json({ message: "Failed to load timer state" });
  }
});

// ============================================================================
// DELETE /api/timer-state - Clear timer state (called on stop)
// ============================================================================
router.delete("/", async (req, res) => {
  try {
    const userId = req.user.id;
    await prisma.timerState.deleteMany({ where: { userId } });
    res.json({ message: "Timer state cleared" });
  } catch (error) {
    console.error("Timer state delete error:", error);
    res.status(500).json({ message: "Failed to clear timer state" });
  }
});

module.exports = router;
