// backend/routes/tasks.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  bulkCreateTasks,
  bulkUpdateTasks,
  bulkDeleteTasks,
} = require("../controllers/taskController");

router.use(auth);

// Bulk operations
router.post("/bulk", bulkCreateTasks);
router.put("/bulk", bulkUpdateTasks);
router.delete("/bulk", bulkDeleteTasks);

// Single operations
router.get("/", getTasks);
router.post("/", createTask);
router.put("/:id", updateTask);
router.delete("/:id", deleteTask);

module.exports = router;
