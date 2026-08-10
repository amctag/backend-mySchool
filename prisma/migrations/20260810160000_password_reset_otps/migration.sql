CREATE TABLE "password_reset_otps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "person_id" INTEGER NOT NULL,
    "otp_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_otps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_otps_person_id_key"
ON "password_reset_otps"("person_id");

ALTER TABLE "password_reset_otps"
ADD CONSTRAINT "password_reset_otps_person_id_fkey"
FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
