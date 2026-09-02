-- Seed 7 sessions (periods) per school.
-- Safe to re-run: skips positions that already exist for each school.
-- Change :school_id filter below if you only want one school.

-- Option A: all schools
INSERT INTO sessions (school_id, session_name, position, status, created_at, updated_at)
SELECT s.id, v.session_name, v.position, TRUE, NOW(), NOW()
FROM school s
CROSS JOIN (
  VALUES
    ('Session 1', 1),
    ('Session 2', 2),
    ('Session 3', 3),
    ('Session 4', 4),
    ('Session 5', 5),
    ('Session 6', 6),
    ('Session 7', 7)
) AS v(session_name, position)
WHERE NOT EXISTS (
  SELECT 1
  FROM sessions ses
  WHERE ses.school_id = s.id
    AND ses.position = v.position
);

-- Verify
SELECT school_id, id, session_name, position, status
FROM sessions
ORDER BY school_id, position;

-- ---------------------------------------------------------------------------
-- Option B: single school only (uncomment and set school id)
-- ---------------------------------------------------------------------------
-- INSERT INTO sessions (school_id, session_name, position, status, created_at, updated_at)
-- SELECT 1, v.session_name, v.position, TRUE, NOW(), NOW()
-- FROM (
--   VALUES
--     ('Session 1', 1),
--     ('Session 2', 2),
--     ('Session 3', 3),
--     ('Session 4', 4),
--     ('Session 5', 5),
--     ('Session 6', 6),
--     ('Session 7', 7)
-- ) AS v(session_name, position)
-- WHERE NOT EXISTS (
--   SELECT 1 FROM sessions ses WHERE ses.school_id = 1 AND ses.position = v.position
-- );
