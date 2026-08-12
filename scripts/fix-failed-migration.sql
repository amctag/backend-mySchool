-- Run this in Easypanel PostgreSQL console if deploy still fails.
-- Fixes failed migration: 20260812160000_exam_schedule_detail_start_time

-- Option A: mark as applied (use when start_time column already exists)
UPDATE "_prisma_migrations"
SET
  finished_at = COALESCE(finished_at, started_at, NOW()),
  applied_steps_count = 1,
  logs = NULL
WHERE migration_name = '20260812160000_exam_schedule_detail_start_time'
  AND finished_at IS NULL;

-- Option B: if Option A did not unblock deploy, mark as rolled back instead
-- UPDATE "_prisma_migrations"
-- SET rolled_back_at = NOW()
-- WHERE migration_name = '20260812160000_exam_schedule_detail_start_time'
--   AND finished_at IS NULL;

-- Verify
SELECT migration_name, finished_at, rolled_back_at, started_at
FROM "_prisma_migrations"
WHERE migration_name LIKE '%exam%'
ORDER BY started_at;
