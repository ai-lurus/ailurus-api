/*
  Warnings:

  - Added the required column `updated_at` to the `training_paths` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('video', 'article', 'course', 'practice');

-- CreateEnum
CREATE TYPE "TopicStatus" AS ENUM ('pending', 'in_progress', 'completed');

-- AlterTable
ALTER TABLE "training_paths" ADD COLUMN     "assigned_by" TEXT,
ADD COLUMN     "career_path" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "due_date" TIMESTAMP(3),
ADD COLUMN     "generated_by_ai" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "title" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "learning_topics" (
    "id" TEXT NOT NULL,
    "training_path_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "resource_url" TEXT,
    "resource_type" "ResourceType" NOT NULL DEFAULT 'article',
    "order_index" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3),
    "status" "TopicStatus" NOT NULL DEFAULT 'pending',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_topics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "learning_topics_training_path_id_order_index_key" ON "learning_topics"("training_path_id", "order_index");

-- AddForeignKey
ALTER TABLE "training_paths" ADD CONSTRAINT "training_paths_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_topics" ADD CONSTRAINT "learning_topics_training_path_id_fkey" FOREIGN KEY ("training_path_id") REFERENCES "training_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;
