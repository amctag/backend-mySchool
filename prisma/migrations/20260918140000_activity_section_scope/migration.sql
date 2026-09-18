-- Scope activities to class sections and optional courses.
ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "course_id" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activities_course_id_fkey'
  ) THEN
    ALTER TABLE "activities"
      ADD CONSTRAINT "activities_course_id_fkey"
      FOREIGN KEY ("course_id") REFERENCES "courses"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "activities_course_id_idx" ON "activities"("course_id");

CREATE TABLE IF NOT EXISTS "activity_sections" (
  "id" SERIAL NOT NULL,
  "activity_id" INTEGER NOT NULL,
  "section_id" INTEGER NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_sections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "activity_sections_activity_id_section_id_key"
  ON "activity_sections"("activity_id", "section_id");

CREATE INDEX IF NOT EXISTS "activity_sections_section_id_idx"
  ON "activity_sections"("section_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activity_sections_activity_id_fkey'
  ) THEN
    ALTER TABLE "activity_sections"
      ADD CONSTRAINT "activity_sections_activity_id_fkey"
      FOREIGN KEY ("activity_id") REFERENCES "activities"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activity_sections_section_id_fkey'
  ) THEN
    ALTER TABLE "activity_sections"
      ADD CONSTRAINT "activity_sections_section_id_fkey"
      FOREIGN KEY ("section_id") REFERENCES "sections"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
