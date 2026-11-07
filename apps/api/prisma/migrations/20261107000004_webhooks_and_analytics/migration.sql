-- AlterEnum
ALTER TYPE "CampaignRecipientStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "CampaignRecipientStatus" ADD VALUE IF NOT EXISTS 'BOUNCED';

-- CreateEnum
CREATE TYPE "EmailEventType" AS ENUM (
  'SENT',
  'DELIVERED',
  'OPENED',
  'CLICKED',
  'BOUNCED',
  'COMPLAINED',
  'UNSUBSCRIBED',
  'DELIVERY_DELAYED'
);

-- AlterTable campaigns
ALTER TABLE "campaigns"
ADD COLUMN IF NOT EXISTS "delivered_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "opened_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "clicked_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "bounced_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "complained_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "unsubscribed_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable campaign_recipients
ALTER TABLE "campaign_recipients"
ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "opened_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "clicked_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "bounced_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "campaign_recipients_provider_message_id_idx" ON "campaign_recipients"("provider_message_id");

-- CreateTable email_events
CREATE TABLE IF NOT EXISTS "email_events" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "campaign_id" TEXT NOT NULL,
  "campaign_recipient_id" TEXT NOT NULL,
  "contact_id" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'RESEND',
  "provider_event_id" TEXT NOT NULL,
  "event_type" "EmailEventType" NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "email_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "email_events_provider_provider_event_id_key" ON "email_events"("provider", "provider_event_id");
CREATE INDEX IF NOT EXISTS "email_events_workspace_id_occurred_at_idx" ON "email_events"("workspace_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "email_events_campaign_id_event_type_idx" ON "email_events"("campaign_id", "event_type");
CREATE INDEX IF NOT EXISTS "email_events_campaign_recipient_id_event_type_idx" ON "email_events"("campaign_recipient_id", "event_type");
CREATE INDEX IF NOT EXISTS "email_events_contact_id_idx" ON "email_events"("contact_id");

-- AddForeignKey
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_campaign_recipient_id_fkey" FOREIGN KEY ("campaign_recipient_id") REFERENCES "campaign_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
