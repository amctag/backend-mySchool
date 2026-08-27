ALTER TABLE "school"
  ADD COLUMN "previous_refresh_token_hash" VARCHAR(64),
  ADD COLUMN "previous_refresh_valid_until" TIMESTAMPTZ(6);

CREATE INDEX "school_previous_refresh_token_hash_idx"
  ON "school"("previous_refresh_token_hash");
