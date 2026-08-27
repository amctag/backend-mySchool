-- Custom governorate number (code), separate from autoincrement id.
-- persons.governorate_id stores this code, not governorates.id.

ALTER TABLE "governorates" ADD COLUMN IF NOT EXISTS "code" INTEGER;

UPDATE "governorates"
SET "code" = "id"
WHERE "code" IS NULL;

ALTER TABLE "governorates" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "governorates_code_key" ON "governorates"("code");

ALTER TABLE "persons" DROP CONSTRAINT IF EXISTS "persons_governorate_id_fkey";

UPDATE "persons" AS p
SET "governorate_id" = g."code"
FROM "governorates" AS g
WHERE p."governorate_id" = g."id";

ALTER TABLE "persons"
  ADD CONSTRAINT "persons_governorate_id_fkey"
  FOREIGN KEY ("governorate_id") REFERENCES "governorates"("code")
  ON DELETE SET NULL ON UPDATE CASCADE;
