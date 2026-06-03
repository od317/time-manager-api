const express = require("express");
const router = express.Router();
const prisma = require("../utils/prisma");
const auth = require("../middleware/auth");

router.use(auth);

router.get("/", async (req, res) => {
  try {
    const { status, goalId } = req.query;

    const where = { userId: req.user.id };

    // Only filter by status if explicitly provided
    if (status) {
      const statuses = Array.isArray(status) ? status : [status];
      where.status = { in: statuses };
    }
    // If no status provided, where.status is not set = returns ALL statuses

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

    res.json(tasks);
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

    const task = await prisma.task.create({
      data: {
        userId: req.user.id,
        goalId,
        title,
        description,
        priority: priority || "MEDIUM",
        color: taskColor,
        estimatedMinutes,
        dueDate: dueDate ? new Date(dueDate) : null,
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

    // Prepare update data
    const updateData = { ...req.body };

    // Convert date strings to Date objects
    if (updateData.dueDate === null || updateData.dueDate === "") {
      updateData.dueDate = null;
    } else if (updateData.dueDate && typeof updateData.dueDate === "string") {
      updateData.dueDate = new Date(updateData.dueDate);
    }

    if (updateData.completedAt) {
      updateData.completedAt = new Date(updateData.completedAt);
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

    res.json(updated);
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
