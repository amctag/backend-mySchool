-- Convert grade_form.average from boolean to integer (true -> 1, false -> 0)
ALTER TABLE "grade_form" ALTER COLUMN "average" DROP DEFAULT;

ALTER TABLE "grade_form"
  ALTER COLUMN "average" TYPE INTEGER
  USING (CASE WHEN "average" THEN 1 ELSE 0 END);

ALTER TABLE "grade_form" ALTER COLUMN "average" SET DEFAULT 0;
ALTER TABLE "grade_form" ALTER COLUMN "average" SET NOT NULL;
