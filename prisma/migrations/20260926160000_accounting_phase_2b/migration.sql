-- Accounting Phase 2B: extend accounts with identity/type, per-school
-- document counters, register idempotency keys, and school-scoped
-- receipt/payment numbering with uniqueness.
-- Additive only. Historical migrations are untouched.

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('PERSON', 'CASH', 'SALES', 'PURCHASES');

-- Extend accounts with identity columns (nullable first, backfilled below)
ALTER TABLE "accounts" ADD COLUMN "name" VARCHAR(255);
ALTER TABLE "accounts" ADD COLUMN "type" "AccountType";

-- Backfill: every existing account is a Phase 2A parent/person account.
-- Keep id, code, school_id and persons.account_id exactly as they are.
UPDATE "accounts" AS a
SET
  "type" = 'PERSON',
  "name" = COALESCE(
    (
      SELECT NULLIF(TRIM(CONCAT_WS(' ', p."first_name", p."middle_name", p."last_name")), '')
      FROM "persons" AS p
      WHERE p."account_id" = a."id"
      LIMIT 1
    ),
    'Account ' || a."code"
  );

-- Enforce required account metadata going forward
ALTER TABLE "accounts" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "accounts" ALTER COLUMN "type" SET NOT NULL;

-- System accounts (CASH/SALES/PURCHASES) may exist only once per school.
-- PERSON accounts are unaffected by this index.
CREATE UNIQUE INDEX "accounts_school_system_type_uidx"
  ON "accounts"("school_id", "type")
  WHERE "type" IN ('CASH', 'SALES', 'PURCHASES');

-- Per-school, per-document-type numbering counters.
-- Rows are locked (SELECT ... FOR UPDATE) inside the posting transaction,
-- so concurrent postings serialize on the counter row instead of MAX(nb)+1.
CREATE TABLE "accounting_document_counters" (
  "school_id" INTEGER NOT NULL,
  "accounting_register_type_id" INTEGER NOT NULL,
  "last_nb" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "accounting_document_counters_pkey"
    PRIMARY KEY ("school_id", "accounting_register_type_id")
);

ALTER TABLE "accounting_document_counters"
  ADD CONSTRAINT "accounting_document_counters_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "school"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting_document_counters"
  ADD CONSTRAINT "accounting_document_counters_register_type_fkey"
  FOREIGN KEY ("accounting_register_type_id")
  REFERENCES "accounting_register_types"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Idempotency keys for safe retries/double-submit protection.
-- NULL keys are unaffected (PostgreSQL unique treats NULLs as distinct).
ALTER TABLE "accounting_register" ADD COLUMN "idempotency_key" VARCHAR(100);

ALTER TABLE "accounting_register"
  ADD CONSTRAINT "accounting_register_school_id_idempotency_key_key"
  UNIQUE ("school_id", "idempotency_key");

-- School scope on receipt documents + per-school nb uniqueness backstop.
ALTER TABLE "accounting_receipts" ADD COLUMN "school_id" INTEGER;

UPDATE "accounting_receipts" AS r
SET "school_id" = (
  SELECT reg."school_id"
  FROM "accounting_register" AS reg
  WHERE reg."id" = r."accounting_register_id"
);

ALTER TABLE "accounting_receipts" ALTER COLUMN "school_id" SET NOT NULL;

ALTER TABLE "accounting_receipts"
  ADD CONSTRAINT "accounting_receipts_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "school"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting_receipts"
  ADD CONSTRAINT "accounting_receipts_school_id_nb_key"
  UNIQUE ("school_id", "nb");

-- School scope on payment documents + per-school nb uniqueness backstop.
ALTER TABLE "accounting_payments" ADD COLUMN "school_id" INTEGER;

UPDATE "accounting_payments" AS p
SET "school_id" = (
  SELECT reg."school_id"
  FROM "accounting_register" AS reg
  WHERE reg."id" = p."accounting_register_id"
);

ALTER TABLE "accounting_payments" ALTER COLUMN "school_id" SET NOT NULL;

ALTER TABLE "accounting_payments"
  ADD CONSTRAINT "accounting_payments_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "school"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting_payments"
  ADD CONSTRAINT "accounting_payments_school_id_nb_key"
  UNIQUE ("school_id", "nb");
