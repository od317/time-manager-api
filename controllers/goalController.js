const prisma = require("../utils/prisma");

// @desc    Get all goals for user (with hierarchy)
// @route   GET /api/goals
const getGoals = async (req, res) => {
  try {
    const { status } = req.query;
    const where = { userId: req.user.id };
    if (status) where.status = status;

    const goals = await prisma.goal.findMany({
      where,
      include: {
        children: {
          include: {
            tasks: true,
            children: true,
          },
        },
        tasks: true,
        timeEntries: true,
        _count: { select: { timeEntries: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    // Calculate combined progress for each goal
    const enrichedGoals = goals.map((goal) => {
      // Get all sub-goal IDs
      const getAllIds = (g, ids = []) => {
        if (g.children) {
          g.children.forEach((child) => {
            ids.push(child.id);
            getAllIds(child, ids);
          });
        }
        return ids;
      };
      const childIds = getAllIds(goal);

      // Get time from sub-goals
      let totalTime = (goal.timeEntries || []).reduce(
        (sum, e) => sum + (e.duration || 0),
        0,
      );

      if (childIds.length > 0) {
        // Add sub-goal time (we don't have it here, so progress stays as-is)
        // For time-based goals, calculate from currentValue
      }

      // Calculate progress including sub-goals
      let combinedProgress = goal.progress || 0;
      if (goal.goalType === "time" && goal.targetValue) {
        const trackedInUnit =
          goal.unit === "minutes" ? totalTime / 60 : totalTime / 3600;
        combinedProgress = Math.min(
          (trackedInUnit / goal.targetValue) * 100,
          100,
        );
      }

      return {
        ...goal,
        combinedProgress: Math.max(goal.progress, combinedProgress),
      };
    });

    res.json(enrichedGoals);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get single goal
// @route   GET /api/goals/:id
const getGoal = async (req, res) => {
  try {
    const goal = await prisma.goal.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
      include: {
        parent: {
          select: { id: true, status: true, title: true },
        },
        children: {
          include: {
            tasks: true,
            children: true,
          },
        },
        tasks: {
          include: {
            checkIns: true,
            timeEntries: true,
          },
        },
        timeEntries: true,
      },
    });

    if (!goal) {
      return res.status(404).json({ message: "Goal not found" });
    }

    // Collect all sub-goal IDs recursively
    function getAllChildIds(g, ids = []) {
      if (g.children) {
        for (const child of g.children) {
          ids.push(child.id);
          getAllChildIds(child, ids);
        }
      }
      return ids;
    }

    const allChildIds = getAllChildIds(goal);

    // Fetch time entries for all sub-goals
    if (allChildIds.length > 0) {
      const childTimeEntries = await prisma.timeEntry.findMany({
        where: {
          goalId: { in: allChildIds },
          status: "COMPLETED",
        },
        orderBy: { startTime: "desc" },
      });

      // Add child time entries to the response
      goal.allTimeEntries = [...(goal.timeEntries || []), ...childTimeEntries];
      goal.totalTimeSpent = goal.allTimeEntries.reduce(
        (sum, e) => sum + (e.duration || 0),
        0,
      );
    } else {
      goal.allTimeEntries = goal.timeEntries || [];
      goal.totalTimeSpent = goal.allTimeEntries.reduce(
        (sum, e) => sum + (e.duration || 0),
        0,
      );
    }

    if (goal.goalType === "time" && goal.targetValue) {
      const totalSeconds = goal.totalTimeSpent || 0;
      const trackedInUnit =
        goal.unit === "minutes" ? totalSeconds / 60 : totalSeconds / 3600;
      goal.combinedProgress = Math.min(
        (trackedInUnit / goal.targetValue) * 100,
        100,
      );
    } else if (goal.goalType === "quantity" && goal.targetValue) {
      // For quantity goals, use the stored progress
      goal.combinedProgress = goal.progress || 0;
    } else {
      goal.combinedProgress = goal.progress || 0;
    }

    res.json(goal);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Create goal
// @route   POST /api/goals
const createGoal = async (req, res) => {
  try {
    const {
      title,
      description,
      parentId,
      category,
      tags,
      priority,
      goalType,
      targetMetric,
      targetValue,
      unit,
      startDate,
      endDate,
      deadlineType,
      color,
      icon,
      isRecurring,
      recurringRule,
    } = req.body;

    // If creating a sub-goal, check if parent is completed
    if (parentId) {
      const parentGoal = await prisma.goal.findFirst({
        where: { id: parentId, userId: req.user.id },
        select: { status: true, title: true },
      });

      if (!parentGoal) {
        return res.status(404).json({ message: "Parent goal not found" });
      }

      if (parentGoal.status === "COMPLETED") {
        return res.status(400).json({
          message: `Cannot add sub-goals to completed goal "${parentGoal.title}".`,
        });
      }
    }

    // If creating a sub-goal, inherit parent's color
    let goalColor = color;
    if (parentId && !color) {
      const parentGoal = await prisma.goal.findFirst({
        where: { id: parentId, userId: req.user.id },
        select: { color: true },
      });
      goalColor = parentGoal?.color || null;
    }

    const goal = await prisma.goal.create({
      data: {
        userId: req.user.id,
        title,
        description,
        parentId,
        category,
        tags: tags || [],
        priority: priority || "MEDIUM",
        goalType: goalType || "quantity",
        targetMetric,
        targetValue,
        unit,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        deadlineType: deadlineType || "HARD",
        color: goalColor,
        icon,
        isRecurring: isRecurring || false,
        recurringRule,
      },
      include: {
        children: true,
        tasks: true,
      },
    });

    res.status(201).json(goal);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Update goal
// @route   PUT /api/goals/:id
const updateGoal = async (req, res) => {
  try {
    const existingGoal = await prisma.goal.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!existingGoal) {
      return res.status(404).json({ message: "Goal not found" });
    }

    if (req.body.status === "ACTIVE" && existingGoal.parentId) {
      const parentGoal = await prisma.goal.findFirst({
        where: { id: existingGoal.parentId, userId: req.user.id },
        select: { status: true, title: true },
      });

      if (parentGoal && parentGoal.status === "COMPLETED") {
        return res.status(400).json({
          message: `Cannot re-activate this sub-goal. The parent goal "${parentGoal.title}" is completed.`,
        });
      }
    }

    // If trying to complete, check sub-goals
    if (req.body.status === "COMPLETED") {
      const activeSubGoals = await prisma.goal.count({
        where: {
          parentId: req.params.id,
          status: { in: ["ACTIVE", "PAUSED"] },
        },
      });

      if (activeSubGoals > 0) {
        return res.status(400).json({
          message: `Cannot complete this goal. ${activeSubGoals} sub-goal(s) are still active.`,
        });
      }

      // Also check active tasks
      const activeTasks = await prisma.task.count({
        where: {
          goalId: req.params.id,
          status: { in: ["TODO", "IN_PROGRESS"] },
        },
      });

      if (activeTasks > 0) {
        return res.status(400).json({
          message: `Cannot complete this goal. ${activeTasks} task(s) are still pending.`,
        });
      }
    }

    const {
      title,
      description,
      category,
      tags,
      priority,
      targetMetric,
      targetValue,
      currentValue,
      unit,
      endDate,
      deadlineType,
      status,
      color,
      icon,
      sortOrder,
      progress,
    } = req.body;

    const goal = await prisma.goal.update({
      where: { id: req.params.id },
      data: {
        title,
        description,
        category,
        tags,
        priority,
        targetMetric,
        targetValue,
        currentValue,
        unit,
        endDate: endDate ? new Date(endDate) : undefined,
        deadlineType,
        status,
        color,
        icon,
        sortOrder,
        progress,
        completedAt: status === "COMPLETED" ? new Date() : undefined,
        failedAt: status === "FAILED" ? new Date() : undefined,
        lastActivityAt: new Date(),
      },
    });

    res.json(goal);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Delete goal
// @route   DELETE /api/goals/:id
const deleteGoal = async (req, res) => {
  try {
    const goal = await prisma.goal.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!goal) {
      return res.status(404).json({ message: "Goal not found" });
    }

    // Delete all child goals, tasks, and time entries
    await prisma.goal.delete({
      where: { id: req.params.id },
    });

    res.json({ message: "Goal deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Reorder goals (drag & drop)
// @route   PUT /api/goals/reorder
const reorderGoals = async (req, res) => {
  try {
    const { orderedIds } = req.body; // Array of goal IDs in new order

    // Update sort order for each goal
    const updates = orderedIds.map((id, index) =>
      prisma.goal.updateMany({
        where: { id, userId: req.user.id },
        data: { sortOrder: index },
      }),
    );

    await prisma.$transaction(updates);

    res.json({ message: "Goals reordered" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get goal statistics
// @route   GET /api/goals/:id/stats
const getGoalStats = async (req, res) => {
  try {
    const goal = await prisma.goal.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        tasks: {
          select: {
            status: true,
            timeEntries: {
              select: { duration: true },
            },
          },
        },
        timeEntries: {
          select: { duration: true },
        },
        children: {
          select: {
            status: true,
            progress: true,
          },
        },
      },
    });

    if (!goal) {
      return res.status(404).json({ message: "Goal not found" });
    }

    const totalTasks = goal.tasks.length;
    const completedTasks = goal.tasks.filter(
      (t) => t.status === "COMPLETED",
    ).length;
    const totalTimeSpent = goal.timeEntries.reduce(
      (sum, e) => sum + (e.duration || 0),
      0,
    );

    res.json({
      totalTasks,
      completedTasks,
      completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      totalTimeSpent,
      progress: goal.progress,
      childGoalsCount: goal.children.length,
      childGoalsCompleted: goal.children.filter((c) => c.status === "COMPLETED")
        .length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getGoals,
  getGoal,
  createGoal,
  updateGoal,
  deleteGoal,
  reorderGoals,
  getGoalStats,
};
