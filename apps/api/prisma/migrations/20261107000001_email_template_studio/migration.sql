-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('MARKETING', 'NEWSLETTER', 'TRANSACTIONAL', 'WELCOME', 'PROMOTIONAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'READY');

-- CreateTable email_templates
CREATE TABLE IF NOT EXISTS "email_templates" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "TemplateCategory" NOT NULL DEFAULT 'MARKETING',
    "subject" TEXT,
    "preheader" TEXT,
    "html_content" TEXT NOT NULL,
    "editor_content" JSONB,
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_templates_workspace_id_status_idx" ON "email_templates"("workspace_id", "status");
CREATE INDEX IF NOT EXISTS "email_templates_workspace_id_category_idx" ON "email_templates"("workspace_id", "category");

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
