-- Registration → Invoice integration and Accounting Invoice module.
-- Additive only: never edit historical migrations.

-- Invoice document numbering register type (idempotent seed for the counter).
INSERT INTO "accounting_register_types" ("name")
VALUES ('Invoice')
ON CONFLICT ("name") DO NOTHING;

-- Invoice header: per-school numbering + tenant scope (mirrors Receipt/Payment).
ALTER TABLE "accounting_invoice" ADD COLUMN "nb" INTEGER;
ALTER TABLE "accounting_invoice" ADD COLUMN "school_id" INTEGER;

-- Backfill any legacy rows from their register (the invoice module is new,
-- so this is normally a no-op). Numbers are assigned per school by id order.
UPDATE "accounting_invoice" AS inv
SET "school_id" = reg."school_id"
FROM "accounting_register" AS reg
WHERE inv."accounting_register_id" = reg."id"
  AND inv."school_id" IS NULL;

WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "school_id" ORDER BY "id") AS rn
  FROM "accounting_invoice"
  WHERE "nb" IS NULL AND "school_id" IS NOT NULL
)
UPDATE "accounting_invoice" AS inv
SET "nb" = numbered.rn
FROM numbered
WHERE inv."id" = numbered."id";

ALTER TABLE "accounting_invoice" ALTER COLUMN "nb" SET NOT NULL;
ALTER TABLE "accounting_invoice" ALTER COLUMN "school_id" SET NOT NULL;

ALTER TABLE "accounting_invoice"
  ADD CONSTRAINT "accounting_invoice_school_id_nb_key" UNIQUE ("school_id", "nb");
CREATE INDEX "accounting_invoice_school_id_idx" ON "accounting_invoice"("school_id");
ALTER TABLE "accounting_invoice"
  ADD CONSTRAINT "accounting_invoice_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Optional per-detail registration link (nullable: a parent invoice may mix
-- lines for several children plus lines unrelated to any registration).
ALTER TABLE "accounting_invoice_details" ADD COLUMN "for_registration_id" INTEGER;
CREATE INDEX "accounting_invoice_details_for_registration_id_idx"
  ON "accounting_invoice_details"("for_registration_id");
ALTER TABLE "accounting_invoice_details"
  ADD CONSTRAINT "accounting_invoice_details_for_registration_id_fkey"
  FOREIGN KEY ("for_registration_id") REFERENCES "registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
