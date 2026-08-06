-- Parents are global: they can have children (students) in different schools.
ALTER TABLE "persons" ALTER COLUMN "school_id" DROP NOT NULL;

-- Parent accounts without a school must still have globally unique usernames.
CREATE UNIQUE INDEX "persons_username_no_school_key"
ON "persons"("username")
WHERE "school_id" IS NULL;

-- Clear school_id for parent-only accounts (not teachers/students).
UPDATE "persons" AS p
SET "school_id" = NULL
WHERE EXISTS (SELECT 1 FROM "parents" AS par WHERE par."person_id" = p."id")
  AND NOT EXISTS (SELECT 1 FROM "students" AS s WHERE s."person_id" = p."id")
  AND NOT EXISTS (SELECT 1 FROM "teachers" AS t WHERE t."person_id" = p."id");
