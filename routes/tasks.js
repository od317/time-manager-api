// backend/routes/tasks.js
const express = require("express");
const router = express.Router();
const prisma = require("../utils/prisma");
const auth = require("../middleware/auth");

router.use(auth);

// Helper: Refresh task status
const refreshTaskStatus = async (taskId) => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      status: true,
      dueDate: true,
      targetValue: true,
      currentValue: true,
    },
  });

  if (!task) return;

  const now = new Date();
  let newStatus = task.status;

  // Don't auto-change COMPLETED or FAILED tasks
  if (["COMPLETED", "FAILED"].includes(task.status)) {
    return;
  }

  // Check if task is complete
  if (task.targetValue && task.currentValue >= task.targetValue) {
    newStatus = "COMPLETED";
  }
  // TODO/IN_PROGRESS → OVERDUE
  else if (
    ["TODO", "IN_PROGRESS"].includes(task.status) &&
    task.dueDate &&
    task.dueDate < now
  ) {
    newStatus = "OVERDUE";
  }
  // OVERDUE → TODO/IN_PROGRESS: Due date extended to future
  else if (task.status === "OVERDUE" && task.dueDate && task.dueDate >= now) {
    newStatus = "IN_PROGRESS";
  }

  if (newStatus !== task.status) {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: newStatus,
        ...(newStatus === "COMPLETED" ? { completedAt: now } : {}),
        failedAt: null,
        failureReason: null,
      },
    });
  }
};

// Get all tasks
router.get("/", async (req, res) => {
  try {
    const { status, goalId } = req.query;

    const where = { userId: req.user.id };

    if (status) {
      const statuses = Array.isArray(status)
        ? status
        : status.split(",").map((s) => s.trim());
      where.status = { in: statuses };
    }

    if (goalId) {
      where.goalId = goalId;
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: {
        goal: {
          select: { id: true, title: true, color: true },
        },
      },
    });

    // Add days overdue for OVERDUE tasks
    const enrichedTasks = tasks.map((task) => ({
      ...task,
      daysOverdue:
        task.status === "OVERDUE" && task.dueDate
          ? Math.floor(
              (new Date() - new Date(task.dueDate)) / (1000 * 60 * 60 * 24),
            )
          : null,
    }));

    res.json(enrichedTasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Create task
router.post("/", async (req, res) => {
  try {
    const { title, description, goalId, priority, estimatedMinutes, dueDate } =
      req.body;

    if (goalId) {
      const goal = await prisma.goal.findFirst({
        where: { id: goalId, userId: req.user.id },
        select: { status: true, title: true },
      });

      if (!goal) {
        return res.status(404).json({ message: "Goal not found" });
      }

      if (goal.status === "COMPLETED") {
        return res.status(400).json({
          message: `Cannot add tasks to completed goal "${goal.title}".`,
        });
      }
    }

    // Get parent goal's color
    let taskColor = null;
    if (goalId) {
      const goal = await prisma.goal.findUnique({
        where: { id: goalId },
        select: { color: true },
      });
      taskColor = goal?.color || null;
    }

    const taskDueDate = dueDate ? new Date(dueDate) : null;

    // Determine initial status
    let initialStatus = "TODO";
    if (taskDueDate && taskDueDate < new Date()) {
      initialStatus = "OVERDUE";
    }

    const task = await prisma.task.create({
      data: {
        userId: req.user.id,
        goalId,
        title,
        description,
        priority: priority || "MEDIUM",
        color: taskColor,
        estimatedMinutes,
        dueDate: taskDueDate,
        status: initialStatus,
      },
    });

    res.status(201).json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update task
router.put("/:id", async (req, res) => {
  try {
    const task = await prisma.task.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const updateData = { ...req.body };

    // Convert date strings
    if (updateData.dueDate === null || updateData.dueDate === "") {
      updateData.dueDate = null;
    } else if (updateData.dueDate && typeof updateData.dueDate === "string") {
      updateData.dueDate = new Date(updateData.dueDate);
    }

    if (updateData.completedAt) {
      updateData.completedAt = new Date(updateData.completedAt);
    }

    // Handle status changes
    if (updateData.status) {
      if (updateData.status === "COMPLETED") {
        updateData.completedAt = new Date();
        updateData.failedAt = null;
        updateData.failureReason = null;
      } else if (updateData.status === "FAILED") {
        updateData.failedAt = new Date();
        updateData.completedAt = null;
      } else if (
        ["TODO", "IN_PROGRESS", "OVERDUE"].includes(updateData.status)
      ) {
        updateData.completedAt = null;
        updateData.failedAt = null;
        updateData.failureReason = null;
      }
    }

    // Remove undefined values
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const updated = await prisma.task.update({
      where: { id: req.params.id },
      data: updateData,
    });

    // Refresh status
    await refreshTaskStatus(req.params.id);

    // Return refreshed task
    const refreshedTask = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        goal: { select: { id: true, title: true, color: true } },
      },
    });

    res.json(refreshedTask);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete task
router.delete("/:id", async (req, res) => {
  try {
    const task = await prisma.task.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    await prisma.task.delete({ where: { id: req.params.id } });

    res.json({ message: "Task deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
