-- CreateTable
CREATE TABLE "director" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "director_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "director_schools" (
    "id" SERIAL NOT NULL,
    "director_id" INTEGER NOT NULL,
    "school_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "director_schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "director_sessions" (
    "id" UUID NOT NULL,
    "person_id" INTEGER NOT NULL,
    "school_id" INTEGER NOT NULL,
    "refresh_token_hash" VARCHAR(64) NOT NULL,
    "refresh_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "director_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "director_person_id_key" ON "director"("person_id");

-- CreateIndex
CREATE INDEX "director_schools_director_id_is_active_idx" ON "director_schools"("director_id", "is_active");

-- CreateIndex
CREATE INDEX "director_schools_school_id_is_active_idx" ON "director_schools"("school_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "director_schools_director_id_school_id_key" ON "director_schools"("director_id", "school_id");

-- CreateIndex
CREATE UNIQUE INDEX "director_sessions_refresh_token_hash_key" ON "director_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "director_sessions_person_id_idx" ON "director_sessions"("person_id");

-- CreateIndex
CREATE INDEX "director_sessions_school_id_idx" ON "director_sessions"("school_id");

-- AddForeignKey
ALTER TABLE "director" ADD CONSTRAINT "director_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "director_schools" ADD CONSTRAINT "director_schools_director_id_fkey" FOREIGN KEY ("director_id") REFERENCES "director"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "director_schools" ADD CONSTRAINT "director_schools_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "director_sessions" ADD CONSTRAINT "director_sessions_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "director_sessions" ADD CONSTRAINT "director_sessions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE CASCADE ON UPDATE CASCADE;
