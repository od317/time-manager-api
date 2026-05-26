const prisma = require("../utils/prisma");

// @desc    Get all time entries for user
// @route   GET /api/time-entries
const getTimeEntries = async (req, res) => {
  try {
    const { goalId, taskId, habitId, startDate, endDate, limit } = req.query;

    const where = {
      userId: req.user.id,
    };

    if (goalId) where.goalId = goalId;
    if (taskId) where.taskId = taskId;
    if (habitId) where.habitId = habitId;

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) where.startTime.lte = new Date(endDate);
    }

    const timeEntries = await prisma.timeEntry.findMany({
      where,
      include: {
        goal: {
          select: { id: true, title: true, color: true },
        },
        task: {
          select: { id: true, title: true },
        },
        habit: {
          select: { id: true, title: true, color: true },
        },
      },
      orderBy: { startTime: "desc" },
      take: limit ? parseInt(limit) : 50,
    });

    res.json(timeEntries);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get single time entry
// @route   GET /api/time-entries/:id
const getTimeEntry = async (req, res) => {
  try {
    const timeEntry = await prisma.timeEntry.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
      include: {
        goal: true,
        task: true,
        habit: true,
      },
    });

    if (!timeEntry) {
      return res.status(404).json({ message: "Time entry not found" });
    }

    res.json(timeEntry);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Start timer
// @route   POST /api/time-entries/start
const startTimer = async (req, res) => {
  try {
    const { goalId, taskId, habitId, note } = req.body;

    // Check if there's already a running timer
    const runningTimer = await prisma.timeEntry.findFirst({
      where: {
        userId: req.user.id,
        status: "RUNNING",
      },
    });

    if (runningTimer) {
      return res.status(400).json({
        message: "A timer is already running",
        runningTimer,
      });
    }

    const timeEntry = await prisma.timeEntry.create({
      data: {
        userId: req.user.id,
        goalId: goalId || null,
        taskId: taskId || null,
        habitId: habitId || null,
        startTime: new Date(),
        status: "RUNNING",
        entryType: req.body.entryType || "TIMER",
        note,
      },
    });

    res.status(201).json(timeEntry);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Stop timer
// @route   PUT /api/time-entries/:id/stop
const stopTimer = async (req, res) => {
  try {
    const timeEntry = await prisma.timeEntry.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
        status: "RUNNING",
      },
    });

    if (!timeEntry) {
      return res.status(404).json({ message: "No running timer found" });
    }

    const endTime = new Date();
    const duration = Math.floor((endTime - timeEntry.startTime) / 1000); // in seconds

    const updatedEntry = await prisma.timeEntry.update({
      where: { id: req.params.id },
      data: {
        endTime,
        duration,
        status: "COMPLETED",
      },
    });

    res.json(updatedEntry);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Pause timer
// @route   PUT /api/time-entries/:id/pause
const pauseTimer = async (req, res) => {
  try {
    const timeEntry = await prisma.timeEntry.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
        status: "RUNNING",
      },
    });

    if (!timeEntry) {
      return res.status(404).json({ message: "No running timer found" });
    }

    const updatedEntry = await prisma.timeEntry.update({
      where: { id: req.params.id },
      data: {
        status: "PAUSED",
        duration: Math.floor((new Date() - timeEntry.startTime) / 1000),
      },
    });

    res.json(updatedEntry);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Resume timer
// @route   PUT /api/time-entries/:id/resume
const resumeTimer = async (req, res) => {
  try {
    const timeEntry = await prisma.timeEntry.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
        status: "PAUSED",
      },
    });

    if (!timeEntry) {
      return res.status(404).json({ message: "No paused timer found" });
    }

    const updatedEntry = await prisma.timeEntry.update({
      where: { id: req.params.id },
      data: {
        status: "RUNNING",
        startTime: new Date(new Date() - (timeEntry.duration || 0) * 1000),
      },
    });

    res.json(updatedEntry);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Quick log time entry (manual)
// @route   POST /api/time-entries/quick-log
const quickLog = async (req, res) => {
  try {
    const { goalId, taskId, habitId, duration, startTime, note } = req.body;

    const start = startTime ? new Date(startTime) : new Date();
    const durationInSeconds = duration * 60; // Convert minutes to seconds
    const end = new Date(start.getTime() + durationInSeconds * 1000);

    const timeEntry = await prisma.timeEntry.create({
      data: {
        userId: req.user.id,
        goalId: goalId || null,
        taskId: taskId || null,
        habitId: habitId || null,
        startTime: start,
        endTime: end,
        duration: durationInSeconds,
        status: "COMPLETED",
        entryType: "MANUAL",
        note,
      },
    });

    res.status(201).json(timeEntry);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Delete time entry
// @route   DELETE /api/time-entries/:id
const deleteTimeEntry = async (req, res) => {
  try {
    const timeEntry = await prisma.timeEntry.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!timeEntry) {
      return res.status(404).json({ message: "Time entry not found" });
    }

    await prisma.timeEntry.delete({
      where: { id: req.params.id },
    });

    res.json({ message: "Time entry deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get running timer
// @route   GET /api/time-entries/running
const getRunningTimer = async (req, res) => {
  try {
    const runningTimer = await prisma.timeEntry.findFirst({
      where: {
        userId: req.user.id,
        status: "RUNNING",
      },
      include: {
        goal: { select: { id: true, title: true, color: true } },
        task: { select: { id: true, title: true } },
        habit: { select: { id: true, title: true, color: true } },
      },
    });

    res.json(runningTimer || null);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get time summary statistics
// @route   GET /api/time-entries/summary
const getTimeSummary = async (req, res) => {
  try {
    const { period } = req.query; // today, week, month
    const now = new Date();
    let startDate;

    switch (period) {
      case "week":
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case "month":
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      default: // today
        startDate = new Date(now.setHours(0, 0, 0, 0));
    }

    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        userId: req.user.id,
        startTime: { gte: startDate },
        status: "COMPLETED",
      },
      include: {
        goal: { select: { id: true, title: true, color: true } },
        habit: { select: { id: true, title: true, color: true } },
      },
    });

    // Group by goal
    const byGoal = {};
    const byHabit = {};
    let totalTime = 0;
    let unassigned = 0;

    timeEntries.forEach((entry) => {
      const duration = entry.duration || 0;
      totalTime += duration;

      if (entry.goal) {
        byGoal[entry.goal.id] = {
          title: entry.goal.title,
          color: entry.goal.color,
          totalDuration: (byGoal[entry.goal.id]?.totalDuration || 0) + duration,
        };
      } else if (entry.habit) {
        byHabit[entry.habit.id] = {
          title: entry.habit.title,
          color: entry.habit.color,
          totalDuration:
            (byHabit[entry.habit.id]?.totalDuration || 0) + duration,
        };
      } else {
        unassigned += duration;
      }
    });

    res.json({
      totalTime,
      unassigned,
      byGoal: Object.values(byGoal),
      byHabit: Object.values(byHabit),
      entryCount: timeEntries.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
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
};
