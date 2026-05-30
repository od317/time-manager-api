const prisma = require("../utils/prisma");

// @desc    Get all habits for user
// @route   GET /api/habits
const getHabits = async (req, res) => {
  try {
    const { status, frequencyType } = req.query;

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { timezone: true },
    });
    const userTimezone = user?.timezone || "UTC";

    // Calculate today in user's timezone correctly
    const now = new Date();
    const userDateStr = now.toLocaleString("en-US", {
      timeZone: userTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    // userDateStr is "05/29/2026" (MM/DD/YYYY)
    const [month, day, year] = userDateStr.split("/");
    // Create date at midnight UTC for the user's local date
    const todayStart = new Date(
      Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0),
    );
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const where = {
      userId: req.user.id,
    };

    if (status) where.status = status;
    if (frequencyType) where.frequencyType = frequencyType;

    const habits = await prisma.habit.findMany({
      where,
      include: {
        _count: {
          select: { logs: true },
        },
        logs: {
          where: {
            date: {
              gte: todayStart,
              lt: todayEnd,
            },
          },
          take: 1,
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    // Mark habits that are due today based on frequency
    const today = parseInt(day);
    const dayOfWeek = new Date(todayStart).getUTCDay();

    const enrichedHabits = habits.map((habit) => {
      const isDue =
        habit.frequencyType === "DAILY" ||
        (habit.frequencyType === "WEEKLY" &&
          habit.frequencyDays.includes(dayOfWeek));

      return {
        ...habit,
        isDueToday: isDue,
      };
    });

    res.json(enrichedHabits);
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

    // Get user's timezone
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { timezone: true },
    });
    const userTimezone = user?.timezone || "UTC";

    // Get current date and day of week in user's timezone
    const now = new Date();
    const options = {
      timeZone: userTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    };
    const formatter = new Intl.DateTimeFormat("en-US", options);
    const parts = formatter.formatToParts(now);

    const dayPart = parts.find((p) => p.type === "weekday")?.value; // "Mon", "Tue", etc.
    const monthPart = parts.find((p) => p.type === "month")?.value;
    const dayNumPart = parts.find((p) => p.type === "day")?.value;
    const yearPart = parts.find((p) => p.type === "year")?.value;

    // Check if habit is due today
    const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const today = dayMap[dayPart] ?? 0;

    const isDueToday =
      habit.frequencyType === "DAILY" ||
      (habit.frequencyType === "WEEKLY" && habit.frequencyDays.includes(today));

    if (!isDueToday) {
      return res.status(400).json({
        message: `This habit is not scheduled for today (${dayPart}). It runs on ${habit.frequencyType === "DAILY" ? "every day" : habit.frequencyDays.map((d) => Object.keys(dayMap)[d]).join(", ")}.`,
      });
    }

    // Calculate today's date in user's timezone
    let logDate;
    if (date) {
      logDate = new Date(date);
      logDate.setHours(0, 0, 0, 0);
    } else {
      const dateStr = `${yearPart}-${monthPart.padStart(2, "0")}-${dayNumPart.padStart(2, "0")}`;
      logDate = new Date(dateStr + "T00:00:00.000Z");
    }

    // Check if already logged for this date
    const existingLog = await prisma.habitLog.findUnique({
      where: {
        habitId_date: {
          habitId,
          date: logDate,
        },
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
