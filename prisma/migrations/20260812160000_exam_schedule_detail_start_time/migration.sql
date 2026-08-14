DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'exam_schedule_details'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'exam_schedule_details'
      AND column_name = 'start_time'
  ) THEN
    ALTER TABLE "exam_schedule_details"
    ADD COLUMN "start_time" VARCHAR(10) NOT NULL DEFAULT '09:00';

    ALTER TABLE "exam_schedule_details"
    ALTER COLUMN "start_time" DROP DEFAULT;
  END IF;
END $$;
