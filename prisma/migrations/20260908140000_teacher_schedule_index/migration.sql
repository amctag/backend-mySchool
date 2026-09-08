-- Speeds up teacher "my schedule" lookups by section timetable + course.
CREATE INDEX IF NOT EXISTS "weekly_schedule_details_schedule_id_course_id_idx"
ON "weekly_schedule_details"("schedule_id", "course_id");
