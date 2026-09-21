ALTER TABLE "teacher_supervisors" ADD COLUMN IF NOT EXISTS "class_id" INTEGER;

UPDATE "teacher_supervisors" AS ts
SET "class_id" = s."class_id"
FROM "sections" AS s
WHERE ts."section_id" IS NOT NULL
  AND s."id" = ts."section_id"
  AND ts."class_id" IS NULL;

DELETE FROM "teacher_supervisors" AS a
USING "teacher_supervisors" AS b
WHERE a."id" > b."id"
  AND a."teacher_id" = b."teacher_id"
  AND a."class_id" IS NOT DISTINCT FROM b."class_id"
  AND a."year_id" = b."year_id";

DELETE FROM "teacher_supervisors" WHERE "class_id" IS NULL;

ALTER TABLE "teacher_supervisors" ALTER COLUMN "class_id" SET NOT NULL;

ALTER TABLE "teacher_supervisors" DROP CONSTRAINT IF EXISTS "teacher_supervisors_section_id_fkey";
DROP INDEX IF EXISTS "teacher_supervisors_teacher_id_section_id_year_id_key";
DROP INDEX IF EXISTS "teacher_supervisors_section_id_year_id_idx";

ALTER TABLE "teacher_supervisors" DROP COLUMN IF EXISTS "section_id";

CREATE UNIQUE INDEX IF NOT EXISTS "teacher_supervisors_teacher_id_class_id_year_id_key"
ON "teacher_supervisors"("teacher_id", "class_id", "year_id");

CREATE INDEX IF NOT EXISTS "teacher_supervisors_class_id_year_id_idx"
ON "teacher_supervisors"("class_id", "year_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teacher_supervisors_class_id_fkey'
  ) THEN
    ALTER TABLE "teacher_supervisors"
      ADD CONSTRAINT "teacher_supervisors_class_id_fkey"
      FOREIGN KEY ("class_id") REFERENCES "classes"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
