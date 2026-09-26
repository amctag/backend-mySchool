-- Accounting Phase 2C: currency catalog, GENERAL account type,
-- receipt allocation details, and currency FK on registers.
-- Additive only. Historical migrations are untouched.

-- AlterEnum
ALTER TYPE "AccountType" ADD VALUE 'GENERAL';

-- CreateTable
CREATE TABLE "currency" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "short_code" VARCHAR(16) NOT NULL,
    "symbol" VARCHAR(16) NOT NULL,
    "rate" DECIMAL(18,6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "currency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "currency_short_code_key" ON "currency"("short_code");

-- Seed base currencies. Idempotent: fixed ids keep references stable and
-- re-running the migration never duplicates rows or moves the sequence back.
-- Assumption (verified against repository history): no currency table or
-- currency ID convention ever existed before this migration, so ids 1 (USD)
-- and 2 (LBP) cannot collide with any legitimate historical mapping.
INSERT INTO "currency" ("id", "title", "short_code", "symbol", "rate", "updated_at")
VALUES
  (1, 'US Dollar', 'USD', '$', 1, CURRENT_TIMESTAMP),
  (2, 'Lebanese Pound', 'LBP', 'L.L', 1, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

SELECT setval('"currency_id_seq"', (SELECT MAX("id") FROM "currency"));

-- Guard: refuse to add the Currency FK while dangling references exist.
-- Existing non-null accounting_register.currency_id values predate the
-- currency catalog and must be inspected explicitly; this migration never
-- rewrites them. NULL values remain allowed (currencyId stays nullable).
DO $$
DECLARE
  orphan_ids TEXT;
BEGIN
  SELECT string_agg(DISTINCT r."currency_id"::TEXT, ', ' ORDER BY r."currency_id"::TEXT)
    INTO orphan_ids
  FROM "accounting_register" AS r
  WHERE r."currency_id" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM "currency" AS c WHERE c."id" = r."currency_id"
    );
  IF orphan_ids IS NOT NULL THEN
    RAISE EXCEPTION
      'accounting_phase_2c blocked: accounting_register has orphan currency_id values (%). Inspect and fix them explicitly before applying this migration.',
      orphan_ids;
  END IF;
END $$;

-- CreateIndex
CREATE INDEX "accounting_register_currency_id_idx" ON "accounting_register"("currency_id");

-- AddForeignKey
ALTER TABLE "accounting_register" ADD CONSTRAINT "accounting_register_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "accounting_receipt_details" (
    "id" SERIAL NOT NULL,
    "accounting_receipt_id" INTEGER NOT NULL,
    "account_id" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT,
    "date_created" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_receipt_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounting_receipt_details_accounting_receipt_id_idx" ON "accounting_receipt_details"("accounting_receipt_id");

-- CreateIndex
CREATE INDEX "accounting_receipt_details_account_id_idx" ON "accounting_receipt_details"("account_id");

-- AddForeignKey
ALTER TABLE "accounting_receipt_details" ADD CONSTRAINT "accounting_receipt_details_accounting_receipt_id_fkey" FOREIGN KEY ("accounting_receipt_id") REFERENCES "accounting_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_receipt_details" ADD CONSTRAINT "accounting_receipt_details_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
