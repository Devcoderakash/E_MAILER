-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "scheduled_timezone" TEXT,
ADD COLUMN IF NOT EXISTS "scheduled_job_id" TEXT,
ADD COLUMN IF NOT EXISTS "last_scheduled_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "scheduling_error" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "campaigns_workspace_id_scheduled_at_idx" ON "campaigns"("workspace_id", "scheduled_at");

