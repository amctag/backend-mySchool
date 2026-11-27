ALTER TABLE "school"
ADD COLUMN IF NOT EXISTS "grades_visible_to_parents_and_students" BOOLEAN NOT NULL DEFAULT TRUE;
