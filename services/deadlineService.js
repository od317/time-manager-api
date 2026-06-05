// backend/services/deadlineService.js
const prisma = require("../utils/prisma");

/**
 * Check and update overdue goals/tasks for a user.
 *
 * Status flow:
 * ACTIVE → OVERDUE (past end/due date)
 * OVERDUE → COMPLETED (when user finishes)
 * OVERDUE → FAILED (after autoFailDays, default 30)
 */
async function checkOverdueGoals(userId) {
  const now = new Date();

  // Skip for test/seed users or development
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  const isTestUser = user?.email?.match(/test|seed|dev/i);
  if (isTestUser || process.env.NODE_ENV === "development") {
    console.log("⏭️ Skipping auto-fail for test/development");
    return {
      goalsMarkedOverdue: 0,
      goalsFailed: 0,
      tasksMarkedOverdue: 0,
      tasksFailed: 0,
      skipped: true,
    };
  }

  // ============================================================================
  // GOALS: Mark ACTIVE goals as OVERDUE if past end date
  // ============================================================================

  const activeOverdueGoals = await prisma.goal.findMany({
    where: {
      userId,
      status: "ACTIVE",
      endDate: {
        not: null,
        lt: now, // Past end date
      },
    },
  });

  let goalsMarkedOverdue = 0;
  for (const goal of activeOverdueGoals) {
    await prisma.goal.update({
      where: { id: goal.id },
      data: {
        status: "OVERDUE",
        lastActivityAt: now,
      },
    });
    goalsMarkedOverdue++;
  }

  // ============================================================================
  // GOALS: Fail OVERDUE goals that are past the auto-fail period
  // ============================================================================

  const goalsToFail = await prisma.goal.findMany({
    where: {
      userId,
      status: "OVERDUE",
      endDate: {
        not: null,
        lt: new Date(now - 30 * 24 * 60 * 60 * 1000), // 30 days past end date
      },
    },
  });

  let goalsFailed = 0;
  for (const goal of goalsToFail) {
    const daysOverdue = Math.floor(
      (now - goal.endDate) / (24 * 60 * 60 * 1000),
    );
    await prisma.goal.update({
      where: { id: goal.id },
      data: {
        status: "FAILED",
        failedAt: now,
        failureReason: `Overdue for ${daysOverdue} days (auto-failed after 30 days)`,
        lastActivityAt: now,
      },
    });
    goalsFailed++;
  }

  // ============================================================================
  // TASKS: Mark TODO/IN_PROGRESS tasks as OVERDUE if past due date
  // ============================================================================

  const activeOverdueTasks = await prisma.task.findMany({
    where: {
      userId,
      status: { in: ["TODO", "IN_PROGRESS"] },
      dueDate: {
        not: null,
        lt: now,
      },
    },
  });

  let tasksMarkedOverdue = 0;
  for (const task of activeOverdueTasks) {
    await prisma.task.update({
      where: { id: task.id },
      data: { status: "OVERDUE" },
    });
    tasksMarkedOverdue++;
  }

  // ============================================================================
  // TASKS: Fail OVERDUE tasks past the auto-fail period
  // ============================================================================

  const tasksToFail = await prisma.task.findMany({
    where: {
      userId,
      status: "OVERDUE",
      dueDate: {
        not: null,
        lt: new Date(now - 30 * 24 * 60 * 60 * 1000),
      },
    },
  });

  let tasksFailed = 0;
  for (const task of tasksToFail) {
    const daysOverdue = Math.floor(
      (now - task.dueDate) / (24 * 60 * 60 * 1000),
    );
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "FAILED",
        failedAt: now,
        failureReason: `Overdue for ${daysOverdue} days (auto-failed after 30 days)`,
      },
    });
    tasksFailed++;
  }

  // Log results
  if (goalsMarkedOverdue || goalsFailed || tasksMarkedOverdue || tasksFailed) {
    console.log(`📋 Deadline check for user ${userId}:`, {
      goalsMarkedOverdue,
      goalsFailed,
      tasksMarkedOverdue,
      tasksFailed,
    });
  }

  return {
    goalsMarkedOverdue,
    goalsFailed,
    tasksMarkedOverdue,
    tasksFailed,
  };
}

module.exports = { checkOverdueGoals };
