CREATE INDEX IF NOT EXISTS "students_parent_id_idx"
ON "students"("parent_id");

CREATE INDEX IF NOT EXISTS "sections_school_id_year_id_idx"
ON "sections"("school_id", "year_id");

CREATE INDEX IF NOT EXISTS "sections_class_id_year_id_idx"
ON "sections"("class_id", "year_id");

CREATE INDEX IF NOT EXISTS "registrations_student_id_status_idx"
ON "registrations"("student_id", "status");

CREATE INDEX IF NOT EXISTS "registrations_section_id_status_idx"
ON "registrations"("section_id", "status");

CREATE INDEX IF NOT EXISTS "attendance_section_id_date_idx"
ON "attendance"("section_id", "date");

CREATE INDEX IF NOT EXISTS "attendance_details_student_id_status_idx"
ON "attendance_details"("student_id", "status");

CREATE INDEX IF NOT EXISTS "notices_school_id_status_date_idx"
ON "notices"("school_id", "status", "date");

CREATE INDEX IF NOT EXISTS "notice_students_student_id_idx"
ON "notice_students"("student_id");

CREATE INDEX IF NOT EXISTS "notice_sections_section_id_idx"
ON "notice_sections"("section_id");

CREATE INDEX IF NOT EXISTS "agendas_agenda_date_status_published_date_idx"
ON "agendas"("agenda_date", "status", "published_date");

CREATE INDEX IF NOT EXISTS "agenda_sections_section_id_idx"
ON "agenda_sections"("section_id");

CREATE INDEX IF NOT EXISTS "albums_school_id_year_id_status_idx"
ON "albums"("school_id", "year_id", "status");

CREATE INDEX IF NOT EXISTS "album_images_album_id_idx"
ON "album_images"("album_id");

CREATE INDEX IF NOT EXISTS "grade_types_school_id_idx"
ON "grade_types"("school_id");

CREATE INDEX IF NOT EXISTS "exam_schedules_class_id_year_id_status_idx"
ON "exam_schedules"("class_id", "year_id", "status");

CREATE INDEX IF NOT EXISTS "exam_dates_exam_schedule_id_date_idx"
ON "exam_dates"("exam_schedule_id", "date");

CREATE INDEX IF NOT EXISTS "exam_schedule_details_exam_date_id_status_idx"
ON "exam_schedule_details"("exam_date_id", "status");

CREATE INDEX IF NOT EXISTS "grades_school_id_section_id_publish_date_idx"
ON "grades"("school_id", "section_id", "publish_date");

CREATE INDEX IF NOT EXISTS "grade_details_registration_id_idx"
ON "grade_details"("registration_id");

CREATE INDEX IF NOT EXISTS "grade_form_school_id_year_id_idx"
ON "grade_form"("school_id", "year_id");
