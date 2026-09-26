-- Agenda status meanings:
--   0 = draft (author teacher only)
--   2 = saved (teacher + supervisor + school)
--   1 = published (parents + everyone)
-- Existing status 0 rows were shared unpublished items; move them to saved (2).
UPDATE "agendas" SET "status" = 2 WHERE "status" = 0 AND "deleted_at" IS NULL;
