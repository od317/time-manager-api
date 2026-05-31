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

    res.json({ insights });
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

function buildPrompt(goals, habits, timeEntries, period) {
  const completedGoals = goals.filter((g) => g.status === "COMPLETED").length;
  const activeGoals = goals.filter((g) => g.status === "ACTIVE").length;
  const activeHabits = habits.filter((h) => h.status === "ACTIVE").length;
  const totalHabits = habits.length;
  const totalTime = Math.round(
    timeEntries.reduce((sum, e) => sum + (e.duration || 0), 0) / 3600,
  );

  return `You are a supportive productivity coach. Based on this user's data for the ${period}, provide 3-4 brief, encouraging insights.

User Data:
- ${completedGoals} goals completed, ${activeGoals} active
- ${activeHabits} active habits out of ${totalHabits} total
- ${totalTime} hours tracked this ${period}

Format your response as a JSON array only, no other text:
[
  { "title": "short title", "content": "1-2 sentence insight", "type": "summary|suggestion|encouragement|pattern" }
]

Rules:
- Be encouraging and specific
- Reference actual numbers when possible
- Suggest actionable improvements
- Keep each insight under 150 characters
- Return ONLY valid JSON array, no markdown, no other text`;
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
