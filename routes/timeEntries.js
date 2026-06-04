const express = require("express");
const prisma = require("../utils/prisma");
const router = express.Router();
const {
  getTimeEntries,
  getTimeEntry,
  startTimer,
  stopTimer,
  pauseTimer,
  resumeTimer,
  quickLog,
  deleteTimeEntry,
  getRunningTimer,
  getTimeSummary,
  updateTimeEntry,
} = require("../controllers/timeEntryController");
const auth = require("../middleware/auth");

router.use(auth);

// Static routes FIRST (before /:id)
router.get("/running", getRunningTimer);
router.get("/summary", getTimeSummary);
router.post("/start", startTimer);
router.post("/quick-log", quickLog);

// Dynamic routes SECOND
router.get("/", getTimeEntries);
router.get("/:id", getTimeEntry);
router.put("/:id/stop", stopTimer);
router.post("/:id/stop", stopTimer);
router.put("/:id/pause", pauseTimer);
router.put("/:id/resume", resumeTimer);
router.delete("/:id", deleteTimeEntry);
router.patch("/:id", updateTimeEntry);

router.post("/cleanup", auth, async (req, res) => {
  try {
    const result = await prisma.timeEntry.updateMany({
      where: {
        userId: req.user.id,
        status: { in: ["RUNNING", "PAUSED"] },
      },
      data: {
        status: "COMPLETED",
        endTime: new Date(),
        duration: 0,
        note: "Auto-closed (cleanup)",
      },
    });

    res.json({ message: `Cleaned up ${result.count} entries` });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
