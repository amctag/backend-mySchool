-- CreateTable
CREATE TABLE "nationalities" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "nationalities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governorates" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "address" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "governorates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regions" (
    "id" SERIAL NOT NULL,
    "governorate_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "address" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_jobs" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "parent_jobs_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "persons" ADD COLUMN "description" TEXT;

-- Clear orphan lookup ids before adding FKs
UPDATE "persons" SET "nationality_id" = NULL;
UPDATE "persons" SET "governorate_id" = NULL;
UPDATE "persons" SET "region_id" = NULL;
UPDATE "parents" SET "current_job_id" = NULL;

-- CreateIndex
CREATE UNIQUE INDEX "nationalities_name_key" ON "nationalities"("name");

-- CreateIndex
CREATE UNIQUE INDEX "governorates_name_key" ON "governorates"("name");

-- CreateIndex
CREATE INDEX "regions_governorate_id_idx" ON "regions"("governorate_id");

-- CreateIndex
CREATE UNIQUE INDEX "regions_governorate_id_name_key" ON "regions"("governorate_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "parent_jobs_name_key" ON "parent_jobs"("name");

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_nationality_id_fkey" FOREIGN KEY ("nationality_id") REFERENCES "nationalities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_governorate_id_fkey" FOREIGN KEY ("governorate_id") REFERENCES "governorates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regions" ADD CONSTRAINT "regions_governorate_id_fkey" FOREIGN KEY ("governorate_id") REFERENCES "governorates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parents" ADD CONSTRAINT "parents_current_job_id_fkey" FOREIGN KEY ("current_job_id") REFERENCES "parent_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
