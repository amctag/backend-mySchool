-- AlterTable (idempotent: safe to re-run after a failed deploy)
-- Real table name is "persons" (Person @@map("persons"))
ALTER TABLE "persons" ADD COLUMN IF NOT EXISTS "paid" BOOLEAN NOT NULL DEFAULT true;
