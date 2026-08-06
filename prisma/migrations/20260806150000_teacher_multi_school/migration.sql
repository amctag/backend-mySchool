-- Teachers can work in multiple schools via teacher_schools.
CREATE TABLE "teacher_schools" (
    "id" SERIAL NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "school_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "teacher_schools_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "teacher_schools_teacher_id_school_id_key"
ON "teacher_schools"("teacher_id", "school_id");

ALTER TABLE "teacher_schools"
ADD CONSTRAINT "teacher_schools_teacher_id_fkey"
FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "teacher_schools"
ADD CONSTRAINT "teacher_schools_school_id_fkey"
FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill schools from existing teach assignments.
INSERT INTO "teacher_schools" ("teacher_id", "school_id", "is_active", "created_at", "updated_at")
SELECT DISTINCT t."id", sec."school_id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "teachers" AS t
INNER JOIN "teach" AS te ON te."teacher_id" = t."id"
INNER JOIN "sections" AS sec ON sec."id" = te."section_id"
ON CONFLICT ("teacher_id", "school_id") DO NOTHING;

-- Backfill from person.school_id when set.
INSERT INTO "teacher_schools" ("teacher_id", "school_id", "is_active", "created_at", "updated_at")
SELECT t."id", p."school_id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "teachers" AS t
INNER JOIN "persons" AS p ON p."id" = t."person_id"
WHERE p."school_id" IS NOT NULL
ON CONFLICT ("teacher_id", "school_id") DO NOTHING;

-- Teacher accounts are global when not also a student.
UPDATE "persons" AS p
SET "school_id" = NULL
WHERE EXISTS (SELECT 1 FROM "teachers" AS t WHERE t."person_id" = p."id")
  AND NOT EXISTS (SELECT 1 FROM "students" AS s WHERE s."person_id" = p."id");
