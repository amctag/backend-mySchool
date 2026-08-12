CREATE TABLE "notice_types" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "person_id" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notice_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "notices" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "person_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notice_students" (
    "id" SERIAL NOT NULL,
    "notice_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notice_students_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notice_sections" (
    "id" SERIAL NOT NULL,
    "notice_id" INTEGER NOT NULL,
    "section_id" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notice_sections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notice_students_notice_id_student_id_key"
ON "notice_students"("notice_id", "student_id");

CREATE UNIQUE INDEX "notice_sections_notice_id_section_id_key"
ON "notice_sections"("notice_id", "section_id");

ALTER TABLE "notice_types"
ADD CONSTRAINT "notice_types_person_id_fkey"
FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notices"
ADD CONSTRAINT "notices_person_id_fkey"
FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notices"
ADD CONSTRAINT "notices_school_id_fkey"
FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notice_students"
ADD CONSTRAINT "notice_students_notice_id_fkey"
FOREIGN KEY ("notice_id") REFERENCES "notices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notice_students"
ADD CONSTRAINT "notice_students_student_id_fkey"
FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notice_sections"
ADD CONSTRAINT "notice_sections_notice_id_fkey"
FOREIGN KEY ("notice_id") REFERENCES "notices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notice_sections"
ADD CONSTRAINT "notice_sections_section_id_fkey"
FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
