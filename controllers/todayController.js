// backend/controllers/todayController.js
const prisma = require("../utils/prisma");

const getTodayDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const { date } = req.query;
    const todayStr = date || new Date().toISOString().split("T")[0];

    const todayStart = new Date(todayStr + "T00:00:00.000Z");
    const todayEnd = new Date(todayStr + "T00:00:00.000Z");
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

    const tomorrow = new Date(todayEnd);

    // ========================================================================
    // GOALS: Select only needed fields
    // ========================================================================
    const goals = await prisma.goal.findMany({
      where: {
        userId,
        status: { in: ["ACTIVE", "OVERDUE"] },
        parentId: null,
      },
      select: {
        id: true,
        title: true,
        description: true,
        goalType: true,
        status: true,
        priority: true,
        targetValue: true,
        currentValue: true,
        unit: true,
        progress: true,
        endDate: true,
        deadlineType: true,
        color: true,
        icon: true,
        sortOrder: true,
        isRecurring: true,
        recurringRule: true,
        lastActivityAt: true,
        // Nested selects
        children: {
          where: { status: { in: ["ACTIVE", "OVERDUE"] } },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            targetValue: true,
            currentValue: true,
            progress: true,
            endDate: true,
            color: true,
            icon: true,
            sortOrder: true,
            tasks: {
              where: { status: { in: ["TODO", "IN_PROGRESS", "OVERDUE"] } },
              select: {
                id: true,
                title: true,
                status: true,
                priority: true,
                dueDate: true,
                estimatedMinutes: true,
                targetValue: true,
                currentValue: true,
              },
              orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
            },
          },
          orderBy: [{ sortOrder: "asc" }],
        },
        tasks: {
          where: { status: { in: ["TODO", "IN_PROGRESS", "OVERDUE"] } },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            estimatedMinutes: true,
            targetValue: true,
            currentValue: true,
            color: true,
          },
          orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
        },
        timeEntries: {
          where: { startTime: { gte: todayStart } },
          select: {
            id: true,
            duration: true,
            status: true,
          },
        },
      },
      orderBy: [{ status: "asc" }, { priority: "asc" }, { sortOrder: "asc" }],
    });

    // ========================================================================
    // HABITS: Select only needed fields
    // ========================================================================
    const dayOfWeek = todayStart.getUTCDay();

    const allActiveHabits = await prisma.habit.findMany({
      where: {
        userId,
        status: "ACTIVE",
        OR: [
          { frequencyType: "DAILY" },
          { frequencyType: "WEEKLY", frequencyDays: { has: dayOfWeek } },
          { frequencyType: "CUSTOM", frequencyDays: { has: dayOfWeek } },
        ],
      },
      select: {
        id: true,
        title: true,
        description: true,
        frequencyType: true,
        frequencyDays: true,
        timesPerDay: true,
        trackAmount: true,
        targetValue: true,
        unit: true,
        currentStreak: true,
        longestStreak: true,
        allowRollover: true,
        maxRolloverDays: true,
        currentRollovers: true,
        color: true,
        icon: true,
        sortOrder: true,
        lastCompletedAt: true,
        logs: {
          where: {
            date: { gte: todayStart, lt: todayEnd },
          },
          select: {
            id: true,
            status: true,
            value: true,
            completedAt: true,
          },
          take: 1,
        },
      },
      orderBy: [
        { lastCompletedAt: { sort: "asc", nulls: "first" } },
        { sortOrder: "asc" },
      ],
    });

    // ========================================================================
    // RUNNING TIMER: Minimal fields
    // ========================================================================
    const runningTimer = await prisma.timeEntry.findFirst({
      where: {
        userId,
        status: { in: ["RUNNING", "PAUSED"] },
      },
      select: {
        id: true,
        startTime: true,
        status: true,
        entryType: true,
        note: true,
        goal: { select: { id: true, title: true, color: true } },
        task: { select: { id: true, title: true } },
        habit: { select: { id: true, title: true } },
      },
    });

    if (runningTimer && runningTimer.status === "RUNNING") {
      runningTimer.elapsedSeconds = Math.floor(
        (now - new Date(runningTimer.startTime)) / 1000,
      );
    }

    // ========================================================================
    // TASKS: Select only needed fields
    // ========================================================================
    const tasks = await prisma.task.findMany({
      where: {
        userId,
        OR: [
          {
            status: { in: ["TODO", "IN_PROGRESS", "OVERDUE"] },
            dueDate: { lt: tomorrow },
          },
          {
            status: "COMPLETED",
            completedAt: { gte: todayStart, lt: todayEnd },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        estimatedMinutes: true,
        targetValue: true,
        currentValue: true,
        completedAt: true,
        color: true,
        goal: { select: { id: true, title: true, color: true } },
      },
      orderBy: [{ status: "asc" }, { priority: "asc" }, { dueDate: "asc" }],
    });

    // ========================================================================
    // STATS: Use count with where only (no select needed)
    // ========================================================================
    const [
      activeGoalsCount,
      overdueGoalsCount,
      totalGoalsCount,
      habitsDueCount,
      activeTasksCount,
    ] = await Promise.all([
      prisma.goal.count({ where: { userId, status: "ACTIVE" } }),
      prisma.goal.count({ where: { userId, status: "OVERDUE" } }),
      prisma.goal.count({
        where: { userId, status: { in: ["ACTIVE", "OVERDUE"] } },
      }),
      prisma.habit.count({
        where: {
          userId,
          status: "ACTIVE",
          OR: [
            { frequencyType: "DAILY" },
            { frequencyType: "WEEKLY", frequencyDays: { has: dayOfWeek } },
            { frequencyType: "CUSTOM", frequencyDays: { has: dayOfWeek } },
          ],
        },
      }),
      prisma.task.count({
        where: {
          userId,
          status: { in: ["TODO", "IN_PROGRESS", "OVERDUE"] },
          dueDate: { lt: tomorrow },
        },
      }),
    ]);

    // Enrichment functions (same as before, just with fewer fields)
    const enrichedGoals = goals.map(enrichGoal);
    const enrichedHabits = allActiveHabits.map(enrichHabit);
    const enrichedTasks = tasks.map(enrichTask);

    res.json({
      date: todayStr,
      goals: enrichedGoals,
      habits: enrichedHabits,
      runningTimer,
      tasks: enrichedTasks,
      stats: {
        activeGoals: activeGoalsCount,
        overdueGoals: overdueGoalsCount,
        totalGoals: totalGoalsCount,
        habitsDue: habitsDueCount,
        activeTasks: activeTasksCount,
        completedToday: tasks.filter((t) => t.status === "COMPLETED").length,
        habitsCompletedToday: enrichedHabits.filter((h) => h.isCompleted)
          .length,
      },
    });
  } catch (error) {
    console.error("Today dashboard error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Lightweight enrichment functions
function enrichGoal(goal) {
  const now = new Date();
  let totalTime = (goal.timeEntries || []).reduce(
    (sum, e) => sum + (e.duration || 0),
    0,
  );
  let combinedProgress = goal.progress || 0;

  if (goal.goalType === "time" && goal.targetValue) {
    const trackedInUnit =
      goal.unit === "minutes" ? totalTime / 60 : totalTime / 3600;
    combinedProgress = Math.min((trackedInUnit / goal.targetValue) * 100, 100);
  }

  let daysOverdue = null;
  if (goal.status === "OVERDUE" && goal.endDate) {
    daysOverdue = Math.floor(
      (now - new Date(goal.endDate)) / (1000 * 60 * 60 * 24),
    );
  }

  return {
    ...goal,
    combinedProgress: Math.max(goal.progress, combinedProgress),
    daysOverdue,
    deadlineUrgent:
      goal.endDate &&
      goal.status === "ACTIVE" &&
      (new Date(goal.endDate) - now) / (1000 * 60 * 60) < 48,
  };
}

function enrichHabit(habit) {
  const todayLog = habit.logs[0] || null;
  const isCompleted = todayLog?.status === "COMPLETED";
  const completionCount = todayLog?.value || 0;
  const remaining = habit.timesPerDay - completionCount;

  return {
    ...habit,
    todayLog,
    todayStatus: isCompleted
      ? "COMPLETED"
      : completionCount > 0
        ? "PARTIAL"
        : "PENDING",
    completionCount,
    remaining: Math.max(0, remaining),
    isCompleted,
  };
}

function enrichTask(task) {
  const now = new Date();
  let daysOverdue = null;

  if (
    (task.status === "OVERDUE" ||
      ["TODO", "IN_PROGRESS"].includes(task.status)) &&
    task.dueDate &&
    task.dueDate < now
  ) {
    daysOverdue = Math.floor(
      (now - new Date(task.dueDate)) / (1000 * 60 * 60 * 24),
    );
  }

  return {
    ...task,
    daysOverdue,
    isDueToday:
      task.dueDate &&
      new Date(task.dueDate).toDateString() === new Date().toDateString(),
  };
}

module.exports = { getTodayDashboard };
