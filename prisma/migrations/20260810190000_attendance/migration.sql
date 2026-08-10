CREATE TYPE "AttendanceStatus" AS ENUM (
  'present',
  'absent',
  'late',
  'excused'
);

CREATE TABLE "attendance_reasons" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "person_id" INTEGER NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "attendance_reasons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attendance" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "section_id" INTEGER NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "person_id" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attendance_details" (
    "id" SERIAL NOT NULL,
    "attendance_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "description" TEXT,
    "attendance_reason_id" INTEGER,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "attendance_details_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "attendance_reasons"
ADD CONSTRAINT "attendance_reasons_person_id_fkey"
FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance"
ADD CONSTRAINT "attendance_section_id_fkey"
FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance"
ADD CONSTRAINT "attendance_person_id_fkey"
FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance_details"
ADD CONSTRAINT "attendance_details_attendance_id_fkey"
FOREIGN KEY ("attendance_id") REFERENCES "attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_details"
ADD CONSTRAINT "attendance_details_student_id_fkey"
FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance_details"
ADD CONSTRAINT "attendance_details_attendance_reason_id_fkey"
FOREIGN KEY ("attendance_reason_id") REFERENCES "attendance_reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
