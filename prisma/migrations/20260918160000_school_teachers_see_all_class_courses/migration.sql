ALTER TABLE "school"
ADD COLUMN IF NOT EXISTS "teachers_see_all_class_courses" BOOLEAN NOT NULL DEFAULT TRUE;
