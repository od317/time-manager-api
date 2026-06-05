// backend/routes/seed.js
const express = require("express");
const router = express.Router();
const prisma = require("../utils/prisma");
const auth = require("../middleware/auth");

/**
 * POST /api/seed/all
 * Creates comprehensive test data covering all edge cases
 * WARNING: This deletes ALL existing data for the test user!
 */
router.post("/all", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Clean existing data for this user
    await prisma.$transaction([
      prisma.taskCheckIn.deleteMany({ where: { task: { userId } } }),
      prisma.timeEntry.deleteMany({ where: { userId } }),
      prisma.habitLog.deleteMany({ where: { habit: { userId } } }),
      prisma.task.deleteMany({ where: { userId } }),
      prisma.habit.deleteMany({ where: { userId } }),
      prisma.goal.deleteMany({ where: { userId } }),
    ]);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today - 86400000);
    const tomorrow = new Date(today.getTime() + 86400000);
    const dayAfterTomorrow = new Date(today.getTime() + 172800000);
    const nextWeek = new Date(today.getTime() + 7 * 86400000);
    const lastWeek = new Date(today.getTime() - 7 * 86400000);
    const lastMonth = new Date(today.getTime() - 30 * 86400000);
    const nextMonth = new Date(today.getTime() + 30 * 86400000);
    const twoDaysAgo = new Date(today.getTime() - 172800000);
    const threeDaysAgo = new Date(today.getTime() - 259200000);
    const fourDaysAgo = new Date(today.getTime() - 345600000);

    // ========================================================================
    // GOALS - Create all goals first
    // ========================================================================

    // Create individual goals
    const goal1 = await prisma.goal.create({
      data: {
        userId,
        title: "🏃 Running Distance Goal",
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
        icon: "🏃",
        sortOrder: 1,
      },
    });

    const goal2 = await prisma.goal.create({
      data: {
        userId,
        title: "📚 Read 12 Books",
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
        icon: "📚",
        sortOrder: 2,
      },
    });

    const goal3 = await prisma.goal.create({
      data: {
        userId,
        title: "💪 Gym Sessions",
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
        icon: "💪",
        sortOrder: 3,
      },
    });

    const goal4 = await prisma.goal.create({
      data: {
        userId,
        title: "📝 Journal This Week",
        description: "Active goal ending today, 70% complete - tight deadline!",
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
        icon: "📝",
        sortOrder: 4,
      },
    });

    const goal5 = await prisma.goal.create({
      data: {
        userId,
        title: "🧘 Daily Meditation",
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
        icon: "🧘",
        sortOrder: 5,
      },
    });

    const goal6 = await prisma.goal.create({
      data: {
        userId,
        title: "💧 Water Intake",
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
        icon: "💧",
        sortOrder: 6,
      },
    });

    const goal7 = await prisma.goal.create({
      data: {
        userId,
        title: "🎸 Learn Guitar",
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
        icon: "🎸",
        sortOrder: 7,
      },
    });

    const goal8 = await prisma.goal.create({
      data: {
        userId,
        title: "🎨 Paint Portfolio",
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
        icon: "⚠️",
        sortOrder: 8,
      },
    });

    const goal9 = await prisma.goal.create({
      data: {
        userId,
        title: "🌱 New Habit Building",
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
        icon: "🌱",
        sortOrder: 9,
      },
    });

    const goal10 = await prisma.goal.create({
      data: {
        userId,
        title: "🏋️ Weekly Workout Goal",
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
        icon: "🏋️",
        sortOrder: 10,
      },
    });

    // Store all goals in an array for later reference
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

    // Create GOAL HIERARCHY (parent-child relationships)
    const parentGoal = await prisma.goal.create({
      data: {
        userId,
        title: "🏆 Health & Fitness Master Goal",
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
        icon: "🏆",
        sortOrder: 0,
      },
    });

    const childGoal1 = await prisma.goal.create({
      data: {
        userId,
        parentId: parentGoal.id,
        title: "💪 Strength Training",
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
        icon: "💪",
        sortOrder: 1,
      },
    });

    const childGoal2 = await prisma.goal.create({
      data: {
        userId,
        parentId: parentGoal.id,
        title: "🥗 Nutrition Tracking",
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
        icon: "🥗",
        sortOrder: 2,
      },
    });

    // Deep nested goal (3 levels)
    const deepNestedGoal = await prisma.goal.create({
      data: {
        userId,
        parentId: childGoal1.id,
        title: "🏋️ Deadlift Progress",
        description: "Nested 3 levels deep! Sub-goal of Strength Training",
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
        icon: "🏋️",
        sortOrder: 1,
      },
    });

    // ========================================================================
    // TASKS - Now goals array is fully initialized
    // ========================================================================

    const tasks = await Promise.all([
      // 1. TODO task - future due date (linked to goal1)
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

      // 2. IN_PROGRESS task - due today (linked to goal1)
      prisma.task.create({
        data: {
          userId,
          goalId: goal1.id,
          title: "Buy running shoes",
          description: "In progress, due today - needs completion!",
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

      // 3. COMPLETED task (linked to goal2)
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

      // 4. FAILED task (linked to goal3)
      prisma.task.create({
        data: {
          userId,
          goalId: goal3.id,
          title: "Leg day workout",
          description: "Failed! Due 5 days ago, never completed",
          status: "FAILED",
          priority: "HIGH",
          dueDate: new Date(today - 5 * 86400000),
          failedAt: new Date(today - 5 * 86400000),
          failureReason: "Missed deadline",
          estimatedMinutes: 90,
          autoFail: true,
          targetValue: 1,
          currentValue: 0,
          color: "#F44336",
          sortOrder: 4,
        },
      }),

      // 5. OVERDUE task within grace period (linked to goal4)
      prisma.task.create({
        data: {
          userId,
          goalId: goal4.id,
          title: "Evening journal entry",
          description: "Due yesterday but within 24h grace period",
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

      // 6. Recurring task (linked to goal5)
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

      // 7. Standalone task (no goal)
      prisma.task.create({
        data: {
          userId,
          title: "📞 Call dentist",
          description: "No goal association, standalone task",
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

      // 8. Low priority task - no due date
      prisma.task.create({
        data: {
          userId,
          title: "🎵 Create workout playlist",
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

      // 9. OVERDUE task - overdue but not failed (grace period extended)
      prisma.task.create({
        data: {
          userId,
          goalId: goal1.id,
          title: "Stretch routine",
          description: "OVERDUE by 1 day but grace period extended to 72h",
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

      // 10. Task with quantity tracking (linked to goal9)
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

    // Add task check-ins
    await Promise.all([
      prisma.taskCheckIn.create({
        data: {
          taskId: tasks[9].id, // Read 10 pages
          value: 2,
          note: "Morning reading session",
          checkedAt: new Date(today.getTime() - 4 * 3600000),
        },
      }),
      prisma.taskCheckIn.create({
        data: {
          taskId: tasks[9].id, // Read 10 pages
          value: 2,
          note: "Afternoon reading",
          checkedAt: new Date(today.getTime() - 1 * 3600000),
        },
      }),
      prisma.taskCheckIn.create({
        data: {
          taskId: tasks[4].id, // Journal entry
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
      // 1. DAILY habit - Active with strong streak
      prisma.habit.create({
        data: {
          userId,
          title: "💧 Drink 8 glasses of water",
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
          icon: "💧",
          sortOrder: 1,
        },
      }),

      // 2. DAILY habit - Missed today (broken streak)
      prisma.habit.create({
        data: {
          userId,
          title: "🏃 Morning run",
          description: "Daily habit, missed today - streak broken!",
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
          icon: "🏃",
          sortOrder: 2,
        },
      }),

      // 3. WEEKLY habit - Completed this week
      prisma.habit.create({
        data: {
          userId,
          title: "🧹 House cleaning",
          description:
            "Weekly habit, scheduled Mon/Wed/Sat, completed for this week",
          frequencyType: "WEEKLY",
          frequencyDays: [1, 3, 6],
          timesPerDay: 1,
          status: "ACTIVE",
          currentStreak: 8,
          longestStreak: 12,
          totalCompletions: 52,
          allowRollover: false,
          color: "#795548",
          icon: "🧹",
          sortOrder: 3,
        },
      }),

      // 4. WEEKLY habit - Missed this week
      prisma.habit.create({
        data: {
          userId,
          title: "📖 Book club reading",
          description: "Weekly habit on Sundays, missed this week",
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
          icon: "📖",
          sortOrder: 4,
        },
      }),

      // 5. CUSTOM frequency habit
      prisma.habit.create({
        data: {
          userId,
          title: "🏋️ Gym workout",
          description: "Custom: 4x per week, specific days",
          frequencyType: "CUSTOM",
          frequencyDays: [1, 2, 4, 5],
          timesPerDay: 1,
          status: "ACTIVE",
          currentStreak: 3,
          longestStreak: 10,
          totalCompletions: 40,
          trackAmount: false,
          color: "#F44336",
          icon: "🏋️",
          sortOrder: 5,
        },
      }),

      // 6. PAUSED habit
      prisma.habit.create({
        data: {
          userId,
          title: "🎸 Guitar practice",
          description: "Paused while traveling",
          frequencyType: "DAILY",
          timesPerDay: 1,
          status: "PAUSED",
          pausedAt: lastWeek,
          currentStreak: 4,
          longestStreak: 14,
          totalCompletions: 30,
          color: "#607D8B",
          icon: "🎸",
          sortOrder: 6,
        },
      }),

      // 7. ARCHIVED habit
      prisma.habit.create({
        data: {
          userId,
          title: "📺 No TV during weekdays",
          description: "Archived - no longer relevant",
          frequencyType: "DAILY",
          timesPerDay: 1,
          status: "ARCHIVED",
          archivedAt: lastMonth,
          currentStreak: 0,
          longestStreak: 45,
          totalCompletions: 90,
          color: "#9E9E9E",
          icon: "📺",
          sortOrder: 7,
        },
      }),

      // 8. New habit (no completions yet)
      prisma.habit.create({
        data: {
          userId,
          title: "🌿 Evening skincare routine",
          description: "Brand new habit, starting today",
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
          icon: "🌿",
          sortOrder: 8,
        },
      }),

      // 9. Multiple times per day habit
      prisma.habit.create({
        data: {
          userId,
          title: "🧘 Stretch breaks",
          description: "3 times per day, good for office workers",
          frequencyType: "DAILY",
          timesPerDay: 3,
          trackAmount: false,
          status: "ACTIVE",
          currentStreak: 7,
          longestStreak: 15,
          totalCompletions: 45,
          color: "#4CAF50",
          icon: "🧘",
          sortOrder: 9,
        },
      }),

      // 10. Habit with rollovers maxed out
      prisma.habit.create({
        data: {
          userId,
          title: "📝 Gratitude journal",
          description: "Daily, max rollovers used (2/2), must complete today",
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
          icon: "📝",
          sortOrder: 10,
        },
      }),
    ]);

    // ========================================================================
    // HABIT LOGS
    // ========================================================================

    // Habit 1: Water drinking (15-day streak)
    const waterLogs = [];
    for (let i = 0; i < 15; i++) {
      const logDate = new Date(today - i * 86400000);
      waterLogs.push({
        habitId: habits[0].id,
        date: logDate,
        value: 8,
        unit: "glasses",
        status: "COMPLETED",
        completedAt: new Date(logDate.getTime() + 20 * 3600000),
      });
    }
    await prisma.habitLog.createMany({ data: waterLogs });

    // Habit 2: Morning run (completed yesterday, missed today)
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

    // Habit 3: Weekly cleaning
    await prisma.habitLog.create({
      data: {
        habitId: habits[2].id,
        date: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() - 2,
        ),
        value: 1,
        status: "COMPLETED",
        completedAt: new Date(today.getTime() - 2 * 86400000 + 10 * 3600000),
      },
    });

    // Habit 10: Gratitude journal (rollovers)
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

    // ========================================================================
    // TIME ENTRIES
    // ========================================================================

    await Promise.all([
      // Running timer (linked to goal1, task2)
      prisma.timeEntry.create({
        data: {
          userId,
          goalId: goal1.id,
          taskId: tasks[1].id,
          startTime: new Date(now - 25 * 60000),
          entryType: "POMODORO",
          status: "RUNNING",
          note: "Shopping for running shoes online",
        },
      }),

      // Completed timer (linked to goal5)
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

      // Manual entry (linked to goal1)
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

      // Paused timer (linked to goal2)
      prisma.timeEntry.create({
        data: {
          userId,
          goalId: goal2.id,
          startTime: new Date(now - 60 * 60000),
          entryType: "TIMER",
          status: "PAUSED",
          note: "Reading session - taking a break",
        },
      }),
    ]);

    // ========================================================================
    // RESPONSE
    // ========================================================================

    const counts = {
      goals: await prisma.goal.count({ where: { userId } }),
      tasks: await prisma.task.count({ where: { userId } }),
      habits: await prisma.habit.count({ where: { userId } }),
      habitLogs: await prisma.habitLog.count({ where: { habit: { userId } } }),
      timeEntries: await prisma.timeEntry.count({ where: { userId } }),
      taskCheckIns: await prisma.taskCheckIn.count({
        where: { task: { userId } },
      }),
    };

    res.json({
      message: "✅ Seed data created successfully with all edge cases!",
      summary: {
        goals: {
          total: counts.goals,
          states: {
            active: "Future deadline, ending today, no end date, 0% fresh",
            completed: "100% complete, overachieved (150%)",
            failed: "Past deadline with failure reason",
            archived: "Manually archived",
            overdue: "Past deadline but still completable",
            hierarchy: "3-level nesting (parent → child → grandchild)",
          },
          types: ["quantity", "time", "project"],
          special: ["recurring (weekly)"],
        },
        tasks: {
          total: counts.tasks,
          states: {
            todo: "Future due, no due date",
            in_progress: "Due today, quantity tracking",
            completed: "Finished on time",
            failed: "5 days overdue, auto-failed",
            overdue: "Past due but within grace period",
          },
          features: [
            "standalone (no goal)",
            "recurring",
            "quantity tracking with check-ins",
          ],
        },
        habits: {
          total: counts.habits,
          frequency: {
            daily:
              "With streak (15 days), missed today (broken), new (0 streak)",
            weekly: "Completed this week, missed this week",
            custom: "4x per week specific days",
          },
          states: ["active", "paused", "archived"],
          special: [
            "multiple times/day (3x)",
            "rollovers maxed out",
            "amount tracking",
          ],
        },
        timeEntries: {
          total: counts.timeEntries,
          states: [
            "RUNNING (pomodoro)",
            "PAUSED",
            "COMPLETED (timer)",
            "COMPLETED (manual)",
          ],
        },
      },
      testUser: {
        userId,
        generatedAt: now,
      },
    });
  } catch (error) {
    console.error("Seed error:", error);
    res.status(500).json({
      message: "Failed to create seed data",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

module.exports = router;
