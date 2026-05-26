const prisma = require("../utils/prisma");

// @desc    Get all goals for user (with hierarchy)
// @route   GET /api/goals
const getGoals = async (req, res) => {
  try {
    const { status, parentId } = req.query;

    const where = {
      userId: req.user.id,
      parentId: parentId || null, // Get top-level goals by default
    };

    if (status) {
      where.status = status;
    }

    const goals = await prisma.goal.findMany({
      where,
      include: {
        children: {
          include: {
            tasks: true,
          },
        },
        tasks: true,
        _count: {
          select: {
            timeEntries: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    res.json(goals);
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

    // If parentId provided, verify parent exists and belongs to user
    if (parentId) {
      const parentGoal = await prisma.goal.findFirst({
        where: { id: parentId, userId: req.user.id },
      });
      if (!parentGoal) {
        return res.status(404).json({ message: "Parent goal not found" });
      }
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
        targetMetric,
        targetValue,
        unit,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        deadlineType: deadlineType || "HARD",
        color,
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
    // Verify goal exists and belongs to user
    const existingGoal = await prisma.goal.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!existingGoal) {
      return res.status(404).json({ message: "Goal not found" });
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
