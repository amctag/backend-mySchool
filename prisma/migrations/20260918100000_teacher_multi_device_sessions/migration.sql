-- Allow multiple concurrent teacher sessions (one per device/login).
DROP INDEX IF EXISTS "teacher_sessions_person_id_key";

CREATE INDEX IF NOT EXISTS "teacher_sessions_person_id_idx" ON "teacher_sessions"("person_id");
