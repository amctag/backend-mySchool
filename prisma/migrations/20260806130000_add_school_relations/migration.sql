-- Default school for existing rows
INSERT INTO "school" ("name", "is_active", "created_at", "updated_at")
SELECT 'Default School', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "school" LIMIT 1);

-- Add school_id columns
ALTER TABLE "persons" ADD COLUMN "school_id" INTEGER;
ALTER TABLE "years" ADD COLUMN "school_id" INTEGER;
ALTER TABLE "stages" ADD COLUMN "school_id" INTEGER;
ALTER TABLE "section_titles" ADD COLUMN "school_id" INTEGER;
ALTER TABLE "sections" ADD COLUMN "school_id" INTEGER;
ALTER TABLE "courses" ADD COLUMN "school_id" INTEGER;
ALTER TABLE "days" ADD COLUMN "school_id" INTEGER;
ALTER TABLE "sessions" ADD COLUMN "school_id" INTEGER;

-- Backfill existing data
UPDATE "persons" SET "school_id" = (SELECT "id" FROM "school" ORDER BY "id" LIMIT 1) WHERE "school_id" IS NULL;
UPDATE "years" SET "school_id" = (SELECT "id" FROM "school" ORDER BY "id" LIMIT 1) WHERE "school_id" IS NULL;
UPDATE "stages" SET "school_id" = (SELECT "id" FROM "school" ORDER BY "id" LIMIT 1) WHERE "school_id" IS NULL;
UPDATE "section_titles" SET "school_id" = (SELECT "id" FROM "school" ORDER BY "id" LIMIT 1) WHERE "school_id" IS NULL;
UPDATE "sections" SET "school_id" = (SELECT "id" FROM "school" ORDER BY "id" LIMIT 1) WHERE "school_id" IS NULL;
UPDATE "courses" SET "school_id" = (SELECT "id" FROM "school" ORDER BY "id" LIMIT 1) WHERE "school_id" IS NULL;
UPDATE "days" SET "school_id" = (SELECT "id" FROM "school" ORDER BY "id" LIMIT 1) WHERE "school_id" IS NULL;
UPDATE "sessions" SET "school_id" = (SELECT "id" FROM "school" ORDER BY "id" LIMIT 1) WHERE "school_id" IS NULL;

-- Make school_id required
ALTER TABLE "persons" ALTER COLUMN "school_id" SET NOT NULL;
ALTER TABLE "years" ALTER COLUMN "school_id" SET NOT NULL;
ALTER TABLE "stages" ALTER COLUMN "school_id" SET NOT NULL;
ALTER TABLE "section_titles" ALTER COLUMN "school_id" SET NOT NULL;
ALTER TABLE "sections" ALTER COLUMN "school_id" SET NOT NULL;
ALTER TABLE "courses" ALTER COLUMN "school_id" SET NOT NULL;
ALTER TABLE "days" ALTER COLUMN "school_id" SET NOT NULL;
ALTER TABLE "sessions" ALTER COLUMN "school_id" SET NOT NULL;

-- Replace global unique constraints with per-school uniques
DROP INDEX IF EXISTS "persons_username_key";
DROP INDEX IF EXISTS "years_title_key";
DROP INDEX IF EXISTS "section_titles_title_key";

CREATE UNIQUE INDEX "persons_school_id_username_key" ON "persons"("school_id", "username");
CREATE UNIQUE INDEX "years_school_id_title_key" ON "years"("school_id", "title");
CREATE UNIQUE INDEX "section_titles_school_id_title_key" ON "section_titles"("school_id", "title");

-- Foreign keys
ALTER TABLE "persons" ADD CONSTRAINT "persons_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "years" ADD CONSTRAINT "years_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stages" ADD CONSTRAINT "stages_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "section_titles" ADD CONSTRAINT "section_titles_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sections" ADD CONSTRAINT "sections_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "courses" ADD CONSTRAINT "courses_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "days" ADD CONSTRAINT "days_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
