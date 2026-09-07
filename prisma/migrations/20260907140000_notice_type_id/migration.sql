ALTER TABLE "notices" ADD COLUMN "notice_type_id" INTEGER;

ALTER TABLE "notices" ADD CONSTRAINT "notices_notice_type_id_fkey" FOREIGN KEY ("notice_type_id") REFERENCES "notice_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "notices_notice_type_id_idx" ON "notices"("notice_type_id");
