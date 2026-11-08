-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "default_email_provider" TEXT NOT NULL DEFAULT 'RESEND';

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'RESEND';

-- AlterTable
ALTER TABLE "campaign_recipients" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'RESEND';

