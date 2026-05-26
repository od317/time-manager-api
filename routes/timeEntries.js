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
} = require("../controllers/timeEntryController");
const auth = require("../middleware/auth");

router.use(auth);

router.get("/", getTimeEntries);
router.get("/running", getRunningTimer);
router.get("/summary", getTimeSummary);
router.get("/:id", getTimeEntry);

router.post("/start", startTimer);
router.post("/quick-log", quickLog);

router.put("/:id/stop", stopTimer);
router.put("/:id/pause", pauseTimer);
router.put("/:id/resume", resumeTimer);

router.delete("/:id", deleteTimeEntry);

module.exports = router;
