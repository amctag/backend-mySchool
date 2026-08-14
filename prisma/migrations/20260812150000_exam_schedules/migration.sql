CREATE TABLE IF NOT EXISTS "grade_types" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "is_abstract" BOOLEAN NOT NULL DEFAULT false,
    "position" SMALLINT NOT NULL DEFAULT 0,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "type" VARCHAR(30) NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "grade_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "exam_schedules" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "class_id" INTEGER NOT NULL,
    "year_id" INTEGER NOT NULL,
    "grade_type_id" INTEGER NOT NULL,
    "person_id" INTEGER NOT NULL,
    "note" TEXT,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exam_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "exam_dates" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "exam_schedule_id" INTEGER NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exam_dates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "exam_schedule_details" (
    "id" SERIAL NOT NULL,
    "exam_date_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "position" SMALLINT NOT NULL DEFAULT 0,
    "start_time" VARCHAR(10) NOT NULL,
    "duration" INTEGER NOT NULL,
    "note" TEXT,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exam_schedule_details_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_schedules_class_id_fkey'
  ) THEN
    ALTER TABLE "exam_schedules"
    ADD CONSTRAINT "exam_schedules_class_id_fkey"
    FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_schedules_year_id_fkey'
  ) THEN
    ALTER TABLE "exam_schedules"
    ADD CONSTRAINT "exam_schedules_year_id_fkey"
    FOREIGN KEY ("year_id") REFERENCES "years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_schedules_grade_type_id_fkey'
  ) THEN
    ALTER TABLE "exam_schedules"
    ADD CONSTRAINT "exam_schedules_grade_type_id_fkey"
    FOREIGN KEY ("grade_type_id") REFERENCES "grade_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_schedules_person_id_fkey'
  ) THEN
    ALTER TABLE "exam_schedules"
    ADD CONSTRAINT "exam_schedules_person_id_fkey"
    FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_dates_exam_schedule_id_fkey'
  ) THEN
    ALTER TABLE "exam_dates"
    ADD CONSTRAINT "exam_dates_exam_schedule_id_fkey"
    FOREIGN KEY ("exam_schedule_id") REFERENCES "exam_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_schedule_details_exam_date_id_fkey'
  ) THEN
    ALTER TABLE "exam_schedule_details"
    ADD CONSTRAINT "exam_schedule_details_exam_date_id_fkey"
    FOREIGN KEY ("exam_date_id") REFERENCES "exam_dates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_schedule_details_course_id_fkey'
  ) THEN
    ALTER TABLE "exam_schedule_details"
    ADD CONSTRAINT "exam_schedule_details_course_id_fkey"
    FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
