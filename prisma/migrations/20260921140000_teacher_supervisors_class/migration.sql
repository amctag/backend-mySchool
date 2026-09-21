DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'teacher_supervisors'
  ) THEN
    CREATE TABLE "teacher_supervisors" (
      "id" SERIAL NOT NULL,
      "teacher_id" INTEGER NOT NULL,
      "class_id" INTEGER NOT NULL,
      "year_id" INTEGER NOT NULL,
      "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "teacher_supervisors_pkey" PRIMARY KEY ("id")
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'teacher_supervisors'
      AND column_name = 'class_id'
  ) THEN
    ALTER TABLE "teacher_supervisors" ADD COLUMN "class_id" INTEGER;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'teacher_supervisors'
      AND column_name = 'section_id'
  ) THEN
    UPDATE "teacher_supervisors" AS ts
    SET "class_id" = s."class_id"
    FROM "sections" AS s
    WHERE ts."section_id" = s."id"
      AND ts."class_id" IS NULL;

    ALTER TABLE "teacher_supervisors"
      DROP CONSTRAINT IF EXISTS "teacher_supervisors_section_id_fkey";
    DROP INDEX IF EXISTS "teacher_supervisors_teacher_id_section_id_year_id_key";
    DROP INDEX IF EXISTS "teacher_supervisors_section_id_year_id_idx";
    ALTER TABLE "teacher_supervisors" DROP COLUMN "section_id";
  END IF;
END $$;

DELETE FROM "teacher_supervisors"
WHERE "class_id" IS NULL;

DELETE FROM "teacher_supervisors" AS ts
WHERE ts."id" NOT IN (
  SELECT MIN(inner_ts."id")
  FROM "teacher_supervisors" AS inner_ts
  WHERE inner_ts."class_id" IS NOT NULL
  GROUP BY inner_ts."teacher_id", inner_ts."class_id", inner_ts."year_id"
);

ALTER TABLE "teacher_supervisors" ALTER COLUMN "class_id" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "teacher_supervisors_teacher_id_class_id_year_id_key"
ON "teacher_supervisors"("teacher_id", "class_id", "year_id");

CREATE INDEX IF NOT EXISTS "teacher_supervisors_teacher_id_year_id_idx"
ON "teacher_supervisors"("teacher_id", "year_id");

CREATE INDEX IF NOT EXISTS "teacher_supervisors_class_id_year_id_idx"
ON "teacher_supervisors"("class_id", "year_id");

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
    SELECT 1 FROM pg_constraint WHERE conname = 'teacher_supervisors_class_id_fkey'
  ) THEN
    ALTER TABLE "teacher_supervisors"
      ADD CONSTRAINT "teacher_supervisors_class_id_fkey"
      FOREIGN KEY ("class_id") REFERENCES "classes"("id")
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
