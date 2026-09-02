-- Set class_courses.coefficient = max grade (العلامة القصوى) per course and class level.
-- Safe to re-run. Change year title if your current year differs.

UPDATE class_courses cc
SET
  coefficient = CASE
    WHEN co.title = 'Physical Education' THEN 10
    WHEN cl.class_level <= 3 AND co.title IN ('History', 'Geography') THEN 10
    WHEN cl.class_level <= 3 THEN 10
    WHEN cl.class_level <= 6 AND co.title IN ('History', 'Geography') THEN 15
    WHEN co.title IN ('History', 'Geography') THEN 15
    ELSE 20
  END,
  updated_at = NOW()
FROM courses co, classes cl, years y
WHERE cc.course_id = co.id
  AND cc.class_id = cl.id
  AND cc.year_id = y.id
  AND y.title = '2026-2027';

-- Verify (sample)
SELECT cl.class_name, co.title AS course, cc.coefficient AS max_grade, cc.number_of_hours
FROM class_courses cc
JOIN classes cl ON cl.id = cc.class_id
JOIN courses co ON co.id = cc.course_id
JOIN years y ON y.id = cc.year_id
WHERE y.title = '2026-2027'
ORDER BY cl.class_level, co.title
LIMIT 30;
