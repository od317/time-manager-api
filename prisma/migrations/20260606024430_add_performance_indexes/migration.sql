-- CreateIndex
CREATE INDEX "Goal_userId_status_priority_idx" ON "Goal"("userId", "status", "priority");

-- CreateIndex
CREATE INDEX "Goal_userId_status_endDate_idx" ON "Goal"("userId", "status", "endDate");

-- CreateIndex
CREATE INDEX "Habit_userId_status_frequencyType_idx" ON "Habit"("userId", "status", "frequencyType");

-- CreateIndex
CREATE INDEX "Task_userId_status_dueDate_idx" ON "Task"("userId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Task_userId_status_priority_dueDate_idx" ON "Task"("userId", "status", "priority", "dueDate");

-- CreateIndex
CREATE INDEX "TimeEntry_userId_status_idx" ON "TimeEntry"("userId", "status");
