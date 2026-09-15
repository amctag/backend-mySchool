CREATE TABLE IF NOT EXISTS "parent_notifications" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "type" VARCHAR(100),
    "route" VARCHAR(100),
    "data" TEXT NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "parent_notifications_person_id_created_at_idx"
ON "parent_notifications"("person_id", "created_at" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'parent_notifications_person_id_fkey'
  ) THEN
    ALTER TABLE "parent_notifications"
    ADD CONSTRAINT "parent_notifications_person_id_fkey"
    FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
