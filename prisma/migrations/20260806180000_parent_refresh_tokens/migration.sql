DROP TABLE IF EXISTS "parent_sessions";

CREATE TABLE "parent_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "person_id" INTEGER NOT NULL,
    "refresh_token_hash" VARCHAR(64) NOT NULL,
    "refresh_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "parent_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "parent_sessions_refresh_token_hash_key"
ON "parent_sessions"("refresh_token_hash");

ALTER TABLE "parent_sessions"
ADD CONSTRAINT "parent_sessions_person_id_fkey"
FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
