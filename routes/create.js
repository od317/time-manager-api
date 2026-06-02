const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const prisma = require("../utils/prisma");

router.get("/calendar-data", auth, async (req, res) => {
  try {
    const [goals, habits] = await Promise.all([
      prisma.goal.findMany({
        where: { userId: req.user.id },
        select: {
          id: true,
          title: true,
          color: true,
          startDate: true,
          endDate: true,
          status: true,
        },
      }),
      prisma.habit.findMany({
        where: { userId: req.user.id },
        select: {
          id: true,
          title: true,
          color: true,
          status: true,
        },
      }),
    ]);

    // Counts for context
    const activeGoals = goals.filter((g) => g.status === "ACTIVE").length;
    const upcomingDeadlines = goals.filter(
      (g) =>
        g.endDate && new Date(g.endDate) > new Date() && g.status === "ACTIVE",
    ).length;

    res.json({
      goals: goals.map((g) => ({ ...g, type: "goal" })),
      habits: habits.map((h) => ({
        ...h,
        type: "habit",
        date: new Date().toISOString(),
      })),
      activeGoals,
      upcomingDeadlines,
      activeHabits: habits.filter((h) => h.status === "ACTIVE").length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
