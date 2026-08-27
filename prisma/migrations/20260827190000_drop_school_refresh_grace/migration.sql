ALTER TABLE "school"
  DROP COLUMN IF EXISTS "previous_refresh_token_hash",
  DROP COLUMN IF EXISTS "previous_refresh_valid_until";
