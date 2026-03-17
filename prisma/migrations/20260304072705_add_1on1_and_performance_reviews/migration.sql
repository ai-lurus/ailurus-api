-- CreateTable
CREATE TABLE "one_on_one_notes" (
    "id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "session_date" DATE NOT NULL,
    "notes" TEXT NOT NULL,
    "strengths" TEXT,
    "improvements" TEXT,
    "agreements" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "one_on_one_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_reviews" (
    "id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "period_label" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "rating_technical" INTEGER,
    "rating_comms" INTEGER,
    "rating_autonomy" INTEGER,
    "rating_teamwork" INTEGER,
    "overall_rating" INTEGER,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "one_on_one_notes" ADD CONSTRAINT "one_on_one_notes_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_on_one_notes" ADD CONSTRAINT "one_on_one_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
