const prisma = require("../utils/prisma");

/**
 * Check and auto-fail overdue goals for a user.
 * Should be called on login and periodically.
 */
async function checkOverdueGoals(userId) {
  const now = new Date();

  // Find active goals with deadlines that have passed
  const overdueGoals = await prisma.goal.findMany({
    where: {
      userId,
      status: "ACTIVE",
      autoFail: true,
      endDate: {
        not: null,
        lt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 24h grace period
      },
    },
  });

  let failedCount = 0;

  for (const goal of overdueGoals) {
    await prisma.goal.update({
      where: { id: goal.id },
      data: {
        status: "FAILED",
        failedAt: now,
        failureReason: "Deadline passed",
      },
    });
    failedCount++;
  }

  // Also check tasks with due dates
  const overdueTasks = await prisma.task.findMany({
    where: {
      userId,
      status: { in: ["TODO", "IN_PROGRESS"] },
      autoFail: true,
      dueDate: {
        not: null,
        lt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    },
  });

  for (const task of overdueTasks) {
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "FAILED",
        failedAt: now,
        failureReason: "Due date passed",
      },
    });
    failedCount++;
  }

  return { goalsFailed: overdueGoals.length, tasksFailed: overdueTasks.length };
}

module.exports = { checkOverdueGoals };
