CREATE TABLE "fcm_tokens" (
    "person_id" INTEGER NOT NULL,
    "fcm_token" TEXT NOT NULL,

    CONSTRAINT "fcm_tokens_pkey" PRIMARY KEY ("person_id")
);

ALTER TABLE "fcm_tokens" ADD CONSTRAINT "fcm_tokens_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
