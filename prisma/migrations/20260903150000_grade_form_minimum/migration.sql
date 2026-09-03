-- Pass threshold for grade card result (ناجح / راسب)
ALTER TABLE "grade_form" ADD COLUMN IF NOT EXISTS "minimum" INTEGER NOT NULL DEFAULT 0;
