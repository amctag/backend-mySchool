-- CreateTable
CREATE TABLE "school_sessions" (
    "id" UUID NOT NULL,
    "person_id" INTEGER NOT NULL,
    "refresh_token_hash" VARCHAR(64) NOT NULL,
    "replaced_token_hash" VARCHAR(64),
    "refresh_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "user_agent" VARCHAR(512),
    "ip_address" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "school_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "school_sessions_person_id_key" ON "school_sessions"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "school_sessions_refresh_token_hash_key" ON "school_sessions"("refresh_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "school_sessions_replaced_token_hash_key" ON "school_sessions"("replaced_token_hash");

-- AddForeignKey
ALTER TABLE "school_sessions" ADD CONSTRAINT "school_sessions_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
