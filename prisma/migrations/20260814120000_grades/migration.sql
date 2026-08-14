ALTER TABLE "grade_types"
ADD COLUMN IF NOT EXISTS "school_id" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'grade_types_school_id_fkey'
  ) THEN
    ALTER TABLE "grade_types"
    ADD CONSTRAINT "grade_types_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "grades" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "section_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "grade_type_id" INTEGER NOT NULL,
    "max_grade" DECIMAL(7,2) NOT NULL,
    "publish_date" TIMESTAMPTZ(6),
    "person_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "grades_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "grade_details" (
    "id" SERIAL NOT NULL,
    "grade_id" INTEGER NOT NULL,
    "registration_id" INTEGER NOT NULL,
    "grade" DECIMAL(7,2),
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "grade_details_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "grade_form" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "year_id" INTEGER NOT NULL,
    "grade_background" VARCHAR(255),
    "average" BOOLEAN NOT NULL DEFAULT true,
    "direction" VARCHAR(10) NOT NULL DEFAULT 'ltr',
    "table_format" VARCHAR(30) NOT NULL DEFAULT 'standard',
    "grade_format_id" INTEGER NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "grade_form_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "grade_form_class" (
    "id" SERIAL NOT NULL,
    "class_id" INTEGER NOT NULL,
    "grade_form_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "grade_form_class_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "grade_form_detail" (
    "id" SERIAL NOT NULL,
    "grade_type_id" INTEGER NOT NULL,
    "grade_form_id" INTEGER NOT NULL,
    "position" SMALLINT NOT NULL DEFAULT 0,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "grade_form_detail_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "grade_form_percentage" (
    "id" SERIAL NOT NULL,
    "grade_format_detail_id" INTEGER NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "grade_form_percentage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "grade_details_grade_id_registration_id_key"
ON "grade_details"("grade_id", "registration_id");

CREATE UNIQUE INDEX IF NOT EXISTS "grade_form_class_class_id_grade_form_id_key"
ON "grade_form_class"("class_id", "grade_form_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grades_school_id_fkey') THEN
    ALTER TABLE "grades"
    ADD CONSTRAINT "grades_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grades_section_id_fkey') THEN
    ALTER TABLE "grades"
    ADD CONSTRAINT "grades_section_id_fkey"
    FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grades_course_id_fkey') THEN
    ALTER TABLE "grades"
    ADD CONSTRAINT "grades_course_id_fkey"
    FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grades_grade_type_id_fkey') THEN
    ALTER TABLE "grades"
    ADD CONSTRAINT "grades_grade_type_id_fkey"
    FOREIGN KEY ("grade_type_id") REFERENCES "grade_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grades_person_id_fkey') THEN
    ALTER TABLE "grades"
    ADD CONSTRAINT "grades_person_id_fkey"
    FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grade_details_grade_id_fkey') THEN
    ALTER TABLE "grade_details"
    ADD CONSTRAINT "grade_details_grade_id_fkey"
    FOREIGN KEY ("grade_id") REFERENCES "grades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grade_details_registration_id_fkey') THEN
    ALTER TABLE "grade_details"
    ADD CONSTRAINT "grade_details_registration_id_fkey"
    FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grade_form_school_id_fkey') THEN
    ALTER TABLE "grade_form"
    ADD CONSTRAINT "grade_form_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grade_form_year_id_fkey') THEN
    ALTER TABLE "grade_form"
    ADD CONSTRAINT "grade_form_year_id_fkey"
    FOREIGN KEY ("year_id") REFERENCES "years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grade_form_class_class_id_fkey') THEN
    ALTER TABLE "grade_form_class"
    ADD CONSTRAINT "grade_form_class_class_id_fkey"
    FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grade_form_class_grade_form_id_fkey') THEN
    ALTER TABLE "grade_form_class"
    ADD CONSTRAINT "grade_form_class_grade_form_id_fkey"
    FOREIGN KEY ("grade_form_id") REFERENCES "grade_form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grade_form_detail_grade_type_id_fkey') THEN
    ALTER TABLE "grade_form_detail"
    ADD CONSTRAINT "grade_form_detail_grade_type_id_fkey"
    FOREIGN KEY ("grade_type_id") REFERENCES "grade_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grade_form_detail_grade_form_id_fkey') THEN
    ALTER TABLE "grade_form_detail"
    ADD CONSTRAINT "grade_form_detail_grade_form_id_fkey"
    FOREIGN KEY ("grade_form_id") REFERENCES "grade_form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'grade_form_percentage_grade_format_detail_id_fkey') THEN
    ALTER TABLE "grade_form_percentage"
    ADD CONSTRAINT "grade_form_percentage_grade_format_detail_id_fkey"
    FOREIGN KEY ("grade_format_detail_id") REFERENCES "grade_form_detail"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
