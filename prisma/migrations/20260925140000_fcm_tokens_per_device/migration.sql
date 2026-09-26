-- One person can keep a phone token and a web token at the same time.
ALTER TABLE "fcm_tokens" DROP CONSTRAINT "fcm_tokens_pkey";

ALTER TABLE "fcm_tokens" ADD COLUMN "id" SERIAL NOT NULL;

ALTER TABLE "fcm_tokens" ADD CONSTRAINT "fcm_tokens_pkey" PRIMARY KEY ("id");

CREATE UNIQUE INDEX "fcm_tokens_fcm_token_key" ON "fcm_tokens"("fcm_token");

CREATE INDEX "fcm_tokens_person_id_idx" ON "fcm_tokens"("person_id");
