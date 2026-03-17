-- AlterTable
ALTER TABLE "daily_status" ADD COLUMN     "eod_blockers" TEXT,
ADD COLUMN     "eod_completed" TEXT,
ADD COLUMN     "eod_mood" "Mood",
ADD COLUMN     "eod_notes" TEXT,
ADD COLUMN     "eod_submitted_at" TIMESTAMP(3);
