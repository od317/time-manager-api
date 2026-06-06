// backend/controllers/todayController.js
const prisma = require("../utils/prisma");

const getTodayDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const tomorrow = new Date(todayStart.getTime() + 86400000);
    const weekLater = new Date(todayStart.getTime() + 7 * 86400000);

    // ========================================================================
    // GOALS: Active + Overdue (with children and tasks)
    // ========================================================================
    const goals = await prisma.goal.findMany({
      where: {
        userId,
        status: { in: ["ACTIVE", "OVERDUE"] },
        parentId: null, // Only top-level goals to avoid duplication
      },
      include: {
        children: {
          where: { status: { in: ["ACTIVE", "OVERDUE"] } },
          include: {
            tasks: {
              where: {
                status: { in: ["TODO", "IN_PROGRESS", "OVERDUE"] },
              },
              orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
            },
            children: {
              where: { status: { in: ["ACTIVE", "OVERDUE"] } },
            },
          },
          orderBy: [{ sortOrder: "asc" }],
        },
        tasks: {
          where: {
            status: { in: ["TODO", "IN_PROGRESS", "OVERDUE"] },
          },
          orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
        },
        timeEntries: {
          where: {
            startTime: { gte: todayStart },
          },
        },
      },
      orderBy: [
        { status: "asc" }, // OVERDUE first
        { priority: "asc" }, // HIGH priority first
        { sortOrder: "asc" },
      ],
    });

    // Enrich goals with progress data
    const enrichedGoals = goals.map((goal) => {
      let totalTime = (goal.timeEntries || []).reduce(
        (sum, e) => sum + (e.duration || 0),
        0,
      );

      let combinedProgress = goal.progress || 0;
      if (goal.goalType === "time" && goal.targetValue) {
        const trackedInUnit =
          goal.unit === "minutes" ? totalTime / 60 : totalTime / 3600;
        combinedProgress = Math.min(
          (trackedInUnit / goal.targetValue) * 100,
          100,
        );
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
    });

    // ========================================================================
    // HABITS: Active, filtered to today's schedule
    // ========================================================================
    const dayOfWeek = todayStart.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

    const allActiveHabits = await prisma.habit.findMany({
      where: {
        userId,
        status: "ACTIVE",
        OR: [
          { frequencyType: "DAILY" },
          {
            frequencyType: "WEEKLY",
            frequencyDays: { has: dayOfWeek },
          },
          {
            frequencyType: "CUSTOM",
            frequencyDays: { has: dayOfWeek },
          },
        ],
      },
      include: {
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
      orderBy: [
        { lastCompletedAt: { sort: "asc", nulls: "first" } }, // Uncompleted first
        { sortOrder: "asc" },
      ],
    });

    // Enrich habits with today's completion status
    const enrichedHabits = allActiveHabits.map((habit) => {
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
        isOverdue: !isCompleted && habit.timesPerDay > 0,
      };
    });

    // ========================================================================
    // RUNNING TIMER
    // ========================================================================
    const runningTimer = await prisma.timeEntry.findFirst({
      where: {
        userId,
        status: { in: ["RUNNING", "PAUSED"] },
      },
      include: {
        goal: { select: { id: true, title: true, color: true } },
        task: { select: { id: true, title: true } },
        habit: { select: { id: true, title: true } },
      },
    });

    // Calculate elapsed time for running timer
    if (runningTimer && runningTimer.status === "RUNNING") {
      runningTimer.elapsedSeconds = Math.floor(
        (now - new Date(runningTimer.startTime)) / 1000,
      );
    }

    // ========================================================================
    // TASKS: Urgent + due today + completed today
    // ========================================================================
    const tasks = await prisma.task.findMany({
      where: {
        userId,
        OR: [
          // Due today or earlier (not completed/failed)
          {
            status: { in: ["TODO", "IN_PROGRESS", "OVERDUE"] },
            dueDate: { lt: tomorrow },
          },
          // Completed today
          {
            status: "COMPLETED",
            completedAt: { gte: todayStart, lt: todayEnd },
          },
        ],
      },
      include: {
        goal: { select: { id: true, title: true, color: true } },
      },
      orderBy: [
        { status: "asc" }, // OVERDUE first
        { priority: "asc" }, // HIGH priority first
        { dueDate: "asc" }, // Closest deadline first
      ],
    });

    // Enrich tasks
    const enrichedTasks = tasks.map((task) => {
      let daysOverdue = null;
      if (
        (task.status === "OVERDUE" ||
          (["TODO", "IN_PROGRESS"].includes(task.status) &&
            task.dueDate &&
            task.dueDate < now)) &&
        task.dueDate
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
          new Date(task.dueDate).toDateString() === todayStart.toDateString(),
      };
    });

    // ========================================================================
    // STATS
    // ========================================================================
    const [
      activeGoalsCount,
      overdueGoalsCount,
      totalGoalsCount,
      habitsDueCount,
      activeTasksCount,
    ] = await Promise.all([
      prisma.goal.count({
        where: { userId, status: "ACTIVE" },
      }),
      prisma.goal.count({
        where: { userId, status: "OVERDUE" },
      }),
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

    const stats = {
      activeGoals: activeGoalsCount,
      overdueGoals: overdueGoalsCount,
      totalGoals: totalGoalsCount,
      habitsDue: habitsDueCount,
      activeTasks: activeTasksCount,
      completedToday: tasks.filter((t) => t.status === "COMPLETED").length,
      habitsCompletedToday: enrichedHabits.filter((h) => h.isCompleted).length,
    };

    // ========================================================================
    // RESPONSE
    // ========================================================================
    res.json({
      date: todayStart.toISOString().split("T")[0],
      goals: enrichedGoals,
      habits: enrichedHabits,
      runningTimer,
      tasks: enrichedTasks,
      stats,
    });
  } catch (error) {
    console.error("Today dashboard error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getTodayDashboard };
