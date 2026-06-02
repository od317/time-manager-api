const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
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

const app = express();
const PORT = process.env.PORT || 5000;

// CORS FIRST - before helmet
app.use(
  cors({
    origin: "https://time-manager-dun.vercel.app",
    credentials: true,
  }),
);

// Helmet AFTER CORS, with cross-origin disabled
// app.use(
//   helmet({
//     crossOriginResourcePolicy: { policy: "cross-origin" },
//   }),
// );

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/habits", habitRoutes);
app.use("/api/time-entries", timeEntryRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/deadline", deadlineRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
