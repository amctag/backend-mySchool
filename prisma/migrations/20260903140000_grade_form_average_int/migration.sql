-- Convert grade_form.average from boolean to integer (true -> 1, false -> 0).
-- Idempotent: safe if already integer or partially applied.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'grade_form'
      AND column_name = 'average'
      AND data_type = 'boolean'
  ) THEN
    ALTER TABLE "grade_form" ALTER COLUMN "average" DROP DEFAULT;
    ALTER TABLE "grade_form"
      ALTER COLUMN "average" TYPE INTEGER
      USING (CASE WHEN "average" THEN 1 ELSE 0 END);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'grade_form'
      AND column_name = 'average'
      AND data_type IN ('integer', 'smallint', 'bigint')
  ) THEN
    ALTER TABLE "grade_form" ALTER COLUMN "average" SET DEFAULT 0;
    UPDATE "grade_form" SET "average" = 0 WHERE "average" IS NULL;
    ALTER TABLE "grade_form" ALTER COLUMN "average" SET NOT NULL;
  END IF;
END $$;
