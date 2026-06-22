// backend/routes/account.js
const express = require("express");
const router = express.Router();
const prisma = require("../utils/prisma");
const auth = require("../middleware/auth");

router.use(auth);

// ============================================================================
// DELETE /api/account/nuke - Delete all user data
// ============================================================================
router.delete("/nuke", async (req, res) => {
  try {
    const userId = req.user.id;

    // Delete in order to respect foreign keys
    await prisma.$transaction([
      prisma.taskCheckIn.deleteMany({ where: { task: { userId } } }),
      prisma.timeEntry.deleteMany({ where: { userId } }),
      prisma.timerState.deleteMany({ where: { userId } }),
      prisma.habitLog.deleteMany({ where: { habit: { userId } } }),
      prisma.task.deleteMany({ where: { userId } }),
      prisma.habit.deleteMany({ where: { userId } }),
      prisma.goal.deleteMany({ where: { userId } }),
      prisma.userSettings.deleteMany({ where: { userId } }),
    ]);

    res.json({
      message: "All data deleted successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Nuke error:", error);
    res.status(500).json({ message: "Failed to delete account data" });
  }
});

// ============================================================================
// DELETE /api/account/delete - Full account deletion
// ============================================================================
router.delete("/delete", async (req, res) => {
  try {
    const userId = req.user.id;

    await prisma.$transaction([
      prisma.taskCheckIn.deleteMany({ where: { task: { userId } } }),
      prisma.timeEntry.deleteMany({ where: { userId } }),
      prisma.timerState.deleteMany({ where: { userId } }),
      prisma.habitLog.deleteMany({ where: { habit: { userId } } }),
      prisma.task.deleteMany({ where: { userId } }),
      prisma.habit.deleteMany({ where: { userId } }),
      prisma.goal.deleteMany({ where: { userId } }),
      prisma.userSettings.deleteMany({ where: { userId } }),
      // Delete the user last
      prisma.user.delete({ where: { id: userId } }),
    ]);

    res.json({
      message: "Account deleted successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Account delete error:", error);
    res.status(500).json({ message: "Failed to delete account" });
  }
});

// ============================================================================
// GET /api/account/data-summary - See what will be deleted
// ============================================================================
router.get("/data-summary", async (req, res) => {
  try {
    const userId = req.user.id;

    const [goals, tasks, habits, habitLogs, timeEntries] = await Promise.all([
      prisma.goal.count({ where: { userId } }),
      prisma.task.count({ where: { userId } }),
      prisma.habit.count({ where: { userId } }),
      prisma.habitLog.count({ where: { habit: { userId } } }),
      prisma.timeEntry.count({ where: { userId } }),
    ]);

    res.json({
      goals,
      tasks,
      habits,
      habitLogs,
      timeEntries,
      totalEntries: goals + tasks + habits + habitLogs + timeEntries,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
