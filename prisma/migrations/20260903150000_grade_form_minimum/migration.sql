-- Pass threshold for grade card result (ناجح / راسب). Idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'grade_form'
      AND column_name = 'minimum'
  ) THEN
    ALTER TABLE "grade_form"
      ADD COLUMN "minimum" INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;
