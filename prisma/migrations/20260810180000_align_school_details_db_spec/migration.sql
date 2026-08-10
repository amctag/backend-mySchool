-- Safe upgrade when an older school_details table exists without school_id.

ALTER TABLE "school_details"
ADD COLUMN IF NOT EXISTS "school_id" INTEGER,
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);

UPDATE "school_details"
SET "school_id" = (
  SELECT "id"
  FROM "school"
  ORDER BY "id"
  LIMIT 1
)
WHERE "school_id" IS NULL
  AND EXISTS (SELECT 1 FROM "school");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'school_details'
      AND column_name = 'school_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM "school_details"
    WHERE "school_id" IS NULL
  ) THEN
    ALTER TABLE "school_details"
    ALTER COLUMN "school_id" SET NOT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "school_details_school_id_key"
ON "school_details"("school_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'school_details_school_id_fkey'
  ) THEN
    ALTER TABLE "school_details"
    ADD CONSTRAINT "school_details_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
