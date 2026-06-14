// backend/controllers/taskController.js
const prisma = require("../utils/prisma");

// Helper: Refresh task status
const refreshTaskStatus = async (taskId, userDate) => {
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

  const now = userDate
    ? new Date(userDate + "T00:00:00.000Z")
    : new Date(new Date().toISOString().split("T")[0] + "T00:00:00.000Z");

  let newStatus = task.status;
  if (["COMPLETED", "FAILED"].includes(task.status)) return;
  if (task.targetValue && task.currentValue >= task.targetValue)
    newStatus = "COMPLETED";
  else if (
    ["TODO", "IN_PROGRESS"].includes(task.status) &&
    task.dueDate &&
    task.dueDate < now
  )
    newStatus = "OVERDUE";
  else if (task.status === "OVERDUE" && task.dueDate && task.dueDate >= now)
    newStatus = "IN_PROGRESS";

  if (newStatus !== task.status) {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: newStatus,
        ...(newStatus === "COMPLETED" ? { completedAt: new Date() } : {}),
        failedAt: null,
        failureReason: null,
      },
    });
  }
};

// ============================================================================
// GET ALL TASKS
// ============================================================================
const getTasks = async (req, res) => {
  try {
    const { status, goalId, date } = req.query;
    const userToday = date
      ? new Date(date + "T00:00:00.000Z")
      : new Date(new Date().toISOString().split("T")[0] + "T00:00:00.000Z");

    const where = { userId: req.user.id };
    if (status) {
      const statuses = status.split(",").map((s) => s.trim());
      where.status = { in: statuses };
    }
    if (goalId) where.goalId = goalId;

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: { goal: { select: { id: true, title: true, color: true } } },
    });

    const enrichedTasks = tasks.map((task) => ({
      ...task,
      daysOverdue:
        task.status === "OVERDUE" && task.dueDate
          ? Math.floor(
              (userToday - new Date(task.dueDate)) / (1000 * 60 * 60 * 24),
            )
          : null,
    }));

    res.json(enrichedTasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// ============================================================================
// CREATE TASK
// ============================================================================
const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      goalId,
      priority,
      estimatedMinutes,
      dueDate,
      date,
    } = req.body;

    if (goalId) {
      const goal = await prisma.goal.findFirst({
        where: { id: goalId, userId: req.user.id },
        select: { status: true, title: true },
      });
      if (!goal) return res.status(404).json({ message: "Goal not found" });
      if (goal.status === "COMPLETED") {
        return res.status(400).json({
          message: `Cannot add tasks to completed goal "${goal.title}".`,
        });
      }
    }

    let taskColor = null;
    if (goalId) {
      const goal = await prisma.goal.findUnique({
        where: { id: goalId },
        select: { color: true },
      });
      taskColor = goal?.color || null;
    }

    let taskDueDate = null;
    if (dueDate) {
      taskDueDate = dueDate.includes("T")
        ? new Date(dueDate)
        : new Date(dueDate + "T00:00:00.000Z");
      if (isNaN(taskDueDate.getTime()))
        return res.status(400).json({ message: "Invalid due date format" });
    }

    const userToday = date
      ? new Date(date + "T00:00:00.000Z")
      : new Date(new Date().toISOString().split("T")[0] + "T00:00:00.000Z");

    let initialStatus = "TODO";
    if (taskDueDate && taskDueDate < userToday) initialStatus = "OVERDUE";

    const task = await prisma.task.create({
      data: {
        userId: req.user.id,
        goalId,
        title,
        description,
        priority: priority || "MEDIUM",
        color: taskColor,
        estimatedMinutes: estimatedMinutes || null,
        dueDate: taskDueDate,
        status: initialStatus,
      },
    });

    res.status(201).json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// ============================================================================
// UPDATE TASK
// ============================================================================
const updateTask = async (req, res) => {
  try {
    const task = await prisma.task.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!task) return res.status(404).json({ message: "Task not found" });

    const { date, dueDate, completedAt, status, ...rest } = req.body;
    const updateData = { ...rest };

    if (dueDate === null || dueDate === "") {
      updateData.dueDate = null;
    } else if (dueDate !== undefined) {
      if (typeof dueDate === "string") {
        updateData.dueDate = dueDate.includes("T")
          ? new Date(dueDate)
          : new Date(dueDate + "T00:00:00.000Z");
        if (isNaN(updateData.dueDate.getTime()))
          return res.status(400).json({ message: "Invalid due date format" });
      }
    }

    if (completedAt) updateData.completedAt = new Date(completedAt);

    if (status) {
      if (status === "COMPLETED") {
        updateData.completedAt = new Date();
        updateData.failedAt = null;
        updateData.failureReason = null;
      } else if (status === "FAILED") {
        updateData.failedAt = new Date();
        updateData.completedAt = null;
      } else if (["TODO", "IN_PROGRESS", "OVERDUE"].includes(status)) {
        updateData.completedAt = null;
        updateData.failedAt = null;
        updateData.failureReason = null;
      }
      updateData.status = status;
    }

    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    const updated = await prisma.task.update({
      where: { id: req.params.id },
      data: updateData,
    });
    await refreshTaskStatus(req.params.id, date);

    const refreshedTask = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: { goal: { select: { id: true, title: true, color: true } } },
    });

    res.json(refreshedTask);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// ============================================================================
// DELETE TASK
// ============================================================================
const deleteTask = async (req, res) => {
  try {
    const task = await prisma.task.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!task) return res.status(404).json({ message: "Task not found" });

    await prisma.task.delete({ where: { id: req.params.id } });
    res.json({ message: "Task deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// ============================================================================
// BULK CREATE TASKS
// ============================================================================
const bulkCreateTasks = async (req, res) => {
  try {
    const { tasks, date } = req.body;
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ message: "Tasks array is required" });
    }

    const userToday = date
      ? new Date(date + "T00:00:00.000Z")
      : new Date(new Date().toISOString().split("T")[0] + "T00:00:00.000Z");

    const created = await Promise.all(
      tasks.map(async (t) => {
        let taskColor = null;
        if (t.goalId) {
          const goal = await prisma.goal.findUnique({
            where: { id: t.goalId },
            select: { color: true },
          });
          taskColor = goal?.color || null;
        }

        let taskDueDate = null;
        if (t.dueDate) {
          taskDueDate = t.dueDate.includes("T")
            ? new Date(t.dueDate)
            : new Date(t.dueDate + "T00:00:00.000Z");
        }

        let initialStatus = "TODO";
        if (taskDueDate && taskDueDate < userToday) initialStatus = "OVERDUE";

        return prisma.task.create({
          data: {
            userId: req.user.id,
            goalId: t.goalId || null,
            title: t.title,
            description: t.description || null,
            priority: t.priority || "MEDIUM",
            color: taskColor,
            estimatedMinutes: t.estimatedMinutes || null,
            dueDate: taskDueDate,
            status: initialStatus,
          },
        });
      }),
    );

    res.status(201).json(created);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// ============================================================================
// BULK UPDATE TASKS (complete/uncomplete)
// ============================================================================
const bulkUpdateTasks = async (req, res) => {
  try {
    const { taskIds, status, date } = req.body;
    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ message: "taskIds array is required" });
    }
    if (!status || !["COMPLETED", "TODO", "IN_PROGRESS"].includes(status)) {
      return res.status(400).json({
        message: "Valid status is required (COMPLETED, TODO, IN_PROGRESS)",
      });
    }

    const now = new Date();

    const result = await prisma.task.updateMany({
      where: { id: { in: taskIds }, userId: req.user.id },
      data: {
        status,
        ...(status === "COMPLETED"
          ? { completedAt: now, failedAt: null, failureReason: null }
          : {}),
        ...(status === "TODO" || status === "IN_PROGRESS"
          ? { completedAt: null, failedAt: null, failureReason: null }
          : {}),
      },
    });

    // Refresh status for each updated task
    for (const id of taskIds) {
      await refreshTaskStatus(id, date);
    }

    res.json({
      message: `${result.count} tasks updated to ${status}`,
      count: result.count,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// ============================================================================
// BULK DELETE TASKS
// ============================================================================
const bulkDeleteTasks = async (req, res) => {
  try {
    console.log("Bulk delete body:", JSON.stringify(req.body)); // ← Debug
    console.log("Body type:", typeof req.body);

    const taskIds = Array.isArray(req.body) ? req.body : req.body?.taskIds;

    console.log("Parsed taskIds:", taskIds); // ← Debug

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({
        message: "taskIds array is required",
        received: req.body,
      });
    }

    const result = await prisma.task.deleteMany({
      where: { id: { in: taskIds }, userId: req.user.id },
    });

    res.json({ message: `${result.count} tasks deleted`, count: result.count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  bulkCreateTasks,
  bulkUpdateTasks,
  bulkDeleteTasks,
};
