const express = require("express");
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
router.put("/:id/pause", pauseTimer);
router.put("/:id/resume", resumeTimer);
router.delete("/:id", deleteTimeEntry);
router.patch("/:id", updateTimeEntry);

module.exports = router;
