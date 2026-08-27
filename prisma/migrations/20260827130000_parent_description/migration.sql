-- Description belongs on parents; address stays on persons.
ALTER TABLE "parents" ADD COLUMN IF NOT EXISTS "description" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'persons' AND column_name = 'description'
  ) THEN
    UPDATE "parents" AS p
    SET "description" = pe."description"
    FROM "persons" AS pe
    WHERE p."person_id" = pe."id"
      AND p."description" IS NULL
      AND pe."description" IS NOT NULL;

    ALTER TABLE "persons" DROP COLUMN "description";
  END IF;
END $$;

ALTER TABLE "governorates" DROP COLUMN IF EXISTS "address";
ALTER TABLE "governorates" DROP COLUMN IF EXISTS "description";
ALTER TABLE "regions" DROP COLUMN IF EXISTS "address";
ALTER TABLE "regions" DROP COLUMN IF EXISTS "description";
