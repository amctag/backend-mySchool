-- Scope chart-of-accounts rows to a school + allocate account codes.
-- Idempotent so a failed deploy can retry safely.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'S'
      AND n.nspname = 'public'
      AND c.relname = 'account_code_seq'
  ) THEN
    CREATE SEQUENCE "account_code_seq"
      AS BIGINT
      START 100001
      INCREMENT 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'accounts'
      AND column_name = 'school_id'
  ) THEN
    ALTER TABLE "accounts" ADD COLUMN "school_id" INTEGER;
  END IF;
END $$;

-- Backfill existing rows (empty table is a no-op).
UPDATE "accounts"
SET "school_id" = (SELECT MIN("id") FROM "school")
WHERE "school_id" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "accounts" WHERE "school_id" IS NULL) THEN
    RAISE EXCEPTION
      'accounts.school_id backfill failed: no school rows available';
  END IF;
END $$;

ALTER TABLE "accounts" ALTER COLUMN "school_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "accounts_school_id_idx" ON "accounts"("school_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_school_id_fkey'
  ) THEN
    ALTER TABLE "accounts"
      ADD CONSTRAINT "accounts_school_id_fkey"
      FOREIGN KEY ("school_id") REFERENCES "school"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
