// backend/controllers/todayController.js
const prisma = require("../utils/prisma");

// ============================================================================
// RECURSIVE DESCENDANTS FETCHER
// ============================================================================
async function fetchDescendants(parentIds, selectFields) {
  if (!parentIds.length) return [];

  const children = await prisma.goal.findMany({
    where: {
      parentId: { in: parentIds },
      status: { in: ["ACTIVE", "OVERDUE"] },
    },
    select: {
      ...selectFields,
      tasks: {
        where: {
          status: { in: ["TODO", "IN_PROGRESS", "OVERDUE", "COMPLETED"] },
        },
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
    },
    orderBy: [{ sortOrder: "asc" }],
  });

  if (!children.length) return [];

  // Recursively fetch deeper children
  const childIds = children.map((c) => c.id);
  const deeper = await fetchDescendants(childIds, selectFields);

  // Attach deeper children to their immediate parents
  return children.map((child) => ({
    ...child,
    children: deeper.filter((d) => d.parentId === child.id),
  }));
}

async function fetchGoalTree(parentIds, selectFields) {
  if (!parentIds.length) return [];

  const children = await prisma.goal.findMany({
    where: {
      parentId: { in: parentIds },
      status: { in: ["ACTIVE", "OVERDUE"] },
    },
    select: {
      ...selectFields,
      parentId: true,
      tasks: {
        where: {
          status: { in: ["TODO", "IN_PROGRESS", "OVERDUE", "COMPLETED"] },
        },
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
    },
    orderBy: [{ sortOrder: "asc" }],
  });

  if (!children.length) return [];

  // Get IDs of these children to fetch their children
  const childIds = children.map((c) => c.id);

  // Recursively fetch the next level
  const grandchildren = await fetchGoalTree(childIds, selectFields);

  // Attach grandchildren to their parents
  return children.map((child) => ({
    ...child,
    children: grandchildren.filter((gc) => gc.parentId === child.id),
  }));
}

// ============================================================================
// BUILD TREE FROM FLAT LIST
// ============================================================================
function buildTree(goals, descendants) {
  return goals.map((goal) => ({
    ...goal,
    children: buildTree(
      descendants.filter((d) => d.parentId === goal.id),
      descendants,
    ),
  }));
}

// ============================================================================
// MAIN CONTROLLER
// ============================================================================
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
    const dayOfWeek = todayStart.getUTCDay();

    // ========================================================================
    // GOAL SELECT FIELDS (shared between root and descendants)
    // ========================================================================
    const goalSelectFields = {
      id: true,
      parentId: true,
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
    };

    // ========================================================================
    // GOALS: Fetch root goals + all descendants recursively
    // ========================================================================
    const rootGoals = await prisma.goal.findMany({
      where: {
        userId,
        status: { in: ["ACTIVE", "OVERDUE"] },
        parentId: null,
      },
      select: {
        ...goalSelectFields,
        parentId: true,
        tasks: {
          where: {
            status: { in: ["TODO", "IN_PROGRESS", "OVERDUE", "COMPLETED"] },
          },
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
          select: { id: true, duration: true, status: true },
        },
      },
      orderBy: [{ status: "asc" }, { priority: "asc" }, { sortOrder: "asc" }],
    });

    // Fetch all descendants recursively
    const rootIds = rootGoals.map((g) => g.id);
    const allDescendants = await fetchGoalTree(rootIds, goalSelectFields);

    // Attach descendants to root goals
    const goals = rootGoals.map((root) => ({
      ...root,
      children: allDescendants.filter((d) => d.parentId === root.id),
    }));

    // ========================================================================
    // HABITS: Select only needed fields
    // ========================================================================
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
    // backend/controllers/todayController.js

    // ========================================================================
    // TASKS: Select only needed fields
    // ========================================================================
    const tasks = await prisma.task.findMany({
      where: {
        userId,
        dueDate: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
      select: {
        // All task fields (matching the format you want)
        id: true,
        userId: true,
        goalId: true,
        color: true,
        title: true,
        description: true,
        priority: true,
        targetValue: true,
        currentValue: true,
        unit: true,
        dueDate: true,
        estimatedMinutes: true,
        gracePeriodHours: true,
        autoFail: true,
        status: true,
        autoFailDays: true,
        completedAt: true,
        failedAt: true,
        failureReason: true,
        sortOrder: true,
        isRecurring: true,
        recurringRule: true,
        createdAt: true,
        updatedAt: true,
        // Include goal reference
        goal: {
          select: {
            id: true,
            title: true,
            color: true,
          },
        },
      },
      orderBy: [{ status: "asc" }, { priority: "asc" }, { dueDate: "asc" }],
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

    // ========================================================================
    // ENRICH DATA
    // ========================================================================
    const enrichedGoals = goals.map(enrichGoal);
    const enrichedHabits = allActiveHabits.map(enrichHabit);
    const enrichedTasks = tasks.map(enrichTask);

    // ========================================================================
    // RESPONSE
    // ========================================================================
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

// ============================================================================
// ENRICHMENT FUNCTIONS
// ============================================================================

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

  // Recursively enrich children
  const enrichedChildren = (goal.children || []).map(enrichGoal);

  return {
    ...goal,
    children: enrichedChildren,
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
