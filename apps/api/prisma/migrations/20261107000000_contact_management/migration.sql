-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('ACTIVE', 'UNSUBSCRIBED', 'BOUNCED');

-- CreateEnum
CREATE TYPE "ContactSource" AS ENUM ('MANUAL', 'CSV', 'API');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable contacts
CREATE TABLE IF NOT EXISTS "contacts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "status" "ContactStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "ContactSource" NOT NULL DEFAULT 'MANUAL',
    "custom_fields" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable contact_lists
CREATE TABLE IF NOT EXISTS "contact_lists" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable contact_list_members
CREATE TABLE IF NOT EXISTS "contact_list_members" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "list_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_list_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable contact_tags
CREATE TABLE IF NOT EXISTS "contact_tags" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#4f46e5',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable contact_tag_assignments
CREATE TABLE IF NOT EXISTS "contact_tag_assignments" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "contact_tag_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable import_jobs
CREATE TABLE IF NOT EXISTS "import_jobs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "imported_rows" INTEGER NOT NULL DEFAULT 0,
    "skipped_rows" INTEGER NOT NULL DEFAULT 0,
    "failed_rows" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "error_report" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contacts_workspace_id_status_idx" ON "contacts"("workspace_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_workspace_id_email_key" ON "contacts"("workspace_id", "email");
CREATE UNIQUE INDEX IF NOT EXISTS "contact_lists_workspace_id_name_key" ON "contact_lists"("workspace_id", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "contact_list_members_contact_id_list_id_key" ON "contact_list_members"("contact_id", "list_id");
CREATE UNIQUE INDEX IF NOT EXISTS "contact_tags_workspace_id_name_key" ON "contact_tags"("workspace_id", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "contact_tag_assignments_contact_id_tag_id_key" ON "contact_tag_assignments"("contact_id", "tag_id");

-- Foreign Keys
ALTER TABLE "contacts" DROP CONSTRAINT IF EXISTS "contacts_workspace_id_fkey";
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contact_lists" DROP CONSTRAINT IF EXISTS "contact_lists_workspace_id_fkey";
ALTER TABLE "contact_lists" ADD CONSTRAINT "contact_lists_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contact_list_members" DROP CONSTRAINT IF EXISTS "contact_list_members_contact_id_fkey";
ALTER TABLE "contact_list_members" ADD CONSTRAINT "contact_list_members_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contact_list_members" DROP CONSTRAINT IF EXISTS "contact_list_members_list_id_fkey";
ALTER TABLE "contact_list_members" ADD CONSTRAINT "contact_list_members_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "contact_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contact_tags" DROP CONSTRAINT IF EXISTS "contact_tags_workspace_id_fkey";
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contact_tag_assignments" DROP CONSTRAINT IF EXISTS "contact_tag_assignments_contact_id_fkey";
ALTER TABLE "contact_tag_assignments" ADD CONSTRAINT "contact_tag_assignments_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contact_tag_assignments" DROP CONSTRAINT IF EXISTS "contact_tag_assignments_tag_id_fkey";
ALTER TABLE "contact_tag_assignments" ADD CONSTRAINT "contact_tag_assignments_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "contact_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "import_jobs" DROP CONSTRAINT IF EXISTS "import_jobs_workspace_id_fkey";
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
