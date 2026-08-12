CREATE TABLE "albums" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 1,
    "year_id" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "albums_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "album_images" (
    "id" SERIAL NOT NULL,
    "album_id" INTEGER NOT NULL,
    "image_link" TEXT NOT NULL,
    "caption" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "album_images_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "albums"
ADD CONSTRAINT "albums_school_id_fkey"
FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "albums"
ADD CONSTRAINT "albums_year_id_fkey"
FOREIGN KEY ("year_id") REFERENCES "years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "album_images"
ADD CONSTRAINT "album_images_album_id_fkey"
FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;
