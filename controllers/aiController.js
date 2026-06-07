// backend/controllers/aiController.js - Complete updated version

const prisma = require("../utils/prisma");

// ============================================================================
// GET INSIGHTS
// ============================================================================
const getInsights = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const todayStart = new Date(todayStr + "T00:00:00.000Z");
    const tomorrow = new Date(todayStart);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const dayOfWeek = todayStart.getUTCDay();

    const [goals, tasks, habits] = await Promise.all([
      prisma.goal.findMany({
        where: { userId, status: { in: ["ACTIVE", "OVERDUE"] } },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          progress: true,
          endDate: true,
          goalType: true,
          tasks: { select: { status: true } },
        },
      }),
      prisma.task.findMany({
        where: {
          userId,
          OR: [
            { status: { in: ["TODO", "IN_PROGRESS", "OVERDUE"] } },
            {
              status: "COMPLETED",
              completedAt: { gte: todayStart, lt: tomorrow },
            },
          ],
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          estimatedMinutes: true,
          goal: { select: { title: true } },
        },
        orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
      }),
      prisma.habit.findMany({
        where: { userId, status: "ACTIVE" },
        select: {
          id: true,
          title: true,
          frequencyType: true,
          frequencyDays: true,
          currentStreak: true,
          longestStreak: true,
          timesPerDay: true,
        },
      }),
    ]);

    const overdueGoals = goals.filter((g) => g.status === "OVERDUE");
    const goalsNearDeadline = goals.filter((g) => {
      if (!g.endDate || g.status !== "ACTIVE") return false;
      const daysLeft = Math.ceil((new Date(g.endDate) - now) / 86400000);
      return daysLeft <= 7 && daysLeft >= 0;
    });
    const overdueTasks = tasks.filter(
      (t) => t.status !== "COMPLETED" && t.dueDate && new Date(t.dueDate) < now,
    );
    const todayTasks = tasks.filter(
      (t) =>
        t.status !== "COMPLETED" &&
        t.dueDate &&
        new Date(t.dueDate) >= todayStart &&
        new Date(t.dueDate) < tomorrow,
    );
    const highPriorityTasks = tasks.filter(
      (t) =>
        (t.priority === "HIGH" || t.priority === "URGENT") &&
        t.status !== "COMPLETED",
    );
    const completedToday = tasks.filter((t) => t.status === "COMPLETED");
    const todayHabits = habits.filter((h) => {
      if (h.frequencyType === "DAILY") return true;
      return h.frequencyDays?.includes(dayOfWeek);
    });
    const habitsAtRisk = habits.filter((h) => h.currentStreak === 0);
    const bestStreak = habits.reduce(
      (max, h) => Math.max(max, h.currentStreak),
      0,
    );
    const avgStreak =
      habits.length > 0
        ? Math.round(
            habits.reduce((s, h) => s + h.currentStreak, 0) / habits.length,
          )
        : 0;

    // Shorter prompt for insights
    const prompt = `You are a direct productivity coach. Analyze this data and give straight talk.

TODAY: ${todayStr}

GOALS (${goals.length}): ${goals.map((g) => `"${g.title}"(${Math.round(g.progress)}%,${g.status})`).join(", ")}
TASKS: ${overdueTasks.length} overdue, ${todayTasks.length} due today, ${completedToday.length} done
HABITS: ${habits.length} active, avg ${avgStreak}d streak, best ${bestStreak}d

${overdueTasks.length > 0 ? `OVERDUE: ${overdueTasks.map((t) => t.title).join(", ")}` : ""}
${habitsAtRisk.length > 0 ? `DEAD HABITS: ${habitsAtRisk.map((h) => h.title).join(", ")}` : ""}

Return ONLY JSON:
{
  "overall": "honest 2 sentence assessment",
  "suggestions": ["2-3 specific actions with names"],
  "warnings": ["1-2 real warnings"],
  "focusArea": "ONE thing to focus on today",
  "motivation": "one real sentence"
}`;

    const aiResponse = await callAI(prompt, 600);
    if (aiResponse) return res.json(aiResponse);
    return res.json(
      buildFallback(goals, tasks, habits, overdueTasks, habitsAtRisk),
    );
  } catch (error) {
    console.error("AI Error:", error);
    return res.json({
      overall: "Unable to generate insights right now.",
      suggestions: ["Review your overdue tasks"],
      warnings: [],
      focusArea: "Focus on your highest priority task today.",
      motivation: "Keep tracking!",
    });
  }
};

// ============================================================================
// PLAN GOAL
// ============================================================================
const generatePlan = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      timeframe,
      hoursPerWeek,
      currentLevel,
      additionalNotes,
    } = req.body;

    if (!title)
      return res.status(400).json({ message: "Goal title is required" });

    const prompt = `You are an expert project planner. Break down a goal into actionable sub-goals and tasks.

USER'S GOAL:
Title: "${title}"
Description: ${description || "No description provided"}
Category: ${category || "general"}
Timeframe: ${timeframe || "not specified"}
Hours per week: ${hoursPerWeek || "not specified"}
Current level: ${currentLevel || "not specified"}
Additional notes: ${additionalNotes || "none"}

RULES:
- Create 3-5 logical phases (sub-goals)
- Each sub-goal MUST have 3-7 specific tasks
- Tasks must be concrete and checkable
- Include time estimates for each task (in minutes)
- Set priorities (HIGH/MEDIUM/LOW)
- Include deadline offsets (e.g., "3 days", "1 week", "2 weeks")
- Be realistic for someone with ${hoursPerWeek || "limited"} hours/week

Return ONLY valid JSON:
{
  "goal": {
    "title": "refined title",
    "description": "what success looks like",
    "goalType": "project",
    "priority": "HIGH",
    "tags": ["tag1", "tag2"],
    "estimatedTotalHours": 240,
    "breakdown": "Brief explanation"
  },
  "subGoals": [
    {
      "title": "Phase 1: Name",
      "description": "What this phase accomplishes",
      "priority": "HIGH",
      "order": 1,
      "estimatedHours": 40,
      "deadlineOffset": "2 weeks",
      "tasks": [
        {
          "title": "Specific task",
          "description": "What to do",
          "priority": "HIGH",
          "estimatedMinutes": 120,
          "dueDateOffset": "3 days"
        }
      ]
    }
  ]
}`;

    const aiResponse = await callAI(prompt, 800);

    if (aiResponse) {
      return res.json(aiResponse);
    }

    // Fallback
    return res.json({
      goal: {
        title,
        description: description || `Complete: ${title}`,
        goalType: "project",
        priority: "HIGH",
        tags: category ? [category] : [],
        estimatedTotalHours: null,
        breakdown:
          "Basic starting plan. Edit and add more details before saving.",
      },
      subGoals: [
        {
          title: "Getting Started",
          description: "Break down the first steps",
          priority: "HIGH",
          order: 1,
          estimatedHours: null,
          deadlineOffset: null,
          tasks: [],
        },
      ],
    });
  } catch (error) {
    console.error("Generate plan error:", error);
    res.status(500).json({ message: "Failed to generate plan" });
  }
};

// ============================================================================
// CREATE PLAN - User sends edited plan, saves to DB
// ============================================================================
const createPlan = async (req, res) => {
  try {
    const userId = req.user.id;
    const { goal: goalData, subGoals, timeframe } = req.body;

    if (!goalData || !goalData.title) {
      return res.status(400).json({ message: "Goal data is required" });
    }

    const now = new Date();
    const endDate = timeframe ? parseTimeframe(timeframe) : null;

    const goal = await prisma.goal.create({
      data: {
        userId,
        title: goalData.title,
        description: goalData.description || null,
        goalType: goalData.goalType || "project",
        priority: goalData.priority || "HIGH",
        category: goalData.category || null,
        tags: goalData.tags || [],
        targetValue: goalData.estimatedTotalHours || null,
        unit: "hours",
        startDate: now,
        endDate,
        status: "ACTIVE",
        color: goalData.color || getRandomColor(),
        icon: goalData.icon || getIconForCategory(goalData.category),
      },
    });

    for (const sg of subGoals || []) {
      const subGoal = await prisma.goal.create({
        data: {
          userId,
          parentId: goal.id,
          title: sg.title,
          description: sg.description || null,
          goalType: "project",
          priority: sg.priority || "MEDIUM",
          targetValue: sg.estimatedHours || null,
          unit: "hours",
          startDate: now,
          endDate: sg.deadlineOffset ? addTimeFromNow(sg.deadlineOffset) : null,
          status: "ACTIVE",
          color: goal.color,
          sortOrder: sg.order || 1,
        },
      });

      for (const task of sg.tasks || []) {
        await prisma.task.create({
          data: {
            userId,
            goalId: subGoal.id,
            title: task.title,
            description: task.description || null,
            priority: task.priority || "MEDIUM",
            estimatedMinutes: task.estimatedMinutes || null,
            dueDate: task.dueDateOffset
              ? addTimeFromNow(task.dueDateOffset)
              : null,
            status: "TODO",
            color: goal.color,
          },
        });
      }
    }

    const fullPlan = await prisma.goal.findUnique({
      where: { id: goal.id },
      include: {
        children: {
          include: { tasks: { orderBy: { sortOrder: "asc" } } },
          orderBy: { sortOrder: "asc" },
        },
        tasks: { orderBy: { sortOrder: "asc" } },
      },
    });

    res.status(201).json(fullPlan);
  } catch (error) {
    console.error("Create plan error:", error);
    res.status(500).json({ message: "Failed to create plan" });
  }
};

function fixTruncatedJSON(str) {
  let open = 0;
  for (const char of str) {
    if (char === "{") open++;
    if (char === "}") open--;
  }
  while (open > 0) {
    str += '"}';
    open--;
  }
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// ============================================================================
// CALL AI
// ============================================================================
async function callAI(prompt, maxTokens = 400) {
  // Try free models - if none work, return null (fallback handles it)
  const models = [
    "moonshotai/kimi-k2.6:free",
    "openrouter/free",
    "deepseek/deepseek-r1:free",
  ];

  for (const model of models) {
    try {
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "TimeFlow",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: maxTokens,
          }),
          signal: AbortSignal.timeout(60000),
        },
      );
      if (!response.ok) continue;
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) continue;
      const cleaned = content.replace(/```json|```/g, "").trim();
      try {
        return JSON.parse(cleaned);
      } catch {
        return fixTruncatedJSON(cleaned);
      }
    } catch {
      continue;
    }
  }
  return null;
}

// ============================================================================
// HELPERS
// ============================================================================
function fixTruncatedJSON(str) {
  let open = 0;
  for (const char of str) {
    if (char === "{") open++;
    if (char === "}") open--;
  }
  while (open > 0) {
    str += '"}';
    open--;
  }
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function buildFallback(goals, tasks, habits, overdueTasks, habitsAtRisk) {
  const suggestions = [];
  const warnings = [];
  if (overdueTasks.length > 0) {
    warnings.push(`${overdueTasks.length} overdue tasks need attention`);
    suggestions.push(
      `Start with "${overdueTasks[0].title}" - it's your most overdue task`,
    );
  }
  if (habitsAtRisk.length > 0) {
    warnings.push(`${habitsAtRisk.length} habits have 0-day streaks`);
    suggestions.push(
      `Restart "${habitsAtRisk[0].title}" today to rebuild momentum`,
    );
  }
  const goalsNearDeadline = goals.filter((g) => {
    if (!g.endDate || g.status !== "ACTIVE") return false;
    return (new Date(g.endDate) - new Date()) / 86400000 <= 7;
  });
  if (goalsNearDeadline.length > 0) {
    warnings.push(`"${goalsNearDeadline[0].title}" is due within a week`);
  }
  if (suggestions.length === 0) {
    suggestions.push("You're on track! Keep up the consistency");
  }
  return {
    overall:
      goals.length > 0
        ? `You have ${goals.length} active goals and ${tasks.filter((t) => t.status !== "COMPLETED").length} pending tasks.`
        : "Start by creating a goal.",
    suggestions,
    warnings,
    focusArea:
      overdueTasks.length > 0
        ? "Clear your overdue tasks first"
        : "Focus on today's habits",
    motivation: habits.some((h) => h.currentStreak >= 7)
      ? "Your streak shows you can build strong habits!"
      : "Small consistent actions lead to big results!",
  };
}

function parseTimeframe(timeframe) {
  const now = new Date();
  const match = timeframe.match(/(\d+)\s*(day|week|month|year)s?/i);
  if (!match) return null;
  const num = parseInt(match[1]),
    unit = match[2].toLowerCase();
  switch (unit) {
    case "day":
      return new Date(now.getTime() + num * 86400000);
    case "week":
      return new Date(now.getTime() + num * 7 * 86400000);
    case "month":
      return new Date(now.setMonth(now.getMonth() + num));
    case "year":
      return new Date(now.setFullYear(now.getFullYear() + num));
    default:
      return null;
  }
}

function addTimeFromNow(offset) {
  const now = new Date();
  const match = offset.match(/(\d+)\s*(day|week|month|hour)s?/i);
  if (!match) return null;
  const num = parseInt(match[1]),
    unit = match[2].toLowerCase();
  switch (unit) {
    case "hour":
      return new Date(now.getTime() + num * 3600000);
    case "day":
      return new Date(now.getTime() + num * 86400000);
    case "week":
      return new Date(now.getTime() + num * 7 * 86400000);
    case "month":
      return new Date(now.setMonth(now.getMonth() + num));
    default:
      return null;
  }
}

function getRandomColor() {
  const colors = [
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#EC4899",
    "#06B6D4",
    "#F97316",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

function getIconForCategory(category) {
  const icons = {
    career: "💼",
    health: "💪",
    learning: "📚",
    finance: "💰",
    creative: "🎨",
    tech: "💻",
    business: "📊",
    personal: "🎯",
    fitness: "🏋️",
    language: "🗣️",
  };
  return icons[category?.toLowerCase()] || "🎯";
}

module.exports = { getInsights, generatePlan, createPlan };
