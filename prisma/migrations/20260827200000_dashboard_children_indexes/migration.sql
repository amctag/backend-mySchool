CREATE INDEX IF NOT EXISTS "students_parent_id_id_idx"
ON "students"("parent_id", "id");

CREATE INDEX IF NOT EXISTS "years_school_id_is_current_idx"
ON "years"("school_id", "is_current");
