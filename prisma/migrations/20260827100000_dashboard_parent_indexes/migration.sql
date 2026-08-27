CREATE INDEX IF NOT EXISTS "persons_school_id_idx"
ON "persons"("school_id");

CREATE INDEX IF NOT EXISTS "persons_first_name_last_name_idx"
ON "persons"("first_name", "last_name");
