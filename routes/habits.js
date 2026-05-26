const express = require("express");
const router = express.Router();
const {
  getHabits,
  getHabit,
  createHabit,
  updateHabit,
  deleteHabit,
  logHabit,
  skipHabit,
  getHabitHeatmap,
  getHabitStats,
} = require("../controllers/habitController");
const auth = require("../middleware/auth");

router.use(auth);

router.get("/", getHabits);
router.get("/:id", getHabit);
router.post("/", createHabit);
router.put("/:id", updateHabit);
router.delete("/:id", deleteHabit);
router.post("/:id/log", logHabit);
router.post("/:id/skip", skipHabit);
router.get("/:id/heatmap", getHabitHeatmap);
router.get("/:id/stats", getHabitStats);

module.exports = router;
