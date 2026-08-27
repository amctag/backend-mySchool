-- CreateTable
CREATE TABLE "blood_types" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "blood_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blood_types_name_key" ON "blood_types"("name");

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_blood_type_id_fkey" FOREIGN KEY ("blood_type_id") REFERENCES "blood_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
