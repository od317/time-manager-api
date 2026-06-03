const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

router.use(auth);

router.post("/insights", async (req, res) => {
  try {
    const { goals, habits, timeEntries, period } = req.body;
    const prompt = buildPrompt(goals, habits, timeEntries, period);

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 500,
        }),
      },
    );

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    const insights = parseAIResponse(text);

    res.json(insights);
  } catch (error) {
    console.error("AI Error:", error);
    res.json({
      insights: [
        {
          title: "Keep Going!",
          content: "Every small step counts toward your goals.",
          type: "encouragement",
        },
        {
          title: "Tip",
          content: "Break down large goals into smaller tasks.",
          type: "suggestion",
        },
        {
          title: "Consistency is Key",
          content: "Small daily actions lead to big results over time.",
          type: "encouragement",
        },
      ],
    });
  }
});

function buildPrompt(goals, habits, tasks, period) {
  const activeGoals = goals.filter((g) => g.status === "ACTIVE");
  const completedGoals = goals.filter((g) => g.status === "COMPLETED");
  const failedGoals = goals.filter((g) => g.status === "FAILED");
  const overdueGoals = activeGoals.filter(
    (g) => g.endDate && new Date(g.endDate) < new Date(),
  );

  const activeTasks = tasks.filter(
    (t) => t.status === "TODO" || t.status === "IN_PROGRESS",
  );
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED");
  const overdueTasks = activeTasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date(),
  );
  const urgentTasks = activeTasks.filter((t) => t.priority === "URGENT");

  const activeHabits = habits.filter((h) => h.status === "ACTIVE");
  const pausedHabits = habits.filter((h) => h.status === "PAUSED");
  const bestStreak = habits.reduce(
    (max, h) => Math.max(max, h.currentStreak),
    0,
  );
  const avgStreak =
    activeHabits.length > 0
      ? Math.round(
          activeHabits.reduce((sum, h) => sum + h.currentStreak, 0) /
            activeHabits.length,
        )
      : 0;
  const habitsWithZeroStreak = activeHabits.filter(
    (h) => h.currentStreak === 0,
  ).length;

  // Goal details
  const goalDetails = activeGoals
    .slice(0, 5)
    .map((g) => {
      const progress = Math.round(g.progress || 0);
      const tasksDone = (g.tasks || []).filter(
        (t) => t.status === "COMPLETED",
      ).length;
      const tasksTotal = (g.tasks || []).length;
      const hasDeadline = g.endDate
        ? `due ${new Date(g.endDate).toLocaleDateString()}`
        : "no deadline";
      return `- "${g.title}" (${progress}% complete, ${tasksDone}/${tasksTotal} tasks done, ${hasDeadline}, priority: ${g.priority})`;
    })
    .join("\n");

  // Habit details
  const habitDetails = activeHabits
    .slice(0, 5)
    .map((h) => {
      const freq =
        h.frequencyType === "DAILY"
          ? "daily"
          : `${h.frequencyDays.length} days/week`;
      return `- "${h.title}" (${freq}, streak: ${h.currentStreak} days, best: ${h.longestStreak})`;
    })
    .join("\n");

  return `You are an expert productivity coach analyzing a user's TimeFlow data. Provide a detailed, personalized, and encouraging analysis.

USER STATISTICS:
Period: ${period}

GOALS:
- ${activeGoals.length} active, ${completedGoals.length} completed, ${failedGoals.length} failed
- ${overdueGoals.length} overdue goals need attention
${goalDetails ? "\nActive goals:\n" + goalDetails : ""}

TASKS:
- ${activeTasks.length} active tasks, ${completedTasks.length} completed
- ${overdueTasks.length} overdue tasks, ${urgentTasks.length} urgent tasks

HABITS:
- ${activeHabits.length} active habits, ${pausedHabits.length} paused
- Average streak: ${avgStreak} days, Best streak: ${bestStreak} days
- ${habitsWithZeroStreak} habits at 0 streak need attention
${habitDetails ? "\nActive habits:\n" + habitDetails : ""}

Return a JSON object (NOT an array) with these fields:
{
  "overall": "2-3 sentence honest assessment of their current situation. Be specific - mention numbers and patterns you notice.",
  "strengths": ["3-4 specific strengths with evidence from their data. Example: 'Consistent with daily habits - 12 day average streak shows dedication'"],
  "improvements": ["3-4 specific, actionable areas to improve. Be direct but encouraging. Example: '5 overdue tasks need immediate attention - start with the 2 urgent ones'"],
  "recommendation": "1 focused, actionable recommendation for this week based on their data. Be very specific.",
  "motivation": "1 encouraging sentence tailored to their specific progress."
}

Rules:
- Reference actual numbers and goal/habit names from the data
- Be specific, not generic
- Give actionable advice
- Sound like a real coach, not a robot
- Keep each strength/improvement to 1-2 sentences
- Return ONLY valid JSON, no markdown, no other text`;
}

function parseAIResponse(text) {
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    // If it's an array (old format), convert to object
    if (Array.isArray(parsed)) {
      return {
        overall: parsed[0]?.content || "Keep going!",
        strengths: [parsed[1]?.content || "You're making progress"].filter(
          Boolean,
        ),
        improvements: [parsed[2]?.content || "Focus on consistency"].filter(
          Boolean,
        ),
        recommendation: parsed[3]?.content || "Keep tracking your habits.",
        motivation: "Every step counts!",
      };
    }
    return parsed;
  } catch {
    return {
      overall: "You're making progress on your goals and habits.",
      strengths: ["Regular activity tracking", "Goal-oriented approach"],
      improvements: [
        "Address overdue tasks soon",
        "Consider more consistent habit tracking",
      ],
      recommendation: "Focus on completing 2-3 overdue tasks this week.",
      motivation: "Small consistent actions lead to big results!",
    };
  }
}

function parseAIResponse(text) {
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed.slice(0, 4);
  } catch {
    // Fallback
  }
  return [
    {
      title: "Keep Going!",
      content: "You are making progress. Every step counts.",
      type: "encouragement",
    },
    {
      title: "Stay Consistent",
      content: "Regular tracking leads to better results.",
      type: "suggestion",
    },
  ];
}

module.exports = router;
