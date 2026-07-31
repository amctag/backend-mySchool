-- CreateTable
CREATE TABLE "persons" (
    "id" SERIAL NOT NULL,
    "register_id" INTEGER,
    "username" VARCHAR(100) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "middle_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255),
    "phone_number" VARCHAR(50),
    "landline" VARCHAR(50),
    "urgent_number" VARCHAR(50),
    "address" TEXT,
    "birthday" DATE,
    "gender" SMALLINT,
    "picture" VARCHAR(255),
    "status" BOOLEAN NOT NULL DEFAULT true,
    "identity_number" VARCHAR(50),
    "nationality_id" INTEGER,
    "governorate_id" INTEGER,
    "region_id" INTEGER,
    "village_id" INTEGER,
    "blood_type_id" INTEGER,
    "identity_type_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teachers" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parents" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "current_job_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "parents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "parent_id" INTEGER,
    "mother_name" VARCHAR(255),
    "mother_family" VARCHAR(255),
    "mother_phone" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "persons_username_key" ON "persons"("username");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_person_id_key" ON "teachers"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "parents_person_id_key" ON "parents"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_person_id_key" ON "students"("person_id");

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parents" ADD CONSTRAINT "parents_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "parents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
