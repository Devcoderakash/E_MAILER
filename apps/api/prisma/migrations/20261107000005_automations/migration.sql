-- CreateEnum
CREATE TYPE "AutomationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "AutomationExecutionStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "AutomationStepStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE IF NOT EXISTS "automations" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "AutomationStatus" NOT NULL DEFAULT 'DRAFT',
  "trigger_type" TEXT NOT NULL,
  "workflow_definition" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "activated_at" TIMESTAMP(3),

  CONSTRAINT "automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "automation_executions" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "automation_id" TEXT NOT NULL,
  "contact_id" TEXT NOT NULL,
  "status" "AutomationExecutionStatus" NOT NULL DEFAULT 'RUNNING',
  "current_node_id" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "error_message" TEXT,
  "context_data" JSONB,

  CONSTRAINT "automation_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "automation_step_executions" (
  "id" TEXT NOT NULL,
  "execution_id" TEXT NOT NULL,
  "node_id" TEXT NOT NULL,
  "node_type" TEXT NOT NULL,
  "status" "AutomationStepStatus" NOT NULL DEFAULT 'COMPLETED',
  "scheduled_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "result" JSONB,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "automation_step_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "automations_workspace_id_status_idx" ON "automations"("workspace_id", "status");
CREATE INDEX IF NOT EXISTS "automations_workspace_id_trigger_type_idx" ON "automations"("workspace_id", "trigger_type");

CREATE INDEX IF NOT EXISTS "automation_executions_workspace_id_status_idx" ON "automation_executions"("workspace_id", "status");
CREATE INDEX IF NOT EXISTS "automation_executions_automation_id_status_idx" ON "automation_executions"("automation_id", "status");
CREATE INDEX IF NOT EXISTS "automation_executions_contact_id_idx" ON "automation_executions"("contact_id");

CREATE INDEX IF NOT EXISTS "automation_step_executions_execution_id_idx" ON "automation_step_executions"("execution_id");
CREATE INDEX IF NOT EXISTS "automation_step_executions_node_id_idx" ON "automation_step_executions"("node_id");

-- AddForeignKey
ALTER TABLE "automations" ADD CONSTRAINT "automations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "automation_step_executions" ADD CONSTRAINT "automation_step_executions_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "automation_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
