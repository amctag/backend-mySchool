ALTER TABLE "registrations" ADD COLUMN "school_id" INTEGER;

UPDATE "registrations" AS r
SET "school_id" = s."school_id"
FROM "sections" AS s
WHERE r."section_id" = s."id";

ALTER TABLE "registrations" ALTER COLUMN "school_id" SET NOT NULL;

ALTER TABLE "registrations"
ADD CONSTRAINT "registrations_school_id_fkey"
FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "registrations_school_id_status_idx" ON "registrations"("school_id", "status");
