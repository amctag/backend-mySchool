-- Seed 9 grade types for school_id = 1 (report card columns: 3 terms x 3 assessments)
-- Run in PostgreSQL. Safe to re-run: skips titles that already exist for this school.

INSERT INTO grade_types (
  school_id,
  title,
  is_abstract,
  position,
  is_main,
  type,
  status,
  created_at,
  updated_at
)
SELECT
  1,
  v.title,
  v.is_abstract,
  v.position,
  v.is_main,
  v.type,
  TRUE,
  NOW(),
  NOW()
FROM (
  VALUES
    -- Term 1
    ('عمل يومي للفصل الأول', FALSE, 1, FALSE, 'homework'),
    ('اختبار الفصل الأول', FALSE, 2, FALSE, 'test'),
    ('الامتحان النهائي للفصل الأول', FALSE, 3, TRUE, 'exam'),
    -- Term 2
    ('عمل يومي للفصل الثاني', FALSE, 4, FALSE, 'homework'),
    ('اختبار الفصل الثاني', FALSE, 5, FALSE, 'test'),
    ('الامتحان النهائي للفصل الثاني', FALSE, 6, TRUE, 'exam'),
    -- Term 3
    ('عمل يومي للفصل الثالث', FALSE, 7, FALSE, 'homework'),
    ('اختبار الفصل الثالث', FALSE, 8, FALSE, 'test'),
    ('الامتحان النهائي للفصل الثالث', FALSE, 9, TRUE, 'exam')
) AS v(title, is_abstract, position, is_main, type)
WHERE EXISTS (SELECT 1 FROM school WHERE id = 1)
  AND NOT EXISTS (
    SELECT 1
    FROM grade_types gt
    WHERE gt.school_id = 1
      AND gt.title = v.title
  );

-- Verify
SELECT id, school_id, title, position, type, is_main, status
FROM grade_types
WHERE school_id = 1
ORDER BY position, id;
