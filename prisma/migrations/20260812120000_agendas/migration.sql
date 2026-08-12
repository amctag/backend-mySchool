CREATE TABLE "agendas" (
    "id" SERIAL NOT NULL,
    "description" TEXT NOT NULL,
    "agenda_date" DATE NOT NULL,
    "time" VARCHAR(10) NOT NULL,
    "person_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "image_link" TEXT NOT NULL,
    "file_link" TEXT NOT NULL,
    "published_date" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "agendas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agenda_sections" (
    "id" SERIAL NOT NULL,
    "agenda_id" INTEGER NOT NULL,
    "section_id" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "agenda_sections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agenda_sections_agenda_id_section_id_key"
ON "agenda_sections"("agenda_id", "section_id");

ALTER TABLE "agendas"
ADD CONSTRAINT "agendas_person_id_fkey"
FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agendas"
ADD CONSTRAINT "agendas_course_id_fkey"
FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agenda_sections"
ADD CONSTRAINT "agenda_sections_agenda_id_fkey"
FOREIGN KEY ("agenda_id") REFERENCES "agendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agenda_sections"
ADD CONSTRAINT "agenda_sections_section_id_fkey"
FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
