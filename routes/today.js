// backend/routes/today.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { getTodayDashboard } = require("../controllers/todayController");

router.use(auth);
router.get("/", getTodayDashboard);

module.exports = router;
