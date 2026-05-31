const prisma = require("../utils/prisma");

// @desc    Get all habits for user
// @route   GET /api/habits
const getHabits = async (req, res) => {
  try {
    const { status, frequencyType } = req.query;

    const where = { userId: req.user.id };
    if (status) where.status = status;
    if (frequencyType) where.frequencyType = frequencyType;

    const habits = await prisma.habit.findMany({
      where,
      include: {
        _count: { select: { logs: true } },
        logs: {
          orderBy: { date: "desc" },
          take: 30, // Last 30 days for history
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    res.json(habits);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
// @desc    Get single habit with logs
// @route   GET /api/habits/:id
const getHabit = async (req, res) => {
  try {
    const habit = await prisma.habit.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
      include: {
        logs: {
          orderBy: { date: "desc" },
          take: 30, // Last 30 days
        },
        timeEntries: {
          orderBy: { startTime: "desc" },
          take: 10,
        },
      },
    });

    if (!habit) {
      return res.status(404).json({ message: "Habit not found" });
    }

    res.json(habit);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Create habit
// @route   POST /api/habits
const createHabit = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      tags,
      frequencyType,
      frequencyDays,
      timesPerDay,
      targetTimeWindows,
      targetValue,
      unit,
      trackAmount,
      allowRollover,
      maxRolloverDays,
      color,
      icon,
    } = req.body;

    const habit = await prisma.habit.create({
      data: {
        userId: req.user.id,
        title,
        description,
        category,
        tags: tags || [],
        frequencyType: frequencyType || "DAILY",
        frequencyDays: frequencyDays || [],
        timesPerDay: timesPerDay || 1,
        targetTimeWindows: targetTimeWindows
          ? JSON.stringify(targetTimeWindows)
          : null,
        targetValue,
        unit,
        trackAmount: trackAmount || false,
        allowRollover: allowRollover !== undefined ? allowRollover : true,
        maxRolloverDays: maxRolloverDays || 2,
        color,
        icon,
      },
    });

    res.status(201).json(habit);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Update habit
// @route   PUT /api/habits/:id
const updateHabit = async (req, res) => {
  try {
    const existingHabit = await prisma.habit.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!existingHabit) {
      return res.status(404).json({ message: "Habit not found" });
    }

    const {
      title,
      description,
      category,
      tags,
      frequencyType,
      frequencyDays,
      timesPerDay,
      targetTimeWindows,
      targetValue,
      unit,
      trackAmount,
      status,
      allowRollover,
      maxRolloverDays,
      color,
      icon,
      sortOrder,
    } = req.body;

    const habit = await prisma.habit.update({
      where: { id: req.params.id },
      data: {
        title,
        description,
        category,
        tags,
        frequencyType,
        frequencyDays,
        timesPerDay,
        targetTimeWindows: targetTimeWindows
          ? JSON.stringify(targetTimeWindows)
          : undefined,
        targetValue,
        unit,
        trackAmount,
        status,
        allowRollover,
        maxRolloverDays,
        color,
        icon,
        sortOrder,
        pausedAt: status === "PAUSED" ? new Date() : null,
      },
    });

    res.json(habit);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Delete habit
// @route   DELETE /api/habits/:id
const deleteHabit = async (req, res) => {
  try {
    const habit = await prisma.habit.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!habit) {
      return res.status(404).json({ message: "Habit not found" });
    }

    await prisma.habit.delete({
      where: { id: req.params.id },
    });

    res.json({ message: "Habit deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Log habit completion
// @route   POST /api/habits/:id/log
const logHabit = async (req, res) => {
  try {
    const { date, value, note } = req.body;
    const habitId = req.params.id;

    const habit = await prisma.habit.findFirst({
      where: { id: habitId, userId: req.user.id },
    });

    if (!habit) {
      return res.status(404).json({ message: "Habit not found" });
    }

    // Use the date from the frontend, or default to today (server date, but frontend will interpret correctly)
    let logDate;
    if (date) {
      logDate = new Date(date);
    } else {
      // Just use today's date - frontend will handle timezone display
      const now = new Date();
      logDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    const existingLog = await prisma.habitLog.findUnique({
      where: {
        habitId_date: { habitId, date: logDate },
      },
    });

    if (existingLog) {
      const updatedLog = await prisma.habitLog.update({
        where: { id: existingLog.id },
        data: {
          value: value || existingLog.value,
          note: note || existingLog.note,
          completedAt: new Date(),
        },
      });
      return res.json(updatedLog);
    }

    const log = await prisma.habitLog.create({
      data: {
        habitId,
        date: logDate,
        value,
        unit: habit.unit,
        note,
        status: "COMPLETED",
      },
    });

    await updateHabitStats(habitId);
    res.status(201).json(log);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Skip habit for today
// @route   POST /api/habits/:id/skip
const skipHabit = async (req, res) => {
  try {
    const habitId = req.params.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const log = await prisma.habitLog.create({
      data: {
        habitId,
        date: today,
        status: "SKIPPED",
        note: req.body.note || "Skipped by user",
      },
    });

    // Reset streak
    await prisma.habit.update({
      where: { id: habitId },
      data: {
        currentStreak: 0,
        currentRollovers: 0,
      },
    });

    res.json(log);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get habit heatmap data (like GitHub)
// @route   GET /api/habits/:id/heatmap
const getHabitHeatmap = async (req, res) => {
  try {
    const { year } = req.query;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    const startDate = new Date(targetYear, 0, 1);
    const endDate = new Date(targetYear, 11, 31);

    const logs = await prisma.habitLog.findMany({
      where: {
        habitId: req.params.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        date: true,
        status: true,
        value: true,
      },
    });

    res.json(logs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get habit statistics
// @route   GET /api/habits/:id/stats
const getHabitStats = async (req, res) => {
  try {
    const habit = await prisma.habit.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        logs: {
          where: { status: "COMPLETED" },
          orderBy: { date: "desc" },
        },
      },
    });

    if (!habit) {
      return res.status(404).json({ message: "Habit not found" });
    }

    const totalLogs = habit.logs.length;
    const today = new Date();
    const thirtyDaysAgo = new Date(today - 30 * 24 * 60 * 60 * 1000);
    const last30DaysLogs = habit.logs.filter((l) => l.date >= thirtyDaysAgo);

    res.json({
      currentStreak: habit.currentStreak,
      longestStreak: habit.longestStreak,
      totalCompletions: habit.totalCompletions,
      completionRate30Days: (last30DaysLogs.length / 30) * 100,
      averageValue:
        totalLogs > 0
          ? habit.logs.reduce((sum, l) => sum + (l.value || 0), 0) / totalLogs
          : 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Helper function to update habit streaks and stats
async function updateHabitStats(habitId) {
  const logs = await prisma.habitLog.findMany({
    where: { habitId, status: "COMPLETED" },
    orderBy: { date: "desc" },
  });

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < logs.length; i++) {
    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - i);
    expectedDate.setHours(0, 0, 0, 0);

    const logDate = new Date(logs[i].date);
    logDate.setHours(0, 0, 0, 0);

    if (logDate.getTime() === expectedDate.getTime()) {
      streak++;
    } else {
      break;
    }
  }

  await prisma.habit.update({
    where: { id: habitId },
    data: {
      currentStreak: streak,
      longestStreak: {
        set: Math.max(
          streak,
          (
            await prisma.habit.findUnique({
              where: { id: habitId },
              select: { longestStreak: true },
            })
          ).longestStreak,
        ),
      },
      totalCompletions: logs.length,
      lastCompletedAt: new Date(),
      lastEvaluatedAt: new Date(),
    },
  });
}

module.exports = {
  getHabits,
  getHabit,
  createHabit,
  updateHabit,
  deleteHabit,
  logHabit,
  skipHabit,
  getHabitHeatmap,
  getHabitStats,
};
