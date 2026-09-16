-- AlterTable (idempotent: safe to re-run after a failed deploy)
ALTER TABLE "person" ADD COLUMN IF NOT EXISTS "paid" BOOLEAN NOT NULL DEFAULT true;
