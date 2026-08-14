-- Run this in Easypanel PostgreSQL console if deploy still fails
-- because 20260812160000_exam_schedule_detail_start_time is marked failed.

UPDATE "_prisma_migrations"
SET rolled_back_at = NOW()
WHERE migration_name = '20260812160000_exam_schedule_detail_start_time'
  AND finished_at IS NULL
  AND rolled_back_at IS NULL;

SELECT migration_name, finished_at, rolled_back_at, started_at
FROM "_prisma_migrations"
WHERE migration_name LIKE '%exam%'
ORDER BY started_at;
