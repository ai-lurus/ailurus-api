/*
  Warnings:

  - Added the required column `updated_at` to the `tasks` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW();
ALTER TABLE "tasks" ALTER COLUMN "updated_at" DROP DEFAULT;
