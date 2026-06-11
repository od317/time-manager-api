// backend/controllers/goalController.js
const prisma = require("../utils/prisma");

// Helper: Check and update goal status based on dates and progress
const refreshGoalStatus = async (goalId) => {
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    select: {
      id: true,
      status: true,
      endDate: true,
      targetValue: true,
      currentValue: true,
      goalType: true,
    },
  });

  if (!goal) return;

  const now = new Date();
  let newStatus = goal.status;

  // Don't auto-change COMPLETED, FAILED, or ARCHIVED goals
  if (["COMPLETED", "FAILED", "ARCHIVED"].includes(goal.status)) {
    return;
  }

  // Check if goal is complete (currentValue >= targetValue)
  if (goal.targetValue && goal.currentValue >= goal.targetValue) {
    if (goal.status !== "COMPLETED") {
      newStatus = "COMPLETED";
    }
  }
  // ACTIVE → OVERDUE: Past end date but not complete
  else if (goal.status === "ACTIVE" && goal.endDate && goal.endDate < now) {
    newStatus = "OVERDUE";
  }
  // OVERDUE → ACTIVE: End date extended to future
  else if (goal.status === "OVERDUE" && goal.endDate && goal.endDate >= now) {
    newStatus = "ACTIVE";
  }

  if (newStatus !== goal.status) {
    await prisma.goal.update({
      where: { id: goalId },
      data: {
        status: newStatus,
        ...(newStatus === "COMPLETED" ? { completedAt: now } : {}),
        failedAt: null, // Clear failedAt when un-failing
        failureReason: null,
        lastActivityAt: now,
      },
    });
  }
};

async function cascadeStatus(parentId, status) {
  const now = new Date();

  // Get all descendant IDs recursively
  const allIds = [];
  async function collectIds(id) {
    const children = await prisma.goal.findMany({
      where: { parentId: id },
      select: { id: true },
    });
    for (const child of children) {
      allIds.push(child.id);
      await collectIds(child.id);
    }
  }
  await collectIds(parentId);

  if (allIds.length === 0) return;

  // Update all descendants with the same status
  const data = {
    status,
    lastActivityAt: now,
    ...(status === "COMPLETED" ? { completedAt: now, progress: 100 } : {}),
    ...(status === "FAILED" ? { failedAt: now } : {}),
    ...(status === "ARCHIVED" ? { archivedAt: now } : {}),
    ...(status === "ACTIVE"
      ? {
          completedAt: null,
          failedAt: null,
          archivedAt: null,
          failureReason: null,
        }
      : {}),
  };

  await prisma.goal.updateMany({
    where: { id: { in: allIds } },
    data,
  });
}

async function cascadeColor(parentId, color) {
  // Get direct children
  const children = await prisma.goal.findMany({
    where: { parentId },
    select: { id: true },
  });

  if (children.length === 0) return;

  // Update all direct children's color
  await prisma.goal.updateMany({
    where: { parentId },
    data: { color },
  });

  // Also update their tasks' colors
  for (const child of children) {
    await prisma.task.updateMany({
      where: { goalId: child.id },
      data: { color },
    });
  }

  // Recursively update deeper descendants
  for (const child of children) {
    await cascadeColor(child.id, color);
  }
}

// @desc    Get all goals for user (with hierarchy)
// @route   GET /api/goals

const getGoals = async (req, res) => {
  try {
    const { status, page, limit, sortBy, sortOrder, paginated } = req.query;

    // Check if pagination is disabled
    const isPaginated = paginated !== "false";

    // Build where clause
    const where = { userId: req.user.id };

    if (status) {
      const statuses = status.split(",").map((s) => s.trim());
      where.status = { in: statuses };
    }

    // Sorting
    const orderField = sortBy || "sortOrder";
    const orderDirection = sortOrder === "desc" ? "desc" : "asc";

    if (!isPaginated) {
      // ==========================================
      // NO PAGINATION - Return all results
      // ==========================================
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
        orderBy: [{ [orderField]: orderDirection }, { createdAt: "desc" }],
      });

      const enrichedGoals = goals.map(enrichGoal);

      return res.json(enrichedGoals); // Flat array, backward compatible
    }

    // ==========================================
    // PAGINATED - Return with metadata
    // ==========================================
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const total = await prisma.goal.count({ where });

    const goals = await prisma.goal.findMany({
      where,
      skip,
      take: limitNum,
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
      orderBy: [{ [orderField]: orderDirection }, { createdAt: "desc" }],
    });

    const enrichedGoals = goals.map(enrichGoal);

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      data: enrichedGoals,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
        nextPage: pageNum < totalPages ? pageNum + 1 : null,
        prevPage: pageNum > 1 ? pageNum - 1 : null,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Helper function to avoid code duplication
function enrichGoal(goal) {
  let totalTime = (goal.timeEntries || []).reduce(
    (sum, e) => sum + (e.duration || 0),
    0,
  );

  let combinedProgress = goal.progress || 0;
  if (goal.goalType === "time" && goal.targetValue) {
    const trackedInUnit =
      goal.unit === "minutes" ? totalTime / 60 : totalTime / 3600;
    combinedProgress = Math.min((trackedInUnit / goal.targetValue) * 100, 100);
  }

  let daysOverdue = null;
  if (goal.status === "OVERDUE" && goal.endDate) {
    daysOverdue = Math.floor(
      (new Date() - new Date(goal.endDate)) / (1000 * 60 * 60 * 24),
    );
  }

  return {
    ...goal,
    combinedProgress: Math.max(goal.progress, combinedProgress),
    daysOverdue,
    deadlineUrgent:
      goal.endDate &&
      goal.status === "ACTIVE" &&
      (new Date(goal.endDate) - new Date()) / (1000 * 60 * 60) < 48,
  };
}

// @desc    Get single goal
// @route   GET /api/goals/:id
const getGoal = async (req, res) => {
  try {
    await refreshGoalStatus(req.params.id);

    const goal = await prisma.goal.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        parent: { select: { id: true, status: true, title: true } },
        children: {
          include: {
            tasks: { select: { id: true } },
            children: { select: { id: true } },
          },
        },
        tasks: {
          include: {
            // ✅ Use include only
            checkIns: true,
            timeEntries: {
              where: { status: "COMPLETED" },
            },
          },
        },
        timeEntries: {
          where: { status: "COMPLETED" },
        },
      },
    });

    if (!goal) return res.status(404).json({ message: "Goal not found" });

    // Collect ALL descendant goal IDs (all levels)
    function getAllDescendantIds(g, ids = []) {
      if (g.children) {
        for (const child of g.children) {
          ids.push(child.id);
          getAllDescendantIds(child, ids);
        }
      }
      return ids;
    }

    const allDescendantIds = getAllDescendantIds(goal);

    // Collect all task IDs from this goal and all descendants
    const allTaskIds = [];
    function collectTaskIds(g) {
      if (g.tasks) allTaskIds.push(...g.tasks.map((t) => t.id));
      if (g.children) g.children.forEach(collectTaskIds);
    }
    collectTaskIds(goal);

    // Fetch ALL time entries:
    // 1. Directly linked to this goal or any descendant goal
    // 2. Linked to any task under this goal or descendants
    const allTimeEntries = await prisma.timeEntry.findMany({
      where: {
        status: "COMPLETED",
        OR: [
          { goalId: { in: [goal.id, ...allDescendantIds] } },
          { taskId: { in: allTaskIds } },
        ],
      },
      orderBy: { startTime: "desc" },
      include: {
        task: { select: { id: true, title: true } },
      },
    });

    // Deduplicate (a time entry might match both conditions)
    const uniqueEntries = [];
    const seenIds = new Set();
    for (const entry of allTimeEntries) {
      if (!seenIds.has(entry.id)) {
        seenIds.add(entry.id);
        uniqueEntries.push(entry);
      }
    }

    goal.allTimeEntries = uniqueEntries;
    goal.totalTimeSpent = uniqueEntries.reduce(
      (sum, e) => sum + (e.duration || 0),
      0,
    );

    // Progress calculation stays the same
    if (goal.goalType === "time" && goal.targetValue) {
      const totalSeconds = goal.totalTimeSpent || 0;
      const trackedInUnit =
        goal.unit === "minutes" ? totalSeconds / 60 : totalSeconds / 3600;
      goal.combinedProgress = Math.min(
        (trackedInUnit / goal.targetValue) * 100,
        100,
      );
    } else {
      goal.combinedProgress = goal.progress || 0;
    }

    goal.daysOverdue = null;
    if (goal.status === "OVERDUE" && goal.endDate) {
      goal.daysOverdue = Math.floor(
        (new Date() - new Date(goal.endDate)) / (1000 * 60 * 60 * 24),
      );
    }

    // Add formatted duration
    goal.totalTimeFormatted = {
      seconds: goal.totalTimeSpent,
      minutes: Math.round((goal.totalTimeSpent / 60) * 100) / 100,
      hours: Math.round((goal.totalTimeSpent / 3600) * 100) / 100,
    };

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

    const goalEndDate = endDate ? new Date(endDate) : null;

    // Determine initial status
    let initialStatus = "ACTIVE";
    const now = new Date();
    if (goalEndDate && goalEndDate < now) {
      initialStatus = "OVERDUE"; // Created with past end date
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
        endDate: goalEndDate,
        deadlineType: deadlineType || "HARD",
        status: initialStatus,
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

    const now = new Date();

    // ==========================================================================
    // RULE: FAILED goals are locked (only archive allowed)
    // ==========================================================================
    if (existingGoal.status === "FAILED") {
      const attemptedFields = Object.keys(req.body).filter(
        (k) => k !== "status",
      );

      if (req.body.status === "ARCHIVED") {
        // Allow archiving
      } else if (
        attemptedFields.length > 0 ||
        (req.body.status && req.body.status !== "FAILED")
      ) {
        return res.status(400).json({
          message:
            "Failed goals cannot be edited. Archive it or duplicate it to start fresh.",
        });
      }
    }

    // ==========================================================================
    // RULE: OVERDUE goals - only cosmetic edits + complete/fail allowed
    // ==========================================================================
    if (existingGoal.status === "OVERDUE") {
      const blockedFields = [
        "endDate",
        "targetValue",
        "targetMetric",
        "unit",
        "progress",
        "currentValue",
      ];
      const attemptedBlocked = Object.keys(req.body).filter((k) =>
        blockedFields.includes(k),
      );

      if (
        attemptedBlocked.length > 0 &&
        req.body.status !== "COMPLETED" &&
        req.body.status !== "FAILED"
      ) {
        return res.status(400).json({
          message: `Cannot edit ${attemptedBlocked.join(", ")} on an overdue goal. Mark it as completed, failed, or extend the due date first.`,
        });
      }

      if (req.body.endDate) {
        const newEndDate = new Date(req.body.endDate);
        if (newEndDate < now) {
          return res.status(400).json({
            message: "Cannot set end date in the past on an overdue goal.",
          });
        }
      }
    }

    // ==========================================================================
    // RULE: Cannot re-activate if parent is completed
    // ==========================================================================
    if (
      (req.body.status === "ACTIVE" || req.body.status === "OVERDUE") &&
      existingGoal.parentId
    ) {
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

    // ==========================================================================
    // RULE: Completing a goal requires all sub-goals and tasks done
    // ==========================================================================
    if (req.body.status === "COMPLETED") {
      const activeSubGoals = await prisma.goal.count({
        where: {
          parentId: req.params.id,
          status: { in: ["ACTIVE", "OVERDUE", "PAUSED"] },
        },
      });

      if (activeSubGoals > 0) {
        return res.status(400).json({
          message: `Cannot complete this goal. ${activeSubGoals} sub-goal(s) are still active.`,
        });
      }

      const activeTasks = await prisma.task.count({
        where: {
          goalId: req.params.id,
          status: { in: ["TODO", "IN_PROGRESS", "OVERDUE"] },
        },
      });

      if (activeTasks > 0) {
        return res.status(400).json({
          message: `Cannot complete this goal. ${activeTasks} task(s) are still pending.`,
        });
      }
    }

    // ==========================================================================
    // BUILD UPDATE DATA
    // ==========================================================================
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

    const updateData = {
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
      color,
      icon,
      sortOrder,
      progress,
      lastActivityAt: new Date(),
    };

    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    if (status) {
      updateData.status = status;

      if (status === "COMPLETED") {
        updateData.completedAt = new Date();
        updateData.failedAt = null;
        updateData.failureReason = null;
        if (existingGoal.status === "OVERDUE") {
          updateData.progress = 100;
          updateData.currentValue =
            existingGoal.targetValue || updateData.currentValue;
        }
      } else if (status === "FAILED") {
        updateData.failedAt = new Date();
        updateData.completedAt = null;
        updateData.failureReason = req.body.failureReason || "Manually failed";
      } else if (status === "ACTIVE" || status === "OVERDUE") {
        updateData.completedAt = null;
        updateData.failedAt = null;
        updateData.failureReason = null;
      } else if (status === "ARCHIVED") {
        updateData.archivedAt = new Date();
      }
    }

    const goal = await prisma.goal.update({
      where: { id: req.params.id },
      data: updateData,
    });

    // Cascade color to descendants
    if (req.body.color && req.body.color !== existingGoal.color) {
      await cascadeColor(req.params.id, req.body.color);
    }

    // ✅ Cascade status to all descendants (top-down only)
    if (
      status &&
      ["COMPLETED", "FAILED", "ARCHIVED", "ACTIVE"].includes(status)
    ) {
      await cascadeStatus(req.params.id, status);
    }

    await refreshGoalStatus(req.params.id);

    const refreshedGoal = await prisma.goal.findUnique({
      where: { id: req.params.id },
    });

    res.json(refreshedGoal);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// ==========================================================================
// CASCADE STATUS TO ALL DESCENDANTS
// ==========================================================================
async function cascadeStatus(parentId, status) {
  const now = new Date();

  // Collect all descendant IDs recursively
  const allIds = [];
  async function collectIds(id) {
    const children = await prisma.goal.findMany({
      where: { parentId: id },
      select: { id: true },
    });
    for (const child of children) {
      allIds.push(child.id);
      await collectIds(child.id);
    }
  }
  await collectIds(parentId);

  if (allIds.length === 0) return;

  const data = {
    status,
    lastActivityAt: now,
    ...(status === "COMPLETED" ? { completedAt: now, progress: 100 } : {}),
    ...(status === "FAILED" ? { failedAt: now } : {}),
    ...(status === "ARCHIVED" ? { archivedAt: now } : {}),
    ...(status === "ACTIVE"
      ? {
          completedAt: null,
          failedAt: null,
          archivedAt: null,
          failureReason: null,
        }
      : {}),
  };

  await prisma.goal.updateMany({
    where: { id: { in: allIds } },
    data,
  });
}

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
    const { orderedIds } = req.body;

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
          select: { id: true, status: true },
        },
        children: {
          select: {
            id: true,
            status: true,
            progress: true,
            tasks: { select: { id: true } },
            children: { select: { id: true } },
          },
        },
      },
    });

    if (!goal) return res.status(404).json({ message: "Goal not found" });

    // Collect all descendant IDs and task IDs
    function getAllDescendantIds(g, ids = []) {
      if (g.children) {
        for (const child of g.children) {
          ids.push(child.id);
          getAllDescendantIds(child, ids);
        }
      }
      return ids;
    }

    const allDescendantIds = getAllDescendantIds(goal);
    const allTaskIds = [];
    function collectTaskIds(g) {
      if (g.tasks) allTaskIds.push(...g.tasks.map((t) => t.id));
      if (g.children) g.children.forEach(collectTaskIds);
    }
    collectTaskIds(goal);

    // Get total time including sub-goals and their tasks
    const allTimeEntries = await prisma.timeEntry.findMany({
      where: {
        status: "COMPLETED",
        OR: [
          { goalId: { in: [goal.id, ...allDescendantIds] } },
          { taskId: { in: allTaskIds } },
        ],
      },
      select: { id: true, duration: true },
    });

    // Deduplicate
    const seenIds = new Set();
    const totalTimeSpent = allTimeEntries.reduce((sum, e) => {
      if (!seenIds.has(e.id)) {
        seenIds.add(e.id);
        return sum + (e.duration || 0);
      }
      return sum;
    }, 0);

    // Count all tasks recursively
    function countTasks(g) {
      let count = (g.tasks || []).length;
      if (g.children) {
        for (const child of g.children) {
          count += countTasks(child);
        }
      }
      return count;
    }

    const totalTasks = countTasks(goal);
    const completedTasks = 0; // Would need to count recursively

    res.json({
      totalTasks,
      completedTasks,
      totalTimeSpent,
      totalTimeFormatted: {
        seconds: totalTimeSpent,
        minutes: Math.round((totalTimeSpent / 60) * 100) / 100,
        hours: Math.round((totalTimeSpent / 3600) * 100) / 100,
      },
      progress: goal.progress,
      childGoalsCount: allDescendantIds.length,
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
