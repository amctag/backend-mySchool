-- CreateTable
CREATE TABLE "school_details" (
    "id" SERIAL NOT NULL,
    "telephone" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(255) NOT NULL,
    "fax" VARCHAR(255) NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "website" VARCHAR(255) NOT NULL,
    "about" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "school_details_pkey" PRIMARY KEY ("id")
);
