const express = require("express");
const morgan = require("morgan");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const goalRoutes = require("./routes/goals");
const habitRoutes = require("./routes/habits");
const timeEntryRoutes = require("./routes/timeEntries");
const taskRoutes = require("./routes/tasks");
const aiRoutes = require("./routes/ai");
const deadlineRoutes = require("./routes/deadline");
const errorHandler = require("./middleware/errorHandler");
const setupRoutes = require("./routes/setup");
const createRoutes = require("./routes/create");
const pomodoroRoutes = require("./routes/pomodoro");
const seedRoutes = require("./routes/seed");
const todayRoutes = require("./routes/today");
const timerStateRoutes = require("./routes/timerState");
const accountRoutes = require("./routes/account");
const app = express();
const PORT = process.env.PORT || 5000;

// Manual CORS - works without any package
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "1mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/habits", habitRoutes);
app.use("/api/time-entries", timeEntryRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/deadline", deadlineRoutes);
app.use("/api/setup", setupRoutes);
app.use("/api/create", createRoutes);
app.use("/api/pomodoro", pomodoroRoutes);
app.use("/api/seed", seedRoutes);
app.use("/api/timer-state", timerStateRoutes);
app.use("/api/account", accountRoutes);

app.use("/api/today", todayRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
