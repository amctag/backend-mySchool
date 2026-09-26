-- AlterTable
ALTER TABLE "persons" ADD COLUMN     "account_id" INTEGER;

-- CreateTable
CREATE TABLE "accounting_register_types" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "accounting_register_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(255) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_register" (
    "id" SERIAL NOT NULL,
    "description" TEXT,
    "date_created" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accounting_register_type_id" INTEGER NOT NULL,
    "currency_id" INTEGER,
    "notes" TEXT,
    "comments" TEXT,
    "currency_rate" DECIMAL(18,6),
    "school_id" INTEGER NOT NULL,
    "user_id" INTEGER,

    CONSTRAINT "accounting_register_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_daily" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL,
    "credit" DECIMAL(18,2) NOT NULL,
    "description" TEXT,
    "accounting_register_id" INTEGER NOT NULL,

    CONSTRAINT "accounting_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_receipts" (
    "id" SERIAL NOT NULL,
    "accounting_register_id" INTEGER NOT NULL,
    "nb" INTEGER NOT NULL,

    CONSTRAINT "accounting_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_payments" (
    "id" SERIAL NOT NULL,
    "accounting_register_id" INTEGER NOT NULL,
    "nb" INTEGER NOT NULL,

    CONSTRAINT "accounting_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_sales" (
    "id" SERIAL NOT NULL,
    "accounting_register_id" INTEGER NOT NULL,
    "nb" INTEGER NOT NULL,

    CONSTRAINT "accounting_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_purchase" (
    "id" SERIAL NOT NULL,
    "accounting_register_id" INTEGER NOT NULL,
    "nb" INTEGER NOT NULL,

    CONSTRAINT "accounting_purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_sales_return" (
    "id" SERIAL NOT NULL,
    "accounting_register_id" INTEGER NOT NULL,
    "nb" INTEGER NOT NULL,

    CONSTRAINT "accounting_sales_return_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_purchase_return" (
    "id" SERIAL NOT NULL,
    "accounting_register_id" INTEGER NOT NULL,
    "nb" INTEGER NOT NULL,

    CONSTRAINT "accounting_purchase_return_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_invoice" (
    "id" SERIAL NOT NULL,
    "date_created" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "accounting_register_id" INTEGER NOT NULL,
    "tax" DECIMAL(18,2) NOT NULL,
    "discount" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "accounting_invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_invoice_details" (
    "id" SERIAL NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "unit_price" DECIMAL(18,2) NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "description" TEXT,
    "discount" DECIMAL(18,2) NOT NULL,
    "tax" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "accounting_invoice_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_types" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "item_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "school_id" INTEGER NOT NULL,
    "item_type_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_registration_package" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "year_id" INTEGER NOT NULL,
    "date_created" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_registration_package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_registration_package_items" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "mandatory" BOOLEAN NOT NULL,
    "accounting_registration_package_id" INTEGER NOT NULL,
    "date_created" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency_id" INTEGER,

    CONSTRAINT "accounting_registration_package_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_registration_package_classes" (
    "id" SERIAL NOT NULL,
    "accounting_registration_package_id" INTEGER NOT NULL,
    "class_id" INTEGER NOT NULL,
    "date_created" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_registration_package_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installment" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "receipt_id" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "year_id" INTEGER NOT NULL,
    "date" DATE,
    "date_created" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" INTEGER,

    CONSTRAINT "installment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounting_register_types_name_key" ON "accounting_register_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_code_key" ON "accounts"("code");

-- CreateIndex
CREATE INDEX "accounting_register_accounting_register_type_id_idx" ON "accounting_register"("accounting_register_type_id");

-- CreateIndex
CREATE INDEX "accounting_register_school_id_idx" ON "accounting_register"("school_id");

-- CreateIndex
CREATE INDEX "accounting_daily_account_id_idx" ON "accounting_daily"("account_id");

-- CreateIndex
CREATE INDEX "accounting_daily_accounting_register_id_idx" ON "accounting_daily"("accounting_register_id");

-- CreateIndex
CREATE INDEX "accounting_receipts_accounting_register_id_idx" ON "accounting_receipts"("accounting_register_id");

-- CreateIndex
CREATE INDEX "accounting_payments_accounting_register_id_idx" ON "accounting_payments"("accounting_register_id");

-- CreateIndex
CREATE INDEX "accounting_sales_accounting_register_id_idx" ON "accounting_sales"("accounting_register_id");

-- CreateIndex
CREATE INDEX "accounting_purchase_accounting_register_id_idx" ON "accounting_purchase"("accounting_register_id");

-- CreateIndex
CREATE INDEX "accounting_sales_return_accounting_register_id_idx" ON "accounting_sales_return"("accounting_register_id");

-- CreateIndex
CREATE INDEX "accounting_purchase_return_accounting_register_id_idx" ON "accounting_purchase_return"("accounting_register_id");

-- CreateIndex
CREATE INDEX "accounting_invoice_accounting_register_id_idx" ON "accounting_invoice"("accounting_register_id");

-- CreateIndex
CREATE INDEX "accounting_invoice_details_invoice_id_idx" ON "accounting_invoice_details"("invoice_id");

-- CreateIndex
CREATE INDEX "accounting_invoice_details_item_id_idx" ON "accounting_invoice_details"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_types_name_key" ON "item_types"("name");

-- CreateIndex
CREATE INDEX "items_school_id_idx" ON "items"("school_id");

-- CreateIndex
CREATE INDEX "items_item_type_id_idx" ON "items"("item_type_id");

-- CreateIndex
CREATE INDEX "accounting_registration_package_year_id_idx" ON "accounting_registration_package"("year_id");

-- CreateIndex
CREATE INDEX "accounting_registration_package_items_item_id_idx" ON "accounting_registration_package_items"("item_id");

-- CreateIndex
CREATE INDEX "accounting_registration_package_items_accounting_registrati_idx" ON "accounting_registration_package_items"("accounting_registration_package_id");

-- CreateIndex
CREATE INDEX "accounting_registration_package_classes_accounting_registra_idx" ON "accounting_registration_package_classes"("accounting_registration_package_id");

-- CreateIndex
CREATE INDEX "accounting_registration_package_classes_class_id_idx" ON "accounting_registration_package_classes"("class_id");

-- CreateIndex
CREATE INDEX "installment_account_id_idx" ON "installment"("account_id");

-- CreateIndex
CREATE INDEX "installment_receipt_id_idx" ON "installment"("receipt_id");

-- CreateIndex
CREATE INDEX "installment_year_id_idx" ON "installment"("year_id");

-- CreateIndex
CREATE INDEX "persons_account_id_idx" ON "persons"("account_id");

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_register" ADD CONSTRAINT "accounting_register_accounting_register_type_id_fkey" FOREIGN KEY ("accounting_register_type_id") REFERENCES "accounting_register_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_register" ADD CONSTRAINT "accounting_register_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_daily" ADD CONSTRAINT "accounting_daily_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_daily" ADD CONSTRAINT "accounting_daily_accounting_register_id_fkey" FOREIGN KEY ("accounting_register_id") REFERENCES "accounting_register"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_receipts" ADD CONSTRAINT "accounting_receipts_accounting_register_id_fkey" FOREIGN KEY ("accounting_register_id") REFERENCES "accounting_register"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_payments" ADD CONSTRAINT "accounting_payments_accounting_register_id_fkey" FOREIGN KEY ("accounting_register_id") REFERENCES "accounting_register"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_sales" ADD CONSTRAINT "accounting_sales_accounting_register_id_fkey" FOREIGN KEY ("accounting_register_id") REFERENCES "accounting_register"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_purchase" ADD CONSTRAINT "accounting_purchase_accounting_register_id_fkey" FOREIGN KEY ("accounting_register_id") REFERENCES "accounting_register"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_sales_return" ADD CONSTRAINT "accounting_sales_return_accounting_register_id_fkey" FOREIGN KEY ("accounting_register_id") REFERENCES "accounting_register"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_purchase_return" ADD CONSTRAINT "accounting_purchase_return_accounting_register_id_fkey" FOREIGN KEY ("accounting_register_id") REFERENCES "accounting_register"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_invoice" ADD CONSTRAINT "accounting_invoice_accounting_register_id_fkey" FOREIGN KEY ("accounting_register_id") REFERENCES "accounting_register"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_invoice_details" ADD CONSTRAINT "accounting_invoice_details_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "accounting_invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_invoice_details" ADD CONSTRAINT "accounting_invoice_details_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_item_type_id_fkey" FOREIGN KEY ("item_type_id") REFERENCES "item_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_registration_package" ADD CONSTRAINT "accounting_registration_package_year_id_fkey" FOREIGN KEY ("year_id") REFERENCES "years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_registration_package_items" ADD CONSTRAINT "accounting_registration_package_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_registration_package_items" ADD CONSTRAINT "accounting_registration_package_items_accounting_registrat_fkey" FOREIGN KEY ("accounting_registration_package_id") REFERENCES "accounting_registration_package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_registration_package_classes" ADD CONSTRAINT "accounting_registration_package_classes_accounting_registr_fkey" FOREIGN KEY ("accounting_registration_package_id") REFERENCES "accounting_registration_package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_registration_package_classes" ADD CONSTRAINT "accounting_registration_package_classes_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment" ADD CONSTRAINT "installment_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment" ADD CONSTRAINT "installment_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "accounting_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment" ADD CONSTRAINT "installment_year_id_fkey" FOREIGN KEY ("year_id") REFERENCES "years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
