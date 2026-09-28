-- Manual balanced Accounting Record (journal entry) document.
-- Additive only: never edit historical migrations.

-- Record document numbering register type (idempotent seed for the counter).
INSERT INTO "accounting_register_types" ("name")
VALUES ('Record')
ON CONFLICT ("name") DO NOTHING;

CREATE TABLE "accounting_records" (
    "id" SERIAL NOT NULL,
    "accounting_register_id" INTEGER NOT NULL,
    "school_id" INTEGER NOT NULL,
    "nb" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "accounting_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "accounting_records_accounting_register_id_key"
  ON "accounting_records"("accounting_register_id");
CREATE UNIQUE INDEX "accounting_records_school_id_nb_key"
  ON "accounting_records"("school_id", "nb");
CREATE INDEX "accounting_records_school_id_idx"
  ON "accounting_records"("school_id");

ALTER TABLE "accounting_records"
  ADD CONSTRAINT "accounting_records_accounting_register_id_fkey"
  FOREIGN KEY ("accounting_register_id") REFERENCES "accounting_register"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounting_records"
  ADD CONSTRAINT "accounting_records_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
