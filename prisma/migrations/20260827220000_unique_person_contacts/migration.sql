-- Keep one row per duplicate contact value, then enforce uniqueness.
-- Multiple NULLs remain allowed.

UPDATE "persons" AS person
SET "email" = NULL
WHERE person."email" IS NOT NULL
  AND person.id NOT IN (
    SELECT MIN(kept.id)
    FROM "persons" AS kept
    WHERE kept."email" IS NOT NULL
    GROUP BY lower(kept."email")
  );

UPDATE "persons" AS person
SET "phone_number" = NULL
WHERE person."phone_number" IS NOT NULL
  AND person.id NOT IN (
    SELECT MIN(kept.id)
    FROM "persons" AS kept
    WHERE kept."phone_number" IS NOT NULL
    GROUP BY kept."phone_number"
  );

UPDATE "persons" AS person
SET "identity_number" = NULL
WHERE person."identity_number" IS NOT NULL
  AND person.id NOT IN (
    SELECT MIN(kept.id)
    FROM "persons" AS kept
    WHERE kept."identity_number" IS NOT NULL
    GROUP BY kept."identity_number"
  );

CREATE UNIQUE INDEX "persons_email_key" ON "persons"("email");
CREATE UNIQUE INDEX "persons_phone_number_key" ON "persons"("phone_number");
CREATE UNIQUE INDEX "persons_identity_number_key" ON "persons"("identity_number");
