-- Legacy migration batch tracking and OLD -> NEW ID mapping/audit.
-- Additive only: never edit historical migrations.
-- No passwords, secrets, or personal data beyond audit-safe metadata.

CREATE TABLE "legacy_migration_batches" (
    "id" SERIAL NOT NULL,
    "source" VARCHAR(255) NOT NULL,
    "school_id" INTEGER NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMPTZ(6) NULL,
    "completed_at" TIMESTAMPTZ(6) NULL,
    "metadata" JSONB NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "legacy_migration_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "legacy_migration_batches_school_id_idx"
  ON "legacy_migration_batches"("school_id");
CREATE INDEX "legacy_migration_batches_status_idx"
  ON "legacy_migration_batches"("status");

ALTER TABLE "legacy_migration_batches"
  ADD CONSTRAINT "legacy_migration_batches_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "legacy_migration_map" (
    "id" SERIAL NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "entity_type" VARCHAR(32) NOT NULL,
    "legacy_id" INTEGER NOT NULL,
    "new_id" INTEGER NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'IMPORTED',
    "review_reason" VARCHAR(1000) NULL,
    "source_metadata" JSONB NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "legacy_migration_map_pkey" PRIMARY KEY ("id")
);

-- Idempotency: one mapping per (batch, entity, legacy id). Reruns reuse it.
CREATE UNIQUE INDEX "legacy_migration_map_batch_entity_legacy_key"
  ON "legacy_migration_map"("batch_id", "entity_type", "legacy_id");
CREATE INDEX "legacy_migration_map_batch_id_idx"
  ON "legacy_migration_map"("batch_id");
CREATE INDEX "legacy_migration_map_entity_new_idx"
  ON "legacy_migration_map"("entity_type", "new_id");

ALTER TABLE "legacy_migration_map"
  ADD CONSTRAINT "legacy_migration_map_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "legacy_migration_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
