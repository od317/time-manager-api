// backend/routes/timeEntries.js
const express = require("express");
const prisma = require("../utils/prisma");
const router = express.Router();
const {
  startTimer,
  stopTimer,
  pauseTimer,
  resumeTimer,
  quickLog,
  deleteTimeEntry,
  updateTimeEntry,
} = require("../controllers/timeEntryController");
const auth = require("../middleware/auth");

router.use(auth);

// ============================================================================
// HELPERS
// ============================================================================
function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    seconds: totalSeconds,
    minutes: Math.round((totalSeconds / 60) * 100) / 100,
    hours: Math.round((totalSeconds / 3600) * 100) / 100,
    formatted: {
      compact: `${hours}h ${minutes}m ${seconds}s`,
      short: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${seconds}s`,
      human:
        hours > 0
          ? `${hours} hour${hours !== 1 ? "s" : ""} ${minutes} minute${minutes !== 1 ? "s" : ""}`
          : `${minutes} minute${minutes !== 1 ? "s" : ""} ${seconds} second${seconds !== 1 ? "s" : ""}`,
    },
  };
}

// ============================================================================
// STATIC ROUTES (before /:id)
// ============================================================================

// GET /api/time-entries/running
router.get("/running", async (req, res) => {
  try {
    const running = await prisma.timeEntry.findFirst({
      where: {
        userId: req.user.id,
        status: { in: ["RUNNING", "PAUSED"] },
      },
      include: {
        goal: { select: { id: true, title: true, color: true } },
        task: { select: { id: true, title: true } },
        habit: { select: { id: true, title: true } },
      },
    });

    if (!running) return res.json(null);

    if (running.status === "RUNNING") {
      running.elapsedSeconds = Math.floor(
        (new Date() - new Date(running.startTime)) / 1000,
      );
      running.elapsedFormatted = formatDuration(running.elapsedSeconds);
    }

    res.json(running);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/time-entries/summary
// GET /api/time-entries/summary
router.get("/summary", async (req, res) => {
  try {
    const { period } = req.query;
    const now = new Date();
    let startDate;

    switch (period) {
      case "week":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "month":
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      default:
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
    }

    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        userId: req.user.id,
        startTime: { gte: startDate },
        status: "COMPLETED",
      },
      include: {
        goal: { select: { id: true, title: true, color: true } },
        task: { select: { id: true, title: true } },
        habit: { select: { id: true, title: true, color: true } },
      },
    });

    // ========================================
    // STEP 1: Group by goal (direct time only)
    // ========================================
    const directByGoal = {};
    const byTask = {};
    const byHabit = {};
    let totalTime = 0;
    let unassigned = 0;

    // Collect taskIds with null goalId to look up their parent goals
    const orphanTaskIds = new Set();

    timeEntries.forEach((entry) => {
      const duration = entry.duration || 0;
      totalTime += duration;

      if (entry.task) {
        const key = entry.task.id;
        if (!byTask[key]) {
          byTask[key] = {
            id: key,
            title: entry.task.title,
            totalDuration: 0,
            entries: [],
          };
        }
        byTask[key].totalDuration += duration;
        byTask[key].entries.push(entry);

        // Track tasks with no direct goal for later lookup
        if (!entry.goalId) {
          orphanTaskIds.add(entry.task.id);
        }
      }

      if (entry.goal) {
        const key = entry.goal.id;
        if (!directByGoal[key]) {
          directByGoal[key] = {
            id: key,
            title: entry.goal.title,
            color: entry.goal.color,
            totalDuration: 0,
            entries: [],
          };
        }
        directByGoal[key].totalDuration += duration;
        directByGoal[key].entries.push(entry);
      }

      if (entry.habit) {
        const key = entry.habit.id;
        if (!byHabit[key]) {
          byHabit[key] = {
            id: key,
            title: entry.habit.title,
            color: entry.habit.color,
            totalDuration: 0,
            entries: [],
          };
        }
        byHabit[key].totalDuration += duration;
        byHabit[key].entries.push(entry);
      }

      if (!entry.goal && !entry.habit) unassigned += duration;
    });

    // ========================================
    // STEP 2: Look up parent goals for orphan tasks
    // ========================================
    const taskGoalMap = {};
    if (orphanTaskIds.size > 0) {
      const tasks = await prisma.task.findMany({
        where: { id: { in: [...orphanTaskIds] } },
        select: { id: true, goalId: true },
      });
      tasks.forEach((t) => {
        taskGoalMap[t.id] = t.goalId;
      });

      // Add orphan task time to their parent goal
      for (const taskId of orphanTaskIds) {
        const goalId = taskGoalMap[taskId];
        if (goalId && !directByGoal[goalId]) {
          // Fetch goal info if not already in directByGoal
          const goal = await prisma.goal.findUnique({
            where: { id: goalId },
            select: { id: true, title: true, color: true },
          });
          if (goal) {
            directByGoal[goal.id] = {
              id: goal.id,
              title: goal.title,
              color: goal.color,
              totalDuration: 0,
              entries: [],
            };
          }
        }
        if (goalId && directByGoal[goalId]) {
          const taskDuration = byTask[taskId]?.totalDuration || 0;
          // Don't double-count if already counted via direct goalId
        }
      }
    }

    // ========================================
    // STEP 3: Build goal hierarchy and roll up
    // ========================================
    const allGoalIds = Object.keys(directByGoal);
    const allGoals = await prisma.goal.findMany({
      where: { id: { in: allGoalIds } },
      select: { id: true, parentId: true },
    });

    const parentMap = {};
    allGoals.forEach((g) => {
      parentMap[g.id] = g.parentId;
    });

    // Calculate rolled-up time (direct + all descendants)
    function getRolledUpTime(goalId, visited = new Set()) {
      if (visited.has(goalId)) return 0; // Prevent circular
      visited.add(goalId);

      let total = directByGoal[goalId]?.totalDuration || 0;

      // Add time from all children
      for (const childId of allGoalIds) {
        if (parentMap[childId] === goalId) {
          total += getRolledUpTime(childId, visited);
        }
      }

      return total;
    }

    // ========================================
    // STEP 4: Format output
    // ========================================
    const formatGroup = (group) =>
      Object.values(group).map((item) => {
        const rolledUp = getRolledUpTime(item.id);
        return {
          ...item,
          totalDuration: rolledUp, // Use rolled-up time
          directDuration: item.totalDuration, // Original direct time
          childrenDuration: rolledUp - item.totalDuration,
          totalDurationSeconds: rolledUp,
          totalDurationMinutes: Math.round((rolledUp / 60) * 100) / 100,
          totalDurationHours: Math.round((rolledUp / 3600) * 100) / 100,
          durationFormatted: formatDuration(rolledUp),
          percentage:
            totalTime > 0
              ? Math.round((rolledUp / totalTime) * 10000) / 100
              : 0,
        };
      });

    const formatTaskGroup = (group) =>
      Object.values(group).map((item) => ({
        ...item,
        totalDurationSeconds: item.totalDuration,
        totalDurationMinutes: Math.round((item.totalDuration / 60) * 100) / 100,
        totalDurationHours: Math.round((item.totalDuration / 3600) * 100) / 100,
        durationFormatted: formatDuration(item.totalDuration),
        percentage:
          totalTime > 0
            ? Math.round((item.totalDuration / totalTime) * 10000) / 100
            : 0,
      }));

    res.json({
      period,
      startDate,
      endDate: now,
      totalTime: formatDuration(totalTime),
      totalTimeSeconds: totalTime,
      unassigned: formatDuration(unassigned),
      unassignedSeconds: unassigned,
      byGoal: formatGroup(directByGoal),
      byTask: formatTaskGroup(byTask),
      byHabit: formatTaskGroup(byHabit),
      entryCount: timeEntries.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/time-entries/start
router.post("/start", startTimer);

// POST /api/time-entries/quick-log
router.post("/quick-log", quickLog);

// POST /api/time-entries/cleanup
router.post("/cleanup", async (req, res) => {
  try {
    const result = await prisma.timeEntry.updateMany({
      where: { userId: req.user.id, status: { in: ["RUNNING", "PAUSED"] } },
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

// ============================================================================
// GET /api/time-entries - All entries with full details
// ============================================================================
router.get("/", async (req, res) => {
  try {
    const { goalId, taskId, habitId, startDate, endDate, status, entryType } =
      req.query;
    const where = { userId: req.user.id };

    if (goalId) where.goalId = goalId;
    if (taskId) where.taskId = taskId;
    if (habitId) where.habitId = habitId;
    if (status) where.status = status;
    if (entryType) where.entryType = entryType;
    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) where.startTime.lte = new Date(endDate);
    }

    const timeEntries = await prisma.timeEntry.findMany({
      where,
      include: {
        goal: {
          select: {
            id: true,
            title: true,
            color: true,
            goalType: true,
            status: true,
          },
        },
        task: {
          select: { id: true, title: true, status: true, priority: true },
        },
        habit: {
          select: { id: true, title: true, color: true, frequencyType: true },
        },
      },
      orderBy: { startTime: "desc" },
    });

    const enriched = timeEntries.map((entry) => ({
      ...entry,
      durationFormatted: entry.duration ? formatDuration(entry.duration) : null,
      ...(entry.status === "RUNNING" && {
        elapsedSeconds: Math.floor(
          (new Date() - new Date(entry.startTime)) / 1000,
        ),
        elapsedFormatted: formatDuration(
          Math.floor((new Date() - new Date(entry.startTime)) / 1000),
        ),
      }),
    }));

    const totalDuration = timeEntries.reduce(
      (sum, e) => sum + (e.duration || 0),
      0,
    );

    res.json({
      entries: enriched,
      count: timeEntries.length,
      summary: {
        totalDuration: formatDuration(totalDuration),
        byType: {
          TIMER: timeEntries.filter((e) => e.entryType === "TIMER").length,
          MANUAL: timeEntries.filter((e) => e.entryType === "MANUAL").length,
          POMODORO: timeEntries.filter((e) => e.entryType === "POMODORO")
            .length,
        },
        byStatus: {
          RUNNING: timeEntries.filter((e) => e.status === "RUNNING").length,
          PAUSED: timeEntries.filter((e) => e.status === "PAUSED").length,
          COMPLETED: timeEntries.filter((e) => e.status === "COMPLETED").length,
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// ============================================================================
// DYNAMIC ROUTES (after static ones)
// ============================================================================

// GET /api/time-entries/:id
router.get("/:id", async (req, res) => {
  try {
    const entry = await prisma.timeEntry.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        goal: {
          select: {
            id: true,
            title: true,
            color: true,
            goalType: true,
            status: true,
            targetValue: true,
            currentValue: true,
            unit: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
          },
        },
        habit: {
          select: { id: true, title: true, color: true, frequencyType: true },
        },
      },
    });

    if (!entry)
      return res.status(404).json({ message: "Time entry not found" });

    res.json({
      ...entry,
      durationFormatted: entry.duration ? formatDuration(entry.duration) : null,
      ...(entry.status === "RUNNING" && {
        elapsedSeconds: Math.floor(
          (new Date() - new Date(entry.startTime)) / 1000,
        ),
        elapsedFormatted: formatDuration(
          Math.floor((new Date() - new Date(entry.startTime)) / 1000),
        ),
      }),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/:id/stop", stopTimer);
router.post("/:id/stop", stopTimer);
router.put("/:id/pause", pauseTimer);
router.put("/:id/resume", resumeTimer);
router.delete("/:id", deleteTimeEntry);
router.patch("/:id", updateTimeEntry);

module.exports = router;
