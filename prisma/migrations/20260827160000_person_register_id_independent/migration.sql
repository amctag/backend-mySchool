-- persons.governorate_id is a normal FK to governorates.id (name lookup).
-- persons.register_id stays a free number with no relation.

ALTER TABLE "persons" DROP CONSTRAINT IF EXISTS "persons_governorate_id_fkey";

UPDATE "persons" AS p
SET "governorate_id" = g."id"
FROM "governorates" AS g
WHERE p."governorate_id" IS NOT NULL
  AND g."code" = p."governorate_id"
  AND NOT EXISTS (
    SELECT 1 FROM "governorates" AS g2 WHERE g2."id" = p."governorate_id"
  );

ALTER TABLE "persons"
  ADD CONSTRAINT "persons_governorate_id_fkey"
  FOREIGN KEY ("governorate_id") REFERENCES "governorates"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
