-- Allow multiple concurrent school/dashboard sessions (one per browser/device).

CREATE TABLE "school_sessions" (
    "id" UUID NOT NULL,
    "school_id" INTEGER NOT NULL,
    "refresh_token_hash" VARCHAR(64) NOT NULL,
    "refresh_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "school_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_sessions_refresh_token_hash_key" ON "school_sessions"("refresh_token_hash");
CREATE INDEX "school_sessions_school_id_idx" ON "school_sessions"("school_id");

ALTER TABLE "school_sessions"
  ADD CONSTRAINT "school_sessions_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate any active single-session rows from school.* into school_sessions.
INSERT INTO "school_sessions" ("id", "school_id", "refresh_token_hash", "refresh_expires_at", "created_at", "updated_at")
SELECT
  "session_id",
  "id",
  "refresh_token_hash",
  "refresh_expires_at",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "school"
WHERE "session_id" IS NOT NULL
  AND "refresh_token_hash" IS NOT NULL
  AND "refresh_expires_at" IS NOT NULL
  AND "refresh_expires_at" > CURRENT_TIMESTAMP;

DROP INDEX IF EXISTS "school_session_id_key";
DROP INDEX IF EXISTS "school_refresh_token_hash_key";

ALTER TABLE "school" DROP COLUMN IF EXISTS "session_id";
ALTER TABLE "school" DROP COLUMN IF EXISTS "refresh_token_hash";
ALTER TABLE "school" DROP COLUMN IF EXISTS "refresh_expires_at";
