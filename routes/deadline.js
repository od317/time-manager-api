const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { checkOverdueGoals } = require("../services/deadlineService");

router.post("/check", auth, async (req, res) => {
  try {
    const result = await checkOverdueGoals(req.user.id);
    res.json({
      message: "Check complete",
      ...result,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
