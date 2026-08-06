-- Repair parent_sessions if an older schema (token_hash / SERIAL id) is still present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'parent_sessions'
      AND column_name = 'token_hash'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'parent_sessions'
      AND column_name = 'refresh_token_hash'
  ) THEN
    DROP TABLE "parent_sessions";

    CREATE TABLE "parent_sessions" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "person_id" INTEGER NOT NULL,
        "refresh_token_hash" VARCHAR(64) NOT NULL,
        "refresh_expires_at" TIMESTAMPTZ(6) NOT NULL,
        "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "parent_sessions_pkey" PRIMARY KEY ("id")
    );

    CREATE UNIQUE INDEX "parent_sessions_refresh_token_hash_key"
    ON "parent_sessions"("refresh_token_hash");

    ALTER TABLE "parent_sessions"
    ADD CONSTRAINT "parent_sessions_person_id_fkey"
    FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Ensure updated_at has a default on the current schema.
ALTER TABLE "parent_sessions"
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- Ensure one session per parent (idempotent).
CREATE UNIQUE INDEX IF NOT EXISTS "parent_sessions_person_id_key"
ON "parent_sessions"("person_id");
