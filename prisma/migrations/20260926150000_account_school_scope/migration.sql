CREATE SEQUENCE "account_code_seq"
    AS BIGINT
    START 100001
    INCREMENT 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE "accounts" ADD COLUMN "school_id" INTEGER NOT NULL;

CREATE INDEX "accounts_school_id_idx" ON "accounts"("school_id");

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_school_id_fkey"
FOREIGN KEY ("school_id") REFERENCES "school"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
