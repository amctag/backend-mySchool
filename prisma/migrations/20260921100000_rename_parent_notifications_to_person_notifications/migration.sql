DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'parent_notifications'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'person_notifications'
  ) THEN
    ALTER TABLE "parent_notifications" RENAME TO "person_notifications";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'parent_notifications_person_id_created_at_idx'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'person_notifications_person_id_created_at_idx'
  ) THEN
    ALTER INDEX "parent_notifications_person_id_created_at_idx"
      RENAME TO "person_notifications_person_id_created_at_idx";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parent_notifications_pkey'
  ) THEN
    ALTER TABLE "person_notifications"
      RENAME CONSTRAINT "parent_notifications_pkey" TO "person_notifications_pkey";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parent_notifications_person_id_fkey'
  ) THEN
    ALTER TABLE "person_notifications"
      RENAME CONSTRAINT "parent_notifications_person_id_fkey"
      TO "person_notifications_person_id_fkey";
  END IF;
END $$;
