// backend/routes/seed.js
const express = require("express");
const router = express.Router();
const prisma = require("../utils/prisma");
const auth = require("../middleware/auth");

function utcMidnight(date) {
  const d = new Date(date);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

router.post("/all", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    await prisma.$transaction([
      prisma.taskCheckIn.deleteMany({ where: { task: { userId } } }),
      prisma.timeEntry.deleteMany({ where: { userId } }),
      prisma.habitLog.deleteMany({ where: { habit: { userId } } }),
      prisma.task.deleteMany({ where: { userId } }),
      prisma.habit.deleteMany({ where: { userId } }),
      prisma.goal.deleteMany({ where: { userId } }),
    ]);

    const now = new Date();
    const today = utcMidnight(now);
    const yesterday = utcMidnight(new Date(today.getTime() - 86400000));
    const tomorrow = utcMidnight(new Date(today.getTime() + 86400000));
    const dayAfterTomorrow = utcMidnight(new Date(today.getTime() + 172800000));
    const nextWeek = utcMidnight(new Date(today.getTime() + 7 * 86400000));
    const lastWeek = utcMidnight(new Date(today.getTime() - 7 * 86400000));
    const lastMonth = utcMidnight(new Date(today.getTime() - 30 * 86400000));
    const nextMonth = utcMidnight(new Date(today.getTime() + 30 * 86400000));
    const twoDaysAgo = utcMidnight(new Date(today.getTime() - 172800000));
    const threeDaysAgo = utcMidnight(new Date(today.getTime() - 259200000));
    const fourDaysAgo = utcMidnight(new Date(today.getTime() - 345600000));

    // ========================================================================
    // GOALS
    // ========================================================================
    const goal1 = await prisma.goal.create({
      data: {
        userId,
        title: "Running Distance Goal",
        description:
          "Active goal ending in future, quantity type, 50% progress",
        goalType: "quantity",
        status: "ACTIVE",
        priority: "HIGH",
        targetValue: 100,
        currentValue: 50,
        unit: "kilometers",
        startDate: lastWeek,
        endDate: nextMonth,
        deadlineType: "HARD",
        progress: 50,
        color: "#4CAF50",
        sortOrder: 1,
      },
    });
    const goal2 = await prisma.goal.create({
      data: {
        userId,
        title: "Read 12 Books",
        description: "Completed goal, ended yesterday, achieved target",
        goalType: "quantity",
        status: "COMPLETED",
        priority: "MEDIUM",
        targetValue: 12,
        currentValue: 12,
        unit: "books",
        startDate: lastMonth,
        endDate: yesterday,
        completedAt: yesterday,
        deadlineType: "HARD",
        progress: 100,
        color: "#2196F3",
        sortOrder: 2,
      },
    });
    const goal3 = await prisma.goal.create({
      data: {
        userId,
        title: "Gym Sessions",
        description: "Failed goal, past deadline, only 40% done",
        goalType: "quantity",
        status: "FAILED",
        priority: "HIGH",
        targetValue: 30,
        currentValue: 12,
        unit: "sessions",
        startDate: lastMonth,
        endDate: threeDaysAgo,
        failedAt: threeDaysAgo,
        failureReason: "Did not meet target by deadline",
        deadlineType: "HARD",
        autoFail: true,
        progress: 40,
        color: "#F44336",
        sortOrder: 3,
      },
    });
    const goal4 = await prisma.goal.create({
      data: {
        userId,
        title: "Journal This Week",
        description: "Active goal ending today, 70% complete",
        goalType: "quantity",
        status: "ACTIVE",
        priority: "HIGH",
        targetValue: 7,
        currentValue: 5,
        unit: "entries",
        startDate: lastWeek,
        endDate: today,
        deadlineType: "HARD",
        progress: 71,
        color: "#FF9800",
        sortOrder: 4,
      },
    });
    const goal5 = await prisma.goal.create({
      data: {
        userId,
        title: "Daily Meditation",
        description: "Ongoing goal with no end date, time-based",
        goalType: "time",
        status: "ACTIVE",
        priority: "LOW",
        targetValue: 600,
        currentValue: 120,
        unit: "minutes",
        startDate: lastMonth,
        endDate: null,
        deadlineType: "SOFT",
        progress: 20,
        color: "#9C27B0",
        sortOrder: 5,
      },
    });
    const goal6 = await prisma.goal.create({
      data: {
        userId,
        title: "Water Intake",
        description: "Overachieved! Completed but tracking continues",
        goalType: "quantity",
        status: "COMPLETED",
        priority: "MEDIUM",
        targetValue: 30,
        currentValue: 45,
        unit: "liters",
        startDate: lastMonth,
        endDate: yesterday,
        completedAt: twoDaysAgo,
        deadlineType: "SOFT",
        progress: 150,
        color: "#00BCD4",
        sortOrder: 6,
      },
    });
    const goal7 = await prisma.goal.create({
      data: {
        userId,
        title: "Learn Guitar",
        description: "Archived - lost interest",
        goalType: "project",
        status: "ARCHIVED",
        priority: "LOW",
        targetValue: 20,
        currentValue: 3,
        unit: "lessons",
        startDate: lastMonth,
        endDate: nextMonth,
        archivedAt: twoDaysAgo,
        deadlineType: "SOFT",
        progress: 15,
        color: "#795548",
        sortOrder: 7,
      },
    });
    const goal8 = await prisma.goal.create({
      data: {
        userId,
        title: "Paint Portfolio",
        description: "OVERDUE - Past deadline but can still complete",
        goalType: "project",
        status: "OVERDUE",
        priority: "MEDIUM",
        targetValue: 5,
        currentValue: 4,
        unit: "paintings",
        startDate: lastMonth,
        endDate: yesterday,
        progress: 80,
        color: "#FF9800",
        sortOrder: 8,
      },
    });
    const goal9 = await prisma.goal.create({
      data: {
        userId,
        title: "New Habit Building",
        description: "Just started, 0% progress, future deadline",
        goalType: "quantity",
        status: "ACTIVE",
        priority: "MEDIUM",
        targetValue: 21,
        currentValue: 0,
        unit: "days",
        startDate: today,
        endDate: nextMonth,
        deadlineType: "HARD",
        progress: 0,
        color: "#8BC34A",
        sortOrder: 9,
      },
    });
    const goal10 = await prisma.goal.create({
      data: {
        userId,
        title: "Weekly Workout Goal",
        description: "Recurring weekly fitness target",
        goalType: "quantity",
        status: "ACTIVE",
        priority: "HIGH",
        targetValue: 3,
        currentValue: 1,
        unit: "workouts",
        startDate: today,
        endDate: nextWeek,
        isRecurring: true,
        recurringRule: "WEEKLY",
        deadlineType: "SOFT",
        progress: 33,
        color: "#FF5722",
        sortOrder: 10,
      },
    });

    const goals = [
      goal1,
      goal2,
      goal3,
      goal4,
      goal5,
      goal6,
      goal7,
      goal8,
      goal9,
      goal10,
    ];

    const parentGoal = await prisma.goal.create({
      data: {
        userId,
        title: "Health & Fitness Master Goal",
        description: "Parent goal containing sub-goals",
        goalType: "project",
        status: "ACTIVE",
        priority: "HIGH",
        targetValue: 3,
        currentValue: 1,
        unit: "sub-goals completed",
        startDate: lastMonth,
        endDate: nextMonth,
        deadlineType: "SOFT",
        progress: 33,
        color: "#FFC107",
        sortOrder: 0,
      },
    });
    const childGoal1 = await prisma.goal.create({
      data: {
        userId,
        parentId: parentGoal.id,
        title: "Strength Training",
        description: "Child goal 1 of Health Master",
        goalType: "quantity",
        status: "ACTIVE",
        priority: "HIGH",
        targetValue: 20,
        currentValue: 8,
        unit: "sessions",
        startDate: lastMonth,
        endDate: nextMonth,
        progress: 40,
        color: "#FF9800",
        sortOrder: 1,
      },
    });
    const childGoal2 = await prisma.goal.create({
      data: {
        userId,
        parentId: parentGoal.id,
        title: "Nutrition Tracking",
        description: "Child goal 2 of Health Master",
        goalType: "quantity",
        status: "ACTIVE",
        priority: "MEDIUM",
        targetValue: 90,
        currentValue: 65,
        unit: "meals tracked",
        startDate: lastMonth,
        endDate: nextMonth,
        progress: 72,
        color: "#4CAF50",
        sortOrder: 2,
      },
    });
    await prisma.goal.create({
      data: {
        userId,
        parentId: childGoal1.id,
        title: "Deadlift Progress",
        description: "Nested 3 levels deep",
        goalType: "quantity",
        status: "ACTIVE",
        priority: "HIGH",
        targetValue: 100,
        currentValue: 75,
        unit: "kg",
        startDate: lastMonth,
        endDate: nextMonth,
        progress: 75,
        color: "#F44336",
        sortOrder: 1,
      },
    });

    // ========================================================================
    // TASKS
    // ========================================================================
    const tasks = await Promise.all([
      prisma.task.create({
        data: {
          userId,
          goalId: goal1.id,
          title: "Plan running routes",
          description: "Task for active goal, due tomorrow",
          status: "TODO",
          priority: "HIGH",
          dueDate: tomorrow,
          estimatedMinutes: 30,
          color: "#4CAF50",
          sortOrder: 1,
        },
      }),
      prisma.task.create({
        data: {
          userId,
          goalId: goal1.id,
          title: "Buy running shoes",
          description: "In progress, due today",
          status: "IN_PROGRESS",
          priority: "HIGH",
          currentValue: 0.5,
          targetValue: 1,
          dueDate: today,
          estimatedMinutes: 60,
          color: "#4CAF50",
          sortOrder: 2,
        },
      }),
      prisma.task.create({
        data: {
          userId,
          goalId: goal2.id,
          title: "Finish 'Atomic Habits'",
          description: "Completed yesterday",
          status: "COMPLETED",
          priority: "HIGH",
          completedAt: yesterday,
          dueDate: yesterday,
          estimatedMinutes: 480,
          targetValue: 1,
          currentValue: 1,
          color: "#2196F3",
          sortOrder: 3,
        },
      }),
      prisma.task.create({
        data: {
          userId,
          goalId: goal3.id,
          title: "Leg day workout",
          description: "Failed! Due 5 days ago",
          status: "FAILED",
          priority: "HIGH",
          dueDate: utcMidnight(new Date(today.getTime() - 5 * 86400000)),
          failedAt: utcMidnight(new Date(today.getTime() - 5 * 86400000)),
          failureReason: "Missed deadline",
          estimatedMinutes: 90,
          autoFail: true,
          targetValue: 1,
          currentValue: 0,
          color: "#F44336",
          sortOrder: 4,
        },
      }),
      prisma.task.create({
        data: {
          userId,
          goalId: goal4.id,
          title: "Evening journal entry",
          description: "Due yesterday, within grace period",
          status: "OVERDUE",
          priority: "HIGH",
          dueDate: yesterday,
          gracePeriodHours: 24,
          estimatedMinutes: 15,
          targetValue: 1,
          currentValue: 0,
          color: "#FF9800",
          sortOrder: 5,
        },
      }),
      prisma.task.create({
        data: {
          userId,
          goalId: goal5.id,
          title: "Morning meditation",
          description: "Recurring daily task",
          status: "TODO",
          priority: "MEDIUM",
          dueDate: today,
          isRecurring: true,
          recurringRule: "DAILY",
          estimatedMinutes: 10,
          targetValue: 1,
          currentValue: 0,
          color: "#9C27B0",
          sortOrder: 6,
        },
      }),
      prisma.task.create({
        data: {
          userId,
          title: "Call dentist",
          description: "Standalone task, no goal",
          status: "TODO",
          priority: "MEDIUM",
          dueDate: dayAfterTomorrow,
          estimatedMinutes: 10,
          targetValue: 1,
          currentValue: 0,
          color: "#607D8B",
          sortOrder: 7,
        },
      }),
      prisma.task.create({
        data: {
          userId,
          title: "Create workout playlist",
          description: "Low priority, no deadline",
          status: "TODO",
          priority: "LOW",
          dueDate: null,
          estimatedMinutes: 45,
          targetValue: 1,
          currentValue: 0,
          color: "#9E9E9E",
          sortOrder: 8,
        },
      }),
      prisma.task.create({
        data: {
          userId,
          goalId: goal1.id,
          title: "Stretch routine",
          description: "OVERDUE but grace period extended",
          status: "OVERDUE",
          priority: "MEDIUM",
          dueDate: yesterday,
          gracePeriodHours: 72,
          autoFail: false,
          estimatedMinutes: 20,
          targetValue: 1,
          currentValue: 0.3,
          color: "#FF9800",
          sortOrder: 9,
        },
      }),
      prisma.task.create({
        data: {
          userId,
          goalId: goal9.id,
          title: "Read 10 pages",
          description: "Task with numeric progress tracking",
          status: "IN_PROGRESS",
          priority: "MEDIUM",
          dueDate: today,
          estimatedMinutes: 20,
          targetValue: 10,
          currentValue: 4,
          unit: "pages",
          color: "#8BC34A",
          sortOrder: 10,
        },
      }),
    ]);

    await Promise.all([
      prisma.taskCheckIn.create({
        data: {
          taskId: tasks[9].id,
          value: 2,
          note: "Morning reading session",
          checkedAt: new Date(today.getTime() - 4 * 3600000),
        },
      }),
      prisma.taskCheckIn.create({
        data: {
          taskId: tasks[9].id,
          value: 2,
          note: "Afternoon reading",
          checkedAt: new Date(today.getTime() - 1 * 3600000),
        },
      }),
      prisma.taskCheckIn.create({
        data: {
          taskId: tasks[4].id,
          value: 0,
          note: "Started but got interrupted",
          checkedAt: yesterday,
        },
      }),
    ]);

    // ========================================================================
    // HABITS
    // ========================================================================
    const habits = await Promise.all([
      prisma.habit.create({
        data: {
          userId,
          title: "Drink 8 glasses of water",
          description: "Daily habit, 15-day streak, completed today",
          frequencyType: "DAILY",
          timesPerDay: 8,
          trackAmount: true,
          targetValue: 8,
          unit: "glasses",
          status: "ACTIVE",
          currentStreak: 15,
          longestStreak: 22,
          totalCompletions: 45,
          allowRollover: true,
          maxRolloverDays: 2,
          currentRollovers: 1,
          color: "#00BCD4",
          sortOrder: 1,
        },
      }),
      prisma.habit.create({
        data: {
          userId,
          title: "Morning run",
          description: "Daily habit, missed today - streak broken",
          frequencyType: "DAILY",
          timesPerDay: 1,
          status: "ACTIVE",
          currentStreak: 0,
          longestStreak: 30,
          totalCompletions: 60,
          allowRollover: true,
          maxRolloverDays: 1,
          currentRollovers: 0,
          lastCompletedAt: yesterday,
          color: "#FF9800",
          sortOrder: 2,
        },
      }),
      prisma.habit.create({
        data: {
          userId,
          title: "House cleaning",
          description: "Weekly habit, Mon/Wed/Sat",
          frequencyType: "WEEKLY",
          frequencyDays: [1, 3, 6],
          timesPerDay: 1,
          status: "ACTIVE",
          currentStreak: 8,
          longestStreak: 12,
          totalCompletions: 52,
          allowRollover: false,
          color: "#795548",
          sortOrder: 3,
        },
      }),
      prisma.habit.create({
        data: {
          userId,
          title: "Book club reading",
          description: "Weekly habit on Sundays, missed",
          frequencyType: "WEEKLY",
          frequencyDays: [0],
          timesPerDay: 1,
          status: "ACTIVE",
          currentStreak: 0,
          longestStreak: 5,
          totalCompletions: 15,
          allowRollover: true,
          maxRolloverDays: 3,
          currentRollovers: 2,
          color: "#9C27B0",
          sortOrder: 4,
        },
      }),
      prisma.habit.create({
        data: {
          userId,
          title: "Gym workout",
          description: "Custom: 4x per week",
          frequencyType: "CUSTOM",
          frequencyDays: [1, 2, 4, 5],
          timesPerDay: 1,
          status: "ACTIVE",
          currentStreak: 3,
          longestStreak: 10,
          totalCompletions: 40,
          trackAmount: false,
          color: "#F44336",
          sortOrder: 5,
        },
      }),
      prisma.habit.create({
        data: {
          userId,
          title: "Guitar practice",
          description: "Paused while traveling",
          frequencyType: "DAILY",
          timesPerDay: 1,
          status: "PAUSED",
          pausedAt: lastWeek,
          currentStreak: 4,
          longestStreak: 14,
          totalCompletions: 30,
          color: "#607D8B",
          sortOrder: 6,
        },
      }),
      prisma.habit.create({
        data: {
          userId,
          title: "No TV during weekdays",
          description: "Archived - no longer relevant",
          frequencyType: "DAILY",
          timesPerDay: 1,
          status: "ARCHIVED",
          archivedAt: lastMonth,
          currentStreak: 0,
          longestStreak: 45,
          totalCompletions: 90,
          color: "#9E9E9E",
          sortOrder: 7,
        },
      }),
      prisma.habit.create({
        data: {
          userId,
          title: "Evening skincare routine",
          description: "Brand new habit",
          frequencyType: "DAILY",
          timesPerDay: 1,
          status: "ACTIVE",
          currentStreak: 0,
          longestStreak: 0,
          totalCompletions: 0,
          targetValue: 3,
          trackAmount: true,
          unit: "steps",
          color: "#E91E63",
          sortOrder: 8,
        },
      }),
      prisma.habit.create({
        data: {
          userId,
          title: "Stretch breaks",
          description: "3 times per day",
          frequencyType: "DAILY",
          timesPerDay: 3,
          trackAmount: false,
          status: "ACTIVE",
          currentStreak: 7,
          longestStreak: 15,
          totalCompletions: 45,
          color: "#4CAF50",
          sortOrder: 9,
        },
      }),
      prisma.habit.create({
        data: {
          userId,
          title: "Gratitude journal",
          description: "Daily, rollovers maxed",
          frequencyType: "DAILY",
          timesPerDay: 1,
          status: "ACTIVE",
          currentStreak: 5,
          longestStreak: 8,
          totalCompletions: 20,
          allowRollover: true,
          maxRolloverDays: 2,
          currentRollovers: 2,
          color: "#FFC107",
          sortOrder: 10,
        },
      }),
    ]);

    // Habit logs
    const waterLogs = [];
    for (let i = 0; i < 15; i++) {
      waterLogs.push({
        habitId: habits[0].id,
        date: utcMidnight(new Date(today.getTime() - i * 86400000)),
        value: 8,
        unit: "glasses",
        status: "COMPLETED",
        completedAt: new Date(today.getTime() - i * 86400000 + 20 * 3600000),
      });
    }
    await prisma.habitLog.createMany({ data: waterLogs });
    await prisma.habitLog.createMany({
      data: [
        {
          habitId: habits[1].id,
          date: yesterday,
          value: 1,
          status: "COMPLETED",
          completedAt: new Date(yesterday.getTime() + 7 * 3600000),
        },
        {
          habitId: habits[1].id,
          date: today,
          status: "MISSED",
          note: "Slept through alarm",
        },
      ],
    });
    await prisma.habitLog.create({
      data: {
        habitId: habits[2].id,
        date: utcMidnight(new Date(today.getTime() - 2 * 86400000)),
        value: 1,
        status: "COMPLETED",
        completedAt: new Date(today.getTime() - 2 * 86400000 + 10 * 3600000),
      },
    });
    await prisma.habitLog.createMany({
      data: [
        {
          habitId: habits[9].id,
          date: today,
          status: "COMPLETED",
          completedAt: new Date(today.getTime() + 8 * 3600000),
        },
        {
          habitId: habits[9].id,
          date: yesterday,
          status: "ROLLOVER",
          rolledOverFrom: twoDaysAgo,
          completedAt: new Date(yesterday.getTime() + 9 * 3600000),
        },
        {
          habitId: habits[9].id,
          date: twoDaysAgo,
          status: "ROLLOVER",
          rolledOverFrom: threeDaysAgo,
          completedAt: new Date(twoDaysAgo.getTime() + 8 * 3600000),
        },
        {
          habitId: habits[9].id,
          date: threeDaysAgo,
          status: "COMPLETED",
          completedAt: new Date(threeDaysAgo.getTime() + 9 * 3600000),
        },
        {
          habitId: habits[9].id,
          date: fourDaysAgo,
          status: "SKIPPED",
          note: "Travel day",
        },
      ],
    });

    // Time entries
    await Promise.all([
      prisma.timeEntry.create({
        data: {
          userId,
          goalId: goal1.id,
          taskId: tasks[1].id,
          startTime: new Date(now.getTime() - 25 * 60000),
          entryType: "POMODORO",
          status: "RUNNING",
          note: "Shopping for running shoes online",
        },
      }),
      prisma.timeEntry.create({
        data: {
          userId,
          goalId: goal5.id,
          startTime: new Date(today.getTime() + 6 * 3600000),
          endTime: new Date(today.getTime() + 6 * 3600000 + 10 * 60000),
          duration: 600,
          entryType: "TIMER",
          status: "COMPLETED",
          note: "Morning meditation",
        },
      }),
      prisma.timeEntry.create({
        data: {
          userId,
          goalId: goal1.id,
          startTime: yesterday,
          endTime: new Date(yesterday.getTime() + 45 * 60000),
          duration: 2700,
          entryType: "MANUAL",
          status: "COMPLETED",
          note: "Forgot to start timer, ran 5km",
        },
      }),
      prisma.timeEntry.create({
        data: {
          userId,
          goalId: goal2.id,
          startTime: new Date(now.getTime() - 60 * 60000),
          entryType: "TIMER",
          status: "PAUSED",
          note: "Reading session - taking a break",
        },
      }),
    ]);

    const counts = {
      goals: await prisma.goal.count({ where: { userId } }),
      tasks: await prisma.task.count({ where: { userId } }),
      habits: await prisma.habit.count({ where: { userId } }),
      habitLogs: await prisma.habitLog.count({ where: { habit: { userId } } }),
      timeEntries: await prisma.timeEntry.count({ where: { userId } }),
    };

    res.json({
      message: "Seed data created successfully",
      counts,
      testUser: { userId, generatedAt: now },
    });
  } catch (error) {
    console.error("Seed error:", error);
    res
      .status(500)
      .json({ message: "Failed to create seed data", error: error.message });
  }
});

module.exports = router;
