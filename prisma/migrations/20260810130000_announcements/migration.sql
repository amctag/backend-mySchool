CREATE TYPE "AnnouncementAudience" AS ENUM (
  'parent',
  'student',
  'teacher'
);

CREATE TABLE "announcements" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255),
    "content" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "person_id" INTEGER NOT NULL,
    "publish_date" DATE NOT NULL,
    "publish_time" TIME(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "announcement_targets" (
    "id" SERIAL NOT NULL,
    "announcement_id" INTEGER NOT NULL,
    "audience_target" "AnnouncementAudience" NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "announcement_targets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "announcement_sections" (
    "id" SERIAL NOT NULL,
    "announcement_id" INTEGER NOT NULL,
    "section_id" INTEGER NOT NULL,
    "class_id" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "announcement_sections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "announcement_targets_announcement_id_audience_target_key"
ON "announcement_targets"("announcement_id", "audience_target");

CREATE UNIQUE INDEX "announcement_sections_announcement_id_section_id_key"
ON "announcement_sections"("announcement_id", "section_id");

ALTER TABLE "announcements"
ADD CONSTRAINT "announcements_person_id_fkey"
FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "announcement_targets"
ADD CONSTRAINT "announcement_targets_announcement_id_fkey"
FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "announcement_sections"
ADD CONSTRAINT "announcement_sections_announcement_id_fkey"
FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "announcement_sections"
ADD CONSTRAINT "announcement_sections_section_id_fkey"
FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "announcement_sections"
ADD CONSTRAINT "announcement_sections_class_id_fkey"
FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
