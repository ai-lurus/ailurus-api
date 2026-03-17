-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'designer';

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'in_review';

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "pr_link" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by" TEXT;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
