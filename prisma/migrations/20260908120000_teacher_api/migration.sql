-- Teacher sessions and query indexes for the teacher app API.

CREATE TABLE "teacher_sessions" (
    "id" UUID NOT NULL,
    "person_id" INTEGER NOT NULL,
    "school_id" INTEGER NOT NULL,
    "refresh_token_hash" VARCHAR(64) NOT NULL,
    "refresh_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "teacher_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "teacher_sessions_refresh_token_hash_key" ON "teacher_sessions"("refresh_token_hash");
CREATE UNIQUE INDEX "teacher_sessions_person_id_key" ON "teacher_sessions"("person_id");
CREATE INDEX "teacher_sessions_school_id_idx" ON "teacher_sessions"("school_id");

ALTER TABLE "teacher_sessions"
ADD CONSTRAINT "teacher_sessions_person_id_fkey"
FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "teacher_sessions"
ADD CONSTRAINT "teacher_sessions_school_id_fkey"
FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notices" ADD COLUMN "title" VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE "agendas" ADD COLUMN "title" VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE "grades" ADD COLUMN "title" VARCHAR(255);
ALTER TABLE "grades" ADD COLUMN "comment" TEXT;

CREATE INDEX IF NOT EXISTS "teacher_schools_teacher_id_is_active_idx"
ON "teacher_schools"("teacher_id", "is_active");

CREATE INDEX IF NOT EXISTS "teacher_schools_school_id_is_active_idx"
ON "teacher_schools"("school_id", "is_active");

CREATE INDEX IF NOT EXISTS "teach_teacher_id_year_id_idx"
ON "teach"("teacher_id", "year_id");

CREATE INDEX IF NOT EXISTS "teach_teacher_id_section_id_course_id_idx"
ON "teach"("teacher_id", "section_id", "course_id");

CREATE INDEX IF NOT EXISTS "teach_section_id_year_id_idx"
ON "teach"("section_id", "year_id");

CREATE INDEX IF NOT EXISTS "days_school_id_position_idx"
ON "days"("school_id", "position");

CREATE INDEX IF NOT EXISTS "sessions_school_id_position_idx"
ON "sessions"("school_id", "position");

CREATE INDEX IF NOT EXISTS "weekly_schedules_section_id_idx"
ON "weekly_schedules"("section_id");

CREATE INDEX IF NOT EXISTS "weekly_schedule_details_person_id_idx"
ON "weekly_schedule_details"("person_id");

CREATE INDEX IF NOT EXISTS "weekly_schedule_details_schedule_id_day_id_idx"
ON "weekly_schedule_details"("schedule_id", "day_id");

CREATE INDEX IF NOT EXISTS "weekly_schedule_details_course_id_person_id_idx"
ON "weekly_schedule_details"("course_id", "person_id");

CREATE INDEX IF NOT EXISTS "notices_person_id_school_id_date_idx"
ON "notices"("person_id", "school_id", "date");

CREATE INDEX IF NOT EXISTS "agendas_person_id_agenda_date_status_idx"
ON "agendas"("person_id", "agenda_date", "status");

CREATE INDEX IF NOT EXISTS "agendas_course_id_status_idx"
ON "agendas"("course_id", "status");

CREATE INDEX IF NOT EXISTS "grades_person_id_publish_date_idx"
ON "grades"("person_id", "publish_date");

CREATE INDEX IF NOT EXISTS "grades_section_id_course_id_grade_type_id_idx"
ON "grades"("section_id", "course_id", "grade_type_id");
