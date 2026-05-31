const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function seed() {
  console.log("Seeding database...");

  // Get the first user (or create one)
  let user = await prisma.user.findFirst();
  if (!user) {
    console.log("No user found. Please create an account first.");
    return;
  }

  const userId = user.id;
  const now = new Date();

  // Create goals with progress
  const goals = [
    {
      title: "Learn Spanish",
      description: "1000 words vocabulary",
      goalType: "quantity",
      targetValue: 1000,
      unit: "words",
      currentValue: 650,
      progress: 65,
      color: "#6366F1",
      priority: "HIGH",
      status: "ACTIVE",
    },
    {
      title: "Read 12 Books",
      description: "One book per month",
      goalType: "quantity",
      targetValue: 12,
      unit: "books",
      currentValue: 5,
      progress: 42,
      color: "#10B981",
      priority: "MEDIUM",
      status: "ACTIVE",
    },
    {
      title: "Build Portfolio",
      description: "Full-stack project",
      goalType: "project",
      color: "#F59E0B",
      priority: "URGENT",
      status: "ACTIVE",
    },
    {
      title: "Exercise 100 hours",
      description: "Gym and running",
      goalType: "time",
      targetValue: 100,
      unit: "hours",
      currentValue: 45,
      progress: 45,
      color: "#EF4444",
      priority: "HIGH",
      status: "ACTIVE",
    },
    {
      title: "Learn TypeScript",
      description: "Completed last month",
      goalType: "time",
      targetValue: 40,
      unit: "hours",
      currentValue: 40,
      progress: 100,
      color: "#8B5CF6",
      priority: "MEDIUM",
      status: "COMPLETED",
      completedAt: new Date(now - 15 * 24 * 60 * 60 * 1000),
    },
    {
      title: "Meditation Habit",
      description: "Failed to maintain",
      goalType: "quantity",
      targetValue: 30,
      unit: "days",
      currentValue: 8,
      progress: 27,
      color: "#06B6D4",
      priority: "LOW",
      status: "FAILED",
      failedAt: new Date(now - 30 * 24 * 60 * 60 * 1000),
    },
  ];

  const createdGoals = [];
  for (const goal of goals) {
    const created = await prisma.goal.create({
      data: {
        userId,
        startDate: new Date(now - 60 * 24 * 60 * 60 * 1000),
        ...goal,
      },
    });
    createdGoals.push(created);
  }
  console.log(`Created ${createdGoals.length} goals`);

  // Create tasks
  const tasks = [
    {
      goalId: createdGoals[0].id,
      title: "Learn 50 food words",
      status: "COMPLETED",
      completedAt: new Date(now - 10 * 24 * 60 * 60 * 1000),
      estimatedMinutes: 30,
    },
    {
      goalId: createdGoals[0].id,
      title: "Practice verb conjugations",
      status: "COMPLETED",
      completedAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
      estimatedMinutes: 45,
    },
    {
      goalId: createdGoals[0].id,
      title: "Watch Spanish TV episode",
      status: "TODO",
      estimatedMinutes: 60,
    },
    {
      goalId: createdGoals[0].id,
      title: "Write 100 word essay",
      status: "IN_PROGRESS",
      estimatedMinutes: 30,
    },
    {
      goalId: createdGoals[1].id,
      title: "Finish Chapter 5",
      status: "COMPLETED",
      completedAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
      estimatedMinutes: 60,
    },
    {
      goalId: createdGoals[1].id,
      title: "Start Chapter 6",
      status: "TODO",
      estimatedMinutes: 45,
    },
    {
      goalId: createdGoals[2].id,
      title: "Design homepage",
      status: "COMPLETED",
      completedAt: new Date(now - 7 * 24 * 60 * 60 * 1000),
      estimatedMinutes: 120,
    },
    {
      goalId: createdGoals[2].id,
      title: "Build API endpoints",
      status: "IN_PROGRESS",
      estimatedMinutes: 180,
    },
    {
      goalId: createdGoals[2].id,
      title: "Write tests",
      status: "TODO",
      estimatedMinutes: 90,
    },
    {
      goalId: createdGoals[3].id,
      title: "Run 5km",
      status: "COMPLETED",
      completedAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
      estimatedMinutes: 30,
    },
    {
      goalId: createdGoals[3].id,
      title: "Gym workout",
      status: "COMPLETED",
      completedAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
      estimatedMinutes: 60,
    },
  ];

  for (const task of tasks) {
    await prisma.task.create({
      data: {
        userId,
        ...task,
        color: createdGoals.find((g) => g.id === task.goalId)?.color,
      },
    });
  }
  console.log(`Created ${tasks.length} tasks`);

  // Create habits
  const habits = [
    {
      title: "Read 1 page",
      description: "Read every day",
      frequencyType: "DAILY",
      frequencyDays: [],
      currentStreak: 12,
      longestStreak: 23,
      totalCompletions: 45,
      color: "#6366F1",
      status: "ACTIVE",
      trackAmount: true,
      targetValue: 1,
      unit: "pages",
    },
    {
      title: "Exercise",
      description: "Stay fit",
      frequencyType: "WEEKLY",
      frequencyDays: [1, 3, 5],
      currentStreak: 8,
      longestStreak: 15,
      totalCompletions: 30,
      color: "#EF4444",
      status: "ACTIVE",
      trackAmount: true,
      targetValue: 30,
      unit: "minutes",
    },
    {
      title: "Meditate",
      description: "10 min daily",
      frequencyType: "DAILY",
      frequencyDays: [],
      currentStreak: 0,
      longestStreak: 7,
      totalCompletions: 12,
      color: "#8B5CF6",
      status: "PAUSED",
      pausedAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
    },
    {
      title: "Journal",
      description: "Write every evening",
      frequencyType: "WEEKLY",
      frequencyDays: [0, 2, 4, 6],
      currentStreak: 5,
      longestStreak: 10,
      totalCompletions: 20,
      color: "#10B981",
      status: "ACTIVE",
    },
    {
      title: "Learn coding",
      description: "Study 1 hour",
      frequencyType: "WEEKLY",
      frequencyDays: [1, 2, 3, 4, 5],
      currentStreak: 3,
      longestStreak: 8,
      totalCompletions: 15,
      color: "#F59E0B",
      status: "ACTIVE",
      trackAmount: true,
      targetValue: 60,
      unit: "minutes",
    },
  ];

  const createdHabits = [];
  for (const habit of habits) {
    const created = await prisma.habit.create({
      data: { userId, ...habit },
    });
    createdHabits.push(created);
  }
  console.log(`Created ${createdHabits.length} habits`);

  // Create habit logs (last 30 days)
  for (const habit of createdHabits) {
    if (habit.status !== "ACTIVE" && habit.status !== "PAUSED") continue;

    for (let i = 0; i < 30; i++) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      date.setHours(0, 0, 0, 0);

      // Skip days not in frequency
      if (
        habit.frequencyType === "WEEKLY" &&
        !habit.frequencyDays.includes(date.getDay())
      ) {
        continue;
      }

      // 80% completion rate
      if (Math.random() > 0.2) {
        await prisma.habitLog.create({
          data: {
            habitId: habit.id,
            date,
            status: "COMPLETED",
            value: habit.trackAmount
              ? Math.round(
                  (habit.targetValue || 1) * (0.8 + Math.random() * 0.4),
                )
              : null,
            unit: habit.unit,
          },
        });
      } else if (Math.random() > 0.5) {
        await prisma.habitLog.create({
          data: {
            habitId: habit.id,
            date,
            status: "SKIPPED",
            note: "Busy day",
          },
        });
      }
    }
  }
  console.log("Created habit logs for last 30 days");

  // Create time entries (last 30 days)
  const goalIds = createdGoals.map((g) => g.id);
  for (let i = 0; i < 60; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const startTime = new Date(
      now - daysAgo * 24 * 60 * 60 * 1000 - Math.random() * 8 * 60 * 60 * 1000,
    );
    const duration = Math.floor(Math.random() * 7200) + 300; // 5min to 2 hours
    const endTime = new Date(startTime.getTime() + duration * 1000);

    await prisma.timeEntry.create({
      data: {
        userId,
        goalId: goalIds[Math.floor(Math.random() * goalIds.length)],
        startTime,
        endTime,
        duration,
        status: "COMPLETED",
        entryType: Math.random() > 0.3 ? "TIMER" : "MANUAL",
        note: `Work session ${i + 1}`,
      },
    });
  }
  console.log("Created 60 time entries");

  console.log("✅ Seed complete!");
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
