ALTER TABLE "agendas" RENAME COLUMN "date" TO "agenda_date";

ALTER TABLE "agendas"
ALTER COLUMN "published_date" TYPE TIMESTAMPTZ(6)
USING ("published_date"::timestamp AT TIME ZONE 'UTC');

ALTER TABLE "agendas"
ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(6)
USING ("created_at"::timestamp AT TIME ZONE 'UTC');

ALTER TABLE "agendas"
ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;
