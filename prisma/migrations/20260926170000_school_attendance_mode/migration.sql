-- Single attendance mode: school | teacher | teacher_course
ALTER TABLE "school"
ADD COLUMN IF NOT EXISTS "attendance_mode" VARCHAR(32) NOT NULL DEFAULT 'school';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'school'
      AND column_name = 'teachers_can_take_attendance'
  ) THEN
    UPDATE "school"
    SET "attendance_mode" = CASE
      WHEN "teachers_can_take_attendance" = false THEN 'school'
      WHEN "attendance_per_course" = true THEN 'teacher_course'
      ELSE 'teacher'
    END;
    ALTER TABLE "school" DROP COLUMN "teachers_can_take_attendance";
  ELSE
    -- Preserve previous two-mode behavior for schools that already used attendance_per_course.
    UPDATE "school"
    SET "attendance_mode" = CASE
      WHEN "attendance_per_course" = true THEN 'teacher_course'
      ELSE 'teacher'
    END
    WHERE "attendance_mode" = 'school';
  END IF;
END $$;
