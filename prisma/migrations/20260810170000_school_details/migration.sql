CREATE TABLE "school_details" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "telephone" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(255) NOT NULL,
    "fax" VARCHAR(255) NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "website" VARCHAR(255) NOT NULL,
    "about" TEXT NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "school_details_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_details_school_id_key"
ON "school_details"("school_id");

ALTER TABLE "school_details"
ADD CONSTRAINT "school_details_school_id_fkey"
FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE CASCADE ON UPDATE CASCADE;
