const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const prisma = require("../utils/prisma");

// Complete a Pomodoro session with all work logs
router.post("/complete", auth, async (req, res) => {
  try {
    const { sessionLog } = req.body;

    if (!sessionLog || !Array.isArray(sessionLog) || sessionLog.length === 0) {
      return res.status(400).json({ message: "No session data provided" });
    }

    const createdEntries = [];

    for (const entry of sessionLog) {
      const { taskId, goalId, duration, note } = entry;

      // Create a completed time entry
      const timeEntry = await prisma.timeEntry.create({
        data: {
          userId: req.user.id,
          taskId: taskId || null,
          goalId: goalId || null,
          startTime: new Date(Date.now() - duration * 1000),
          endTime: new Date(),
          duration,
          status: "COMPLETED",
          entryType: "POMODORO",
          note: note || "Pomodoro session",
        },
      });

      createdEntries.push(timeEntry);
    }

    res.status(201).json({
      message: `Created ${createdEntries.length} time entries`,
      entries: createdEntries,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
