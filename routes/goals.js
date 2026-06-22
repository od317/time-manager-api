const express = require("express");
const router = express.Router();
const {
  getGoals,
  getGoal,
  createGoal,
  updateGoal,
  deleteGoal,
  reorderGoals,
  getGoalStats,
  getGoalTime,
} = require("../controllers/goalController");
const auth = require("../middleware/auth");

router.use(auth); // All goal routes require authentication

router.get("/", getGoals);
router.get("/:id", getGoal);
router.post("/", createGoal);
router.put("/reorder", reorderGoals);
router.put("/:id", updateGoal);
router.delete("/:id", deleteGoal);
router.get("/:id/stats", getGoalStats);
router.get("/:id/time", getGoalTime);

module.exports = router;
