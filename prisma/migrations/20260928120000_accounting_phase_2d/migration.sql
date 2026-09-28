CREATE TABLE "accounting_payment_details" (
    "id" SERIAL NOT NULL,
    "accounting_payment_id" INTEGER NOT NULL,
    "account_id" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT,
    "date_created" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_payment_details_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "accounting_payment_details_accounting_payment_id_idx"
ON "accounting_payment_details"("accounting_payment_id");

CREATE INDEX "accounting_payment_details_account_id_idx"
ON "accounting_payment_details"("account_id");

ALTER TABLE "accounting_payment_details"
ADD CONSTRAINT "accounting_payment_details_accounting_payment_id_fkey"
FOREIGN KEY ("accounting_payment_id") REFERENCES "accounting_payments"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "accounting_payment_details"
ADD CONSTRAINT "accounting_payment_details_account_id_fkey"
FOREIGN KEY ("account_id") REFERENCES "accounts"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "accounting_registration_package_items_accounting_registration_package_id_item_id_key"
ON "accounting_registration_package_items"("accounting_registration_package_id", "item_id");

CREATE UNIQUE INDEX "accounting_registration_package_classes_accounting_registration_package_id_class_id_key"
ON "accounting_registration_package_classes"("accounting_registration_package_id", "class_id");

ALTER TABLE "accounting_registration_package_items"
ADD CONSTRAINT "accounting_registration_package_items_currency_id_fkey"
FOREIGN KEY ("currency_id") REFERENCES "currency"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
