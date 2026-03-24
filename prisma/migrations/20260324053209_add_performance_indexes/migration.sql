-- CreateIndex
CREATE INDEX "tasks_project_id_idx" ON "tasks"("project_id");

-- CreateIndex
CREATE INDEX "tasks_assigned_to_idx" ON "tasks"("assigned_to");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_sprint_id_idx" ON "tasks"("sprint_id");

-- CreateIndex
CREATE INDEX "tasks_project_id_status_idx" ON "tasks"("project_id", "status");

-- CreateIndex
CREATE INDEX "tasks_assigned_to_status_idx" ON "tasks"("assigned_to", "status");

-- CreateIndex
CREATE INDEX "tasks_updated_at_idx" ON "tasks"("updated_at");

-- CreateIndex
CREATE INDEX "training_paths_user_id_idx" ON "training_paths"("user_id");

-- CreateIndex
CREATE INDEX "user_battle_progress_user_id_topic_id_idx" ON "user_battle_progress"("user_id", "topic_id");
