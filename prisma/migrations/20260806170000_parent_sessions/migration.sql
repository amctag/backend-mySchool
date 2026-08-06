DROP TABLE IF EXISTS "revoked_tokens";

CREATE TABLE "parent_sessions" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "parent_sessions_token_hash_key" ON "parent_sessions"("token_hash");

ALTER TABLE "parent_sessions"
ADD CONSTRAINT "parent_sessions_person_id_fkey"
FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
