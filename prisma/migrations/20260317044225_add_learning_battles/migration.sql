-- CreateTable
CREATE TABLE "avatar_configs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT 'round',
    "head" TEXT NOT NULL DEFAULT 'round',
    "primary_color" TEXT NOT NULL DEFAULT '#6366f1',
    "secondary_color" TEXT NOT NULL DEFAULT '#a5b4fc',
    "accent_color" TEXT NOT NULL DEFAULT '#fbbf24',
    "accessory" TEXT NOT NULL DEFAULT 'none',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "avatar_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enemy_images" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enemy_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_topics" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT NOT NULL DEFAULT '📚',
    "order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "battle_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_fights" (
    "id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "questions_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battle_fights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_learning_paths" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "battle_learning_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_path_topics" (
    "id" TEXT NOT NULL,
    "path_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,

    CONSTRAINT "battle_path_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_battle_paths" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "path_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_battle_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_battle_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "battle_id" TEXT NOT NULL,
    "enemy_image_id" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_battle_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "avatar_configs_user_id_key" ON "avatar_configs"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "enemy_images_filename_key" ON "enemy_images"("filename");

-- CreateIndex
CREATE UNIQUE INDEX "battle_fights_topic_id_order_key" ON "battle_fights"("topic_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "battle_path_topics_path_id_topic_id_key" ON "battle_path_topics"("path_id", "topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_battle_paths_user_id_path_id_key" ON "user_battle_paths"("user_id", "path_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_battle_progress_user_id_battle_id_key" ON "user_battle_progress"("user_id", "battle_id");

-- AddForeignKey
ALTER TABLE "avatar_configs" ADD CONSTRAINT "avatar_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_fights" ADD CONSTRAINT "battle_fights_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "battle_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_learning_paths" ADD CONSTRAINT "battle_learning_paths_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_path_topics" ADD CONSTRAINT "battle_path_topics_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "battle_learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_path_topics" ADD CONSTRAINT "battle_path_topics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "battle_topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_battle_paths" ADD CONSTRAINT "user_battle_paths_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_battle_paths" ADD CONSTRAINT "user_battle_paths_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "battle_learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_battle_progress" ADD CONSTRAINT "user_battle_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_battle_progress" ADD CONSTRAINT "user_battle_progress_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "battle_topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_battle_progress" ADD CONSTRAINT "user_battle_progress_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battle_fights"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_battle_progress" ADD CONSTRAINT "user_battle_progress_enemy_image_id_fkey" FOREIGN KEY ("enemy_image_id") REFERENCES "enemy_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;
