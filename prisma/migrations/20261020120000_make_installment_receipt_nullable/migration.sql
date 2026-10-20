-- Existing unpaid installments must be representable without a receipt.
ALTER TABLE "installment"
  ALTER COLUMN "receipt_id" DROP NOT NULL;
