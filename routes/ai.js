// backend/routes/ai.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  getInsights,
  generatePlan,
  createPlan,
} = require("../controllers/aiController");

router.use(auth);

router.post("/insights", getInsights);
router.post("/generate-plan", generatePlan); // Returns AI plan (no save)
router.post("/create-plan", createPlan); // Saves edited plan to DB

module.exports = router;
