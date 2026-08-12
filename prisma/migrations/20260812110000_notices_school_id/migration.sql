-- Add school_id to notices for existing databases.

ALTER TABLE "notices"
ADD COLUMN IF NOT EXISTS "school_id" INTEGER;

UPDATE "notices" AS notice_row
SET "school_id" = section_target."school_id"
FROM (
  SELECT DISTINCT ON (notice_section."notice_id")
    notice_section."notice_id",
    section_row."school_id"
  FROM "notice_sections" AS notice_section
  INNER JOIN "sections" AS section_row
    ON section_row."id" = notice_section."section_id"
  WHERE notice_section."deleted_at" IS NULL
  ORDER BY notice_section."notice_id", notice_section."id"
) AS section_target
WHERE notice_row."id" = section_target."notice_id"
  AND notice_row."school_id" IS NULL;

UPDATE "notices" AS notice_row
SET "school_id" = student_target."school_id"
FROM (
  SELECT DISTINCT ON (notice_student."notice_id")
    notice_student."notice_id",
    person_row."school_id"
  FROM "notice_students" AS notice_student
  INNER JOIN "students" AS student_row
    ON student_row."id" = notice_student."student_id"
  INNER JOIN "persons" AS person_row
    ON person_row."id" = student_row."person_id"
  WHERE notice_student."deleted_at" IS NULL
    AND person_row."school_id" IS NOT NULL
  ORDER BY notice_student."notice_id", notice_student."id"
) AS student_target
WHERE notice_row."id" = student_target."notice_id"
  AND notice_row."school_id" IS NULL;

UPDATE "notices"
SET "school_id" = (
  SELECT "id"
  FROM "school"
  ORDER BY "id"
  LIMIT 1
)
WHERE "school_id" IS NULL
  AND EXISTS (SELECT 1 FROM "school");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notices'
      AND column_name = 'school_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM "notices"
    WHERE "school_id" IS NULL
  ) THEN
    ALTER TABLE "notices"
    ALTER COLUMN "school_id" SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notices_school_id_fkey'
  ) THEN
    ALTER TABLE "notices"
    ADD CONSTRAINT "notices_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
