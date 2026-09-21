CREATE TABLE IF NOT EXISTS "teacher_supervisors" (
    "id" SERIAL NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "section_id" INTEGER NOT NULL,
    "year_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_supervisors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "teacher_supervisors_teacher_id_section_id_year_id_key"
ON "teacher_supervisors"("teacher_id", "section_id", "year_id");

CREATE INDEX IF NOT EXISTS "teacher_supervisors_teacher_id_year_id_idx"
ON "teacher_supervisors"("teacher_id", "year_id");

CREATE INDEX IF NOT EXISTS "teacher_supervisors_section_id_year_id_idx"
ON "teacher_supervisors"("section_id", "year_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teacher_supervisors_teacher_id_fkey'
  ) THEN
    ALTER TABLE "teacher_supervisors"
      ADD CONSTRAINT "teacher_supervisors_teacher_id_fkey"
      FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teacher_supervisors_section_id_fkey'
  ) THEN
    ALTER TABLE "teacher_supervisors"
      ADD CONSTRAINT "teacher_supervisors_section_id_fkey"
      FOREIGN KEY ("section_id") REFERENCES "sections"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teacher_supervisors_year_id_fkey'
  ) THEN
    ALTER TABLE "teacher_supervisors"
      ADD CONSTRAINT "teacher_supervisors_year_id_fkey"
      FOREIGN KEY ("year_id") REFERENCES "years"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
