ALTER TABLE "school"
ADD COLUMN IF NOT EXISTS "attendance_per_course" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "attendance"
ALTER COLUMN "section_id" DROP NOT NULL;

ALTER TABLE "attendance"
ADD COLUMN IF NOT EXISTS "course_id" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_course_id_fkey'
  ) THEN
    ALTER TABLE "attendance"
      ADD CONSTRAINT "attendance_course_id_fkey"
      FOREIGN KEY ("course_id") REFERENCES "courses"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "attendance_section_id_course_id_date_idx"
  ON "attendance"("section_id", "course_id", "date");

CREATE INDEX IF NOT EXISTS "attendance_course_id_date_idx"
  ON "attendance"("course_id", "date");

CREATE UNIQUE INDEX IF NOT EXISTS "attendance_section_date_class_uidx"
  ON "attendance"("section_id", "date")
  WHERE "deleted_at" IS NULL AND "course_id" IS NULL AND "section_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "attendance_section_course_date_uidx"
  ON "attendance"("section_id", "course_id", "date")
  WHERE "deleted_at" IS NULL AND "course_id" IS NOT NULL AND "section_id" IS NOT NULL;
