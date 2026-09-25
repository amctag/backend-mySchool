-- CreateTable
CREATE TABLE "teacher_tasks" (
    "id" SERIAL NOT NULL,
    "school_id" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "teacher_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_task_completions" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "completed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_task_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teacher_tasks_school_id_created_at_idx" ON "teacher_tasks"("school_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "teacher_task_completions_teacher_id_completed_at_idx" ON "teacher_task_completions"("teacher_id", "completed_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "teacher_task_completions_task_id_teacher_id_key" ON "teacher_task_completions"("task_id", "teacher_id");

-- AddForeignKey
ALTER TABLE "teacher_tasks" ADD CONSTRAINT "teacher_tasks_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_task_completions" ADD CONSTRAINT "teacher_task_completions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "teacher_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_task_completions" ADD CONSTRAINT "teacher_task_completions_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
