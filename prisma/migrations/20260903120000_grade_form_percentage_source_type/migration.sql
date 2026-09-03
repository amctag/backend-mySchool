-- Add source grade type for expression rows on a grade-form detail.
ALTER TABLE "grade_form_percentage"
ADD COLUMN IF NOT EXISTS "source_grade_type_id" INTEGER;

CREATE INDEX IF NOT EXISTS "grade_form_percentage_grade_format_detail_id_idx"
ON "grade_form_percentage"("grade_format_detail_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'grade_form_percentage_source_grade_type_id_fkey'
  ) THEN
    ALTER TABLE "grade_form_percentage"
    ADD CONSTRAINT "grade_form_percentage_source_grade_type_id_fkey"
    FOREIGN KEY ("source_grade_type_id") REFERENCES "grade_types"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
