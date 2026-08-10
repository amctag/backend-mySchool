-- Safe upgrade when an older announcements migration was already applied.

ALTER TABLE "announcement_targets"
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);

ALTER TABLE "announcement_sections"
ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);

ALTER TABLE "announcements"
ADD COLUMN IF NOT EXISTS "publish_date" DATE,
ADD COLUMN IF NOT EXISTS "publish_time" TIME(6);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'announcements'
      AND column_name = 'published_at'
  ) THEN
    UPDATE "announcements"
    SET
      "publish_date" = COALESCE("publish_date", "published_at"::date),
      "publish_time" = COALESCE("publish_time", "published_at"::time)
    WHERE "published_at" IS NOT NULL;
  END IF;
END $$;

UPDATE "announcements"
SET
  "publish_date" = COALESCE("publish_date", CURRENT_DATE),
  "publish_time" = COALESCE("publish_time", CURRENT_TIME)
WHERE "publish_date" IS NULL OR "publish_time" IS NULL;

ALTER TABLE "announcements"
DROP CONSTRAINT IF EXISTS "announcements_school_id_fkey";

ALTER TABLE "announcements"
DROP COLUMN IF EXISTS "school_id",
DROP COLUMN IF EXISTS "published_at";

ALTER TABLE "announcements"
ALTER COLUMN "publish_date" SET NOT NULL,
ALTER COLUMN "publish_time" SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum AS enum_value
    JOIN pg_type AS enum_type ON enum_value.enumtypid = enum_type.oid
    WHERE enum_type.typname = 'AnnouncementAudience'
      AND enum_value.enumlabel IN ('director', 'supervisor', 'coordinator')
  ) THEN
    CREATE TYPE "AnnouncementAudience_new" AS ENUM ('parent', 'student', 'teacher');

    ALTER TABLE "announcement_targets"
    ALTER COLUMN "audience_target" TYPE "AnnouncementAudience_new"
    USING "audience_target"::text::"AnnouncementAudience_new";

    DROP TYPE "AnnouncementAudience";
    ALTER TYPE "AnnouncementAudience_new" RENAME TO "AnnouncementAudience";
  END IF;
END $$;
