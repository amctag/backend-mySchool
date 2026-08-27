ALTER TABLE "school"
  ADD COLUMN "email" VARCHAR(255),
  ADD COLUMN "password" VARCHAR(255),
  ADD COLUMN "session_id" UUID,
  ADD COLUMN "refresh_token_hash" VARCHAR(64),
  ADD COLUMN "refresh_expires_at" TIMESTAMPTZ(6);

UPDATE "school"
SET
  email = CASE
    WHEN LOWER(name) LIKE '%green valley%' THEN 'school@greenvalley.edu'
    WHEN LOWER(name) LIKE '%blue horizon%' THEN 'school@bluehorizon.edu'
    ELSE 'school-' || id::text || '@login.local'
  END,
  password = '$2b$10$wzNdyfSpr2YCLsb/FMLgQuGCjie6k9xABc7Z99H.mSNs8oauaN6/2'
WHERE email IS NULL;

ALTER TABLE "school"
  ALTER COLUMN "email" SET NOT NULL,
  ALTER COLUMN "password" SET NOT NULL;

CREATE UNIQUE INDEX "school_email_key" ON "school"("email");
CREATE UNIQUE INDEX "school_session_id_key" ON "school"("session_id");
CREATE UNIQUE INDEX "school_refresh_token_hash_key" ON "school"("refresh_token_hash");
