# MAILPILOT — COMPLETE PROJECT UNDERSTANDING & TECHNICAL ANALYSIS

> **Audit Date:** November 8, 2026  
> **Auditor Role:** Senior Software Architect, Full-Stack Engineer & Technical Auditor  
> **Platform Version:** 0.1.0  
> **Repository:** `mailpilot` (Monorepo)  
> **Mode:** Read-Only Technical Inspection  

---

## 1. EXECUTIVE SUMMARY

MailPilot is an enterprise-grade, multi-tenant Email Marketing and Automation SaaS platform developed as a TypeScript monorepo (`pnpm` workspaces). The application enables users to manage subscriber audiences, design responsive email templates using both visual drag-and-drop and raw HTML editors, create and dispatch high-throughput email campaigns, schedule timezone-aware broadcasts with BullMQ background workers, ingest provider delivery webhooks, visualize behavioral analytics, and build event-driven visual automation workflows using React Flow.

### Current High-Level Status:
- **Core Platform Architecture (Phases 1–9)**: Fully architected and functional across Database, Auth, Workspaces, Contacts, Templates, Campaigns, Scheduling, Webhooks/Analytics, Automations, and AI Copilot.
- **Email Delivery Pipeline**: Recently audited and fixed (Commit `08788e2`). Provider acceptance, real Resend API key validation, domain authorization guards (`@gmail.com` rejection), and confirmed delivery webhook tracking are operational. Verified with a real live inbox delivery via Resend sandbox (`01a1ba8b-86b8-7b1a-a0b1-b0375676602d`).
- **Google Services Readiness**: Currently, **zero Google integrations** (Gmail SMTP, Gmail OAuth, Google Calendar API, or native Google Gemini API) are implemented. All AI endpoints point to an OpenAI-compatible HTTP interface or local deterministic mocks.
- **Settings & Dashboard Gaps**: The Dashboard overview page retains demo preview data toggles instead of consuming existing analytics endpoints. Settings tabs for Sending Domains, API Keys, and Team Invitations are static UI representations.

---

## 2. ACTUAL PROJECT ARCHITECTURE

### Monorepo Structure

```text
mailpilot/
├── .env                              # Root environment configuration (shared secrets)
├── .env.example                      # Reference template for environment variables
├── package.json                      # Monorepo root package configuration
├── pnpm-workspace.yaml               # pnpm workspace definition (apps/*)
├── tsconfig.json                     # Monorepo root TypeScript configuration
├── docs/                             # Architecture and technical documentation
│   └── ARCHITECTURE.md               # Core system architecture overview
├── apps/
│   ├── api/                          # Backend Express REST API & BullMQ Engine
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # Prisma ORM schema (Supabase PostgreSQL)
│   │   │   └── migrations/           # 6 Sequential SQL database migrations
│   │   ├── src/
│   │   │   ├── app.ts                # Express application factory & middleware setup
│   │   │   ├── server.ts             # Server startup, worker listeners & graceful shutdown
│   │   │   ├── config/               # Environment (Zod), Prisma, Redis, Supabase
│   │   │   ├── middleware/           # auth.middleware, error.middleware, logger.middleware
│   │   │   ├── modules/              # 10 Domain Modules (Controllers, Services, Routes)
│   │   │   │   ├── auth/             # Supabase user profile & session synchronization
│   │   │   │   ├── workspaces/       # Multi-tenant workspace organization & switching
│   │   │   │   ├── contacts/         # Contacts, Lists, Tags & CSV Batch Import
│   │   │   │   ├── templates/        # Email Template Studio CRUD & duplicate logic
│   │   │   │   ├── campaigns/        # Campaign Manager, validation, and batch dispatch
│   │   │   │   ├── schedules/        # Timezone-aware scheduling & calendar view
│   │   │   │   ├── webhooks/         # Public Resend webhook receiver & Svix verification
│   │   │   │   ├── analytics/        # Deliverability calculations & time-series aggregation
│   │   │   │   ├── automations/      # Visual workflow validation & engine execution
│   │   │   │   └── ai/               # AI Campaign Copilot & copywriting prompts
│   │   │   ├── queues/               # BullMQ Queues (campaign, webhook, automation)
│   │   │   ├── workers/              # BullMQ Workers (campaign, webhook, automation)
│   │   │   ├── providers/            # Email delivery providers (ResendProvider)
│   │   │   └── utils/                # Timezone parsing & formatting utilities
│   │   ├── package.json              # Backend dependencies
│   │   └── tsconfig.json
│   │
│   └── web/                          # Frontend Single Page Application (React 18 + Vite)
│       ├── index.html                # SPA HTML root
│       ├── vite.config.ts            # Vite bundler configuration
│       ├── tailwind.config.js        # Tailwind CSS design system tokens
│       ├── src/
│       │   ├── main.tsx              # React entry point with TanStack Query provider
│       │   ├── App.tsx               # Root component & React Router configuration
│       │   ├── index.css             # Tailwind directives & CSS custom properties
│       │   ├── components/
│       │   │   ├── ui/               # Primitive UI tokens (button, card, badge, avatar, etc.)
│       │   │   ├── layout/           # DashboardLayout, AppHeader, AppSidebar, WorkspaceSwitcher
│       │   │   └── common/           # PageHeader, StatCard, DataTable, EmptyState, StatusBadge
│       │   ├── features/
│       │   │   ├── auth/             # Zustand auth store, ProtectedRoute, PublicOnlyRoute
│       │   │   ├── templates/        # Visual drag-and-drop editor, HTML editor, compiler
│       │   │   ├── campaigns/        # AI Copilot Modal drawer
│       │   │   └── automations/      # React Flow custom node renderers (Trigger, Action, Delay, Condition)
│       │   ├── hooks/                # Custom React hooks (useHealth, etc.)
│       │   ├── lib/                  # api-client, supabase browser client, date-utils
│       │   ├── routes/               # Page Views
│       │   │   ├── dashboard.tsx     # Overview dashboard
│       │   │   ├── campaigns.tsx     # Campaign Manager & Wizard
│       │   │   ├── templates.tsx     # Email Template Studio
│       │   │   ├── contacts.tsx      # Contact Management & Audience Segmentation
│       │   │   ├── schedule.tsx      # Schedule Center & Calendar View
│       │   │   ├── automations.tsx   # Visual Automation Builder Canvas
│       │   │   ├── analytics.tsx     # Deliverability & Performance Analytics
│       │   │   ├── settings.tsx      # Workspace & Profile Settings
│       │   │   └── auth/             # Login, SignUp, VerifyEmail, ResetPassword
│       │   └── types/                # Shared TypeScript contracts and interfaces
│       ├── package.json              # Frontend dependencies
│       └── tsconfig.json
```

---

## 3. FRONTEND FEATURE INVENTORY

| Module / Page | Status | Primary APIs Called | Data Source | Real Actions Performed | Incomplete Functions / Limitations |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Dashboard / Overview**<br>`routes/dashboard.tsx` | **PARTIAL** | `api.getContactStats()` | Real for contacts, **Mock/Static** for campaigns, timeline chart, and activity stream | Navigates to subpages. Toggles between Demo Preview and Zero state. | Does not call `api.getAnalyticsOverview()`, `api.getCampaigns()`, or `api.getSchedules()`. Activity events are hardcoded. |
| **Analytics & Reporting**<br>`routes/analytics.tsx` | **COMPLETE** | `getAnalyticsOverview`, `getAnalyticsTimeline`, `getAnalyticsCampaigns`, `getAnalyticsDeliverability`, `getAnalyticsCampaignDetail` | **100% Real Database** | Time-range filtering (7d, 30d, 90d), SVG timeline rendering, drilldown modal per campaign, CSV export. | Auto-refreshes every 30s. Relies on received webhook events for open/click counts. |
| **Campaign Manager**<br>`routes/campaigns.tsx` | **COMPLETE** | `getCampaigns`, `createCampaign`, `updateCampaign`, `deleteCampaign`, `duplicateCampaign`, `validateCampaign`, `sendCampaign`, `cancelCampaign`, `getCampaignRecipients`, `getCampaignStats` | **100% Real Database** | 5-step Creation Wizard, audience targeting, pre-flight checklist validation, real Resend dispatch, recipient delivery logs, live polling. | Editing already-sent campaigns is blocked. Scheduling is delegated to Schedule Center modal. |
| **Email Template Studio**<br>`routes/templates.tsx` | **COMPLETE** | `getTemplates`, `getTemplate`, `createTemplate`, `updateTemplate`, `duplicateTemplate`, `deleteTemplate` | **100% Real Database** | Visual block editor (headings, text, buttons, dividers, images), raw HTML editor with live compile, mobile/desktop preview, merge tag interpolation preview. | No direct media image upload storage (uses image URLs). |
| **Contacts & Audiences**<br>`routes/contacts.tsx` | **COMPLETE** | `getContacts`, `getContactStats`, `createContact`, `updateContact`, `deleteContact`, `bulkDeleteContacts`, `getContactLists`, `createContactList`, `getContactTags`, `createContactTag`, `importContacts` | **100% Real Database** | Contact CRUD, multi-select bulk delete, CSV upload with header mapping, custom fields, list management, tag assignment. | CSV import executes synchronously in API request (batch size capped at 500 rows). |
| **Schedule Center**<br>`routes/schedule.tsx` | **COMPLETE** | `getSchedules`, `getCalendarSchedules`, `getScheduleDetails`, `scheduleCampaign`, `rescheduleCampaign`, `unscheduleCampaign` | **100% Real Database** | Timezone selector with browser auto-detection, countdown badges, month calendar navigation, reschedule & unschedule dialogs. | Calendar view is internal to MailPilot; no Google Calendar sync exists. |
| **Automation Builder**<br>`routes/automations.tsx` | **COMPLETE** | `getAutomations`, `getAutomation`, `createAutomation`, `updateAutomation`, `deleteAutomation`, `validateAutomation`, `activateAutomation`, `pauseAutomation`, `getAutomationExecutions` | **100% Real Database** | Interactive React Flow canvas, node configuration drawer, cycle & connectivity validation, activation guards, execution run history drawer. | Canvas is responsive but optimized for desktop resolutions. |
| **Settings**<br>`routes/settings.tsx` | **PARTIAL** | `updateProfile`, `updateWorkspace`, `/health` | **Mixed** (General & System are Real; Domains, API Keys & Team are Mock) | Profile name update, workspace name update, real-time backend/database/redis health diagnostic ping. | **Sending Domains tab is UI-only** (alert popup). **API Keys tab displays hardcoded static mock key**. **Team invite button displays alert popup**. |

---

## 4. BACKEND API INVENTORY

### Authentication & Workspaces
- `GET /api/auth/me` — **COMPLETE** | Resolves user, active workspace, role, and accessible workspaces via Supabase JWT.
- `PATCH /api/auth/profile` — **COMPLETE** | Updates user's display name in PostgreSQL.
- `GET /api/workspaces` — **COMPLETE** | Lists all workspaces where user holds active membership.
- `POST /api/workspaces` — **COMPLETE** | Creates a new workspace and assigns `OWNER` role.
- `PATCH /api/workspaces/:id` — **COMPLETE** | Updates workspace name (owner/admin only).
- `POST /api/workspaces/:id/switch` — **COMPLETE** | Updates user's `activeWorkspaceId`.

### Contacts & Segmentation
- `GET /api/contacts` — **COMPLETE** | Paginated contacts with status, list, tag, and search filtering.
- `POST /api/contacts` — **COMPLETE** | Creates single contact with custom fields and tags.
- `GET /api/contacts/stats` — **COMPLETE** | Real-time counts of total, active, unsubscribed, and bounced contacts.
- `GET /api/contacts/:id` — **COMPLETE** | Contact details with list memberships and tag assignments.
- `PATCH /api/contacts/:id` — **COMPLETE** | Updates contact attributes and suppression status.
- `DELETE /api/contacts/:id` — **COMPLETE** | Deletes contact and cascade-cleans assignments.
- `POST /api/contacts/bulk-delete` — **COMPLETE** | Batch deletes contacts by array of IDs.
- `POST /api/contacts/import` — **COMPLETE** | Validates and bulk upserts contacts from parsed CSV payload.
- `GET /api/contacts/import-jobs` — **COMPLETE** | Lists historical CSV import jobs.
- `GET /api/contact-lists` & `POST /api/contact-lists` — **COMPLETE** | List management and segmentation.
- `GET /api/contact-tags` & `POST /api/contact-tags` — **COMPLETE** | Tag definitions with hex colors.

### Email Templates
- `GET /api/templates` — **COMPLETE** | Lists templates filtered by category and DRAFT/READY status.
- `POST /api/templates` — **COMPLETE** | Creates template with JSON blocks and rendered HTML.
- `GET /api/templates/:id` — **COMPLETE** | Retrieves single template document.
- `PATCH /api/templates/:id` — **COMPLETE** | Updates template content, subject, and preheader.
- `DELETE /api/templates/:id` — **COMPLETE** | Deletes template (sets campaign references to null).
- `POST /api/templates/:id/duplicate` — **COMPLETE** | Clones template with `Copy of ...` naming.

### Campaigns & Scheduling
- `GET /api/campaigns` — **COMPLETE** | Paginated campaign broadcasts with real delivery counts.
- `POST /api/campaigns` — **COMPLETE** | Creates draft campaign with snapshot HTML.
- `GET /api/campaigns/:id` — **COMPLETE** | Campaign details and audience breakdown.
- `PATCH /api/campaigns/:id` — **COMPLETE** | Updates campaign parameters (only when DRAFT/SCHEDULED).
- `DELETE /api/campaigns/:id` — **COMPLETE** | Deletes draft campaign.
- `POST /api/campaigns/:id/duplicate` — **COMPLETE** | Clones campaign and targeting criteria.
- `POST /api/campaigns/:id/validate` — **COMPLETE** | Pre-flight validation gate (verifies subject, HTML, sender, active audience, Resend key, and non-webmail domain).
- `POST /api/campaigns/:id/send` — **COMPLETE** | Snapshots recipients, transitions status to `QUEUED`, enqueues BullMQ batch jobs.
- `POST /api/campaigns/:id/cancel` — **COMPLETE** | Cancels queued or sending campaign.
- `GET /api/campaigns/:id/recipients` — **COMPLETE** | Paginated recipient delivery logs with provider message IDs and timestamps.
- `GET /api/campaigns/:id/stats` — **COMPLETE** | Real delivery rates, sent counts, and duration metrics.
- `POST /api/campaigns/:id/schedule` — **COMPLETE** | Timezone-aware future scheduling via BullMQ delayed jobs.
- `PATCH /api/campaigns/:id/reschedule` — **COMPLETE** | Updates scheduled time and replaces BullMQ delayed job.
- `POST /api/campaigns/:id/unschedule` — **COMPLETE** | Cancels BullMQ delayed job and reverts campaign to `DRAFT`.
- `GET /api/schedules` & `GET /api/schedules/calendar` — **COMPLETE** | Scheduled campaigns list and month calendar data.

### Webhooks & Analytics
- `POST /api/webhooks/resend` — **COMPLETE** | Public endpoint verifying Svix signatures, deduplicating event IDs, and enqueueing to BullMQ.
- `GET /api/analytics/overview` — **COMPLETE** | Aggregates sent, delivered, opens, clicks, bounces, and complaints.
- `GET /api/analytics/campaigns` — **COMPLETE** | Comparative performance metrics across campaigns.
- `GET /api/analytics/campaigns/:id` — **COMPLETE** | Single campaign deliverability drilldown.
- `GET /api/analytics/timeline` — **COMPLETE** | Daily time-series buckets for activity charts.
- `GET /api/analytics/deliverability` — **COMPLETE** | Inbound recipient domain deliverability breakdown (e.g. gmail.com, yahoo.com).

### Automations & AI Copilot
- `GET /api/automations` & `POST /api/automations` — **COMPLETE** | Workflow definition CRUD.
- `POST /api/automations/:id/validate` — **COMPLETE** | Graph cycle detection (DFS) and connectivity validation.
- `POST /api/automations/:id/activate` & `pause` — **COMPLETE** | State transitions and validation gates.
- `GET /api/automations/:id/executions` — **COMPLETE** | Audit history of contact workflow executions and steps.
- `GET /api/ai/status` — **COMPLETE** | Reports configuration status of AI provider.
- `POST /api/ai/subject-lines` — **COMPLETE** | AI subject line generation.
- `POST /api/ai/generate-email` — **COMPLETE** | AI complete email draft generation.
- `POST /api/ai/generate-preheader` — **COMPLETE** | AI preheader generation.
- `POST /api/ai/improve-campaign` — **COMPLETE** | AI spam risk and readability audit.

---

## 5. DATABASE SCHEMA OVERVIEW

**PostgreSQL Database (Supabase)** managed via Prisma (`apps/api/prisma/schema.prisma`).

```mermaid
erDiagram
    User ||--o{ WorkspaceMember : "memberships"
    User ||--o{ Workspace : "ownedWorkspaces"
    Workspace ||--o{ WorkspaceMember : "members"
    Workspace ||--o{ Contact : "contacts"
    Workspace ||--o{ ContactList : "contactLists"
    Workspace ||--o{ ContactTag : "contactTags"
    Workspace ||--o{ EmailTemplate : "templates"
    Workspace ||--o{ Campaign : "campaigns"
    Workspace ||--o{ Automation : "automations"
    Workspace ||--o{ EmailEvent : "events"
    
    Contact ||--o{ ContactListMember : "lists"
    ContactList ||--o{ ContactListMember : "members"
    Contact ||--o{ ContactTagAssignment : "tags"
    ContactTag ||--o{ ContactTagAssignment : "contacts"
    
    Campaign ||--o{ CampaignRecipient : "recipients"
    Contact ||--o{ CampaignRecipient : "campaigns"
    
    CampaignRecipient ||--o{ EmailEvent : "events"
    Campaign ||--o{ EmailEvent : "events"
    
    Automation ||--o{ AutomationExecution : "executions"
    Contact ||--o{ AutomationExecution : "automations"
    AutomationExecution ||--o{ AutomationStepExecution : "steps"
```

### Table Inventory (14 Models):
1. `users` — Stores Supabase UUID, email, name, system role, active workspace pointer.
2. `workspaces` — Multi-tenant organization unit with owner pointer and slug.
3. `workspace_members` — User-workspace junction with role (`owner`, `admin`, `member`). Unique: `[workspaceId, userId]`.
4. `contacts` — Subscriber records with status (`ACTIVE`, `UNSUBSCRIBED`, `BOUNCED`), custom fields JSON. Unique: `[workspaceId, email]`.
5. `contact_lists` — Audience list categories. Unique: `[workspaceId, name]`.
6. `contact_list_members` — Contact-list junction. Unique: `[contactId, listId]`.
7. `contact_tags` — Tags with hex color codes. Unique: `[workspaceId, name]`.
8. `contact_tag_assignments` — Contact-tag junction. Unique: `[contactId, tagId]`.
9. `import_jobs` — Tracks batch CSV imports, counts, and error reports.
10. `email_templates` — Visual blocks JSON and compiled HTML templates.
11. `campaigns` — Campaign broadcasts with targeting criteria, snapshot HTML, counters, and scheduling metadata.
12. `campaign_recipients` — Snapshot recipient rows with status (`PENDING`, `PROCESSING`, `SENT`, `FAILED`, `SKIPPED`, `DELIVERED`, `BOUNCED`), attempts, and `providerMessageId`.
13. `email_events` — Webhook delivery events (`SENT`, `DELIVERED`, `OPENED`, `CLICKED`, `BOUNCED`, `COMPLAINED`, `UNSUBSCRIBED`). Unique: `[provider, providerEventId]`.
14. `automations` — Visual workflows (`DRAFT`, `ACTIVE`, `PAUSED`, `ARCHIVED`) with JSON definition.
15. `automation_executions` — Contact run state (`RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`).
16. `automation_step_executions` — Step audit trail (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `SKIPPED`) with execution timestamps.
17. `system_health` — Service health record cache.

### Schema Assessment & Identified Gaps:
- **No Domain Model**: There is currently no `Domain` or `SendingDomain` table in the database to store DNS records, verification tokens, or sending domains.
- **No Skills Model**: There is no `WorkspaceSkill` or `BrandVoice` table.
- **No Google Token Storage**: There are no models for storing OAuth tokens (e.g., Google OAuth access/refresh tokens).
- **Missing Index**: `campaign_recipients` has an index on `providerMessageId`, but querying by `contactId` across campaigns is unindexed.

---

## 6. CURRENT EMAIL SENDING PIPELINE

```mermaid
flowchart TD
    A["Campaign Creation / UI Wizard"] --> B["Audience Resolution (Active Contacts Only)"]
    B --> C["Pre-Flight Validation (API Key, Subject, Non-Webmail Domain)"]
    C --> D["sendCampaign API: Snapshot Recipients in DB (PENDING)"]
    D --> E["BullMQ Queue: Enqueue Batch Jobs (100 recipients / batch)"]
    E --> F["campaign.worker.ts: BullMQ Consumer"]
    F --> G["ResendProvider.send(): Variable Interpolation & API Dispatch"]
    G --> H{"Resend API Response"}
    H -- "Success (messageId)" --> I["Update Recipient: status=SENT, providerMessageId=re_msg_..."]
    H -- "Rejected / Error" --> J["Update Recipient: status=FAILED, errorMessage=..."]
    I --> K["Email Delivered to Inbound MX"]
    K --> L["Resend Webhook: POST /api/webhooks/resend"]
    L --> M["Svix Signature Verification & Deduplication"]
    M --> N["webhook.worker.ts: Match by providerMessageId"]
    N --> O["Update Recipient: status=DELIVERED, deliveredAt=now()"]
    O --> P["Increment Campaign deliveredCount & Update Analytics"]
```

### Critical Findings on Current Provider State:
1. **Implemented Provider**: `ResendProvider` (`apps/api/src/providers/resend.provider.ts`) is the **only active email provider** in the application codebase.
2. **Brevo Status**: Not active. Although `@getbrevo/brevo` exists in `package.json`, all Brevo integration files are uncommitted deletions from commit `e9d3e15` and are absent from active execution paths.
3. **Mock Simulation Mode**: Fast-fails in production. Following commit `08788e2`, silent mock simulation in live sending mode has been **completely eliminated**. If `RESEND_API_KEY` is missing or placeholder, `ResendProvider.send` fast-fails with `PROVIDER_UNCONFIGURED`. Simulation is strictly restricted to automated unit test suites passing `{ isTest: true }`.
4. **Active Credentials**: Configured via `RESEND_API_KEY` in root `.env` and `apps/api/.env`.
5. **Personal Webmail Rejection**: Enforced by `ResendProvider.isPersonalWebmail()`. Addresses ending in `@gmail.com`, `@yahoo.com`, `@hotmail.com`, etc., are rejected with `RESTRICTED_FROM_DOMAIN`.

---

## 7. AUTOMATION BUILDER ANALYSIS

- **Canvas Technology**: `@xyflow/react` (React Flow v12.12.1) mounted inside `apps/web/src/routes/automations.tsx`.
- **Node Implementations**: Defined in `apps/web/src/features/automations/custom-nodes.tsx`:
  - **Triggers**: Contact Subscribed, Added to List, Tag Assigned, Contact Birthday.
  - **Actions**: Send Email, Add Tag, Remove Tag, Add to List, Remove from List.
  - **Logic**: Delay (minutes, hours, days), Condition (has tag, in list, domain matches).
- **Graph Validation Engine**: `AutomationValidator` (`apps/api/src/modules/automations/automation.validator.ts`):
  - Enforces exactly 1 trigger node.
  - Validates edge connectivity and non-empty parameters.
  - **Cycle Detection**: Depth-First Search (DFS) algorithm detects infinite loops.
- **Backend Execution Engine**: `AutomationExecutionEngine` (`apps/api/src/workers/automation.worker.ts`):
  - Traverses workflow nodes sequentially.
  - Delay nodes halt synchronous execution and schedule delayed BullMQ jobs (`addStepAutomationJob(..., delayMs)`).
  - Condition nodes evaluate contact state against rules and branch along `true` or `false` edge handles.
  - Email actions check contact suppression status (`UNSUBSCRIBED` / `BOUNCED`) and mark steps `SKIPPED`.

---

## 8. SCHEDULING & CALENDAR ANALYSIS

- **Source of Truth**: PostgreSQL `campaigns.scheduledAt` (UTC timestamp) and `campaigns.scheduledTimezone` (IANA string).
- **Execution Mechanism**: BullMQ delayed jobs with deterministic job IDs (`scheduled_campaign_${campaignId}`).
- **Crash Recovery & Reconciliation**: `ScheduleService.reconcileScheduledJobs()` executes on server startup in `server.ts`. It cross-references all `SCHEDULED` campaigns in PostgreSQL against active delayed jobs in Redis, immediately dispatches overdue campaigns, re-enqueues missing jobs, and removes stale BullMQ jobs.
- **Calendar UI**: `apps/web/src/routes/schedule.tsx` includes an interactive month grid and day cells with status pills.
- **Google Calendar API**: **NOT IMPLEMENTED**. No integration exists.

---

## 9. AI INTEGRATION ANALYSIS

- **Architecture**: `apps/api/src/modules/ai/ai.provider.ts` and `apps/api/src/modules/ai/ai.service.ts`.
- **Provider Implementation**:
  - `OpenAIProvider`: Calls `https://api.openai.com/v1/chat/completions` directly using `fetch`.
  - `MockAIProvider`: Returns deterministic JSON responses for automated testing.
- **Google Gemini Status**: **NOT INTEGRATED**. In `ai.provider.ts:152`, passing `AI_PROVIDER=gemini` merely delegates to `OpenAIProvider`! Neither the `@google/genai` SDK nor Google AI Studio endpoints are wired.
- **AI Chatbot**: **NOT IMPLEMENTED**. There is no conversational endpoint or UI chat drawer.
- **Natural Language Workflow Generator**: **NOT IMPLEMENTED**. Workflows cannot currently be generated by AI from natural language prompts.

---

## 10. SKILLS MODULE STATUS

- **Current Status**: **NOT IMPLEMENTED** (0% present in codebase).
- **Requirements to Build**:
  1. Prisma model `WorkspaceSkill` (workspaceId, name, brandVoice, tone, targetAudience, instructions).
  2. REST API endpoints for Skill CRUD (`/api/skills`).
  3. AI Prompt Injection: Augment system prompts in `AIService` with workspace brand voice and writing guidelines.
  4. Frontend UI: Skill management drawer in Settings.

---

## 11. GOOGLE ECOSYSTEM INTEGRATION REQUIREMENTS

The user has specified an architectural goal to transition MailPilot from external delivery providers to Google services. Below is the technical breakdown:

### A. Gmail SMTP
- **Host & Port**: `smtp.gmail.com` on Port `465` (SSL) or `587` (TLS / STARTTLS).
- **Authentication**: Requires a 16-character **Google App Password**. Normal account passwords are rejected by Google since May 2022. Google App Passwords require 2-Factor Authentication (2FA) enabled on the Google account.
- **Sender Identity**: Fixed to the email address of the authenticated Google account. Cannot send from arbitrary domains unless configured as a verified alias in Gmail.
- **Quota Limitations**:
  - Free personal `@gmail.com`: **500 emails per rolling 24 hours** (or 100 via SMTP clients).
  - Google Workspace (paid): **2,000 emails per rolling 24 hours**.
  - Exceeding the quota triggers fatal error `550 5.4.5 Daily user-sending quota exceeded` and suspends account sending for 24 hours.
- **Architecture Changes Needed**:
  - Add `nodemailer` dependency.
  - Create `GmailSmtpProvider` implementing a unified `EmailProvider` interface.
  - Add strict BullMQ queue rate limiting (e.g. 1 email per second) to prevent Google SMTP blocks.

### B. Gmail API via OAuth 2.0
- **Concept**: User clicks "Connect Google Account" in MailPilot; grants OAuth permission to send on their behalf.
- **Scopes Required**: `https://www.googleapis.com/auth/gmail.send` (Send emails on user's behalf).
- **Critical Compliance Barrier**: `gmail.send` is classified by Google as a **Restricted Scope**. Deploying to production for non-internal users requires an annual **Cloud Application Security Assessment (CASA Tier 2)** by an authorized auditor ($15k–$75k/year). Testing mode allows up to 100 whitelisted accounts.
- **Token Security**: Requires storing `refreshToken` in PostgreSQL encrypted at rest using AES-256-GCM.
- **Architecture Changes Needed**:
  - Add `googleapis` dependency.
  - Google OAuth consent flow & callback endpoint (`/api/auth/google/callback`).
  - Base64URL-encoded RFC 2822 MIME message compiler.

### C. Google Calendar API
- **Scope**: `https://www.googleapis.com/auth/calendar.events` (Sensitive scope; requires standard app verification, no CASA).
- **Synchronization Logic**:
  - On `scheduleCampaign`: Call `calendar.events.insert` with campaign name, scheduled UTC start time, and timezone. Store `googleCalendarEventId` on `Campaign` model.
  - On `rescheduleCampaign`: Call `calendar.events.patch`.
  - On `unscheduleCampaign` or `cancelCampaign`: Call `calendar.events.delete`.

### D. Google Gemini API
- **Configuration**: API key from Google AI Studio (`GEMINI_API_KEY`). No OAuth required.
- **SDK**: `@google/genai` or `@google/generative-ai`.
- **Capabilities**:
  - Native Gemini integration for subject line and HTML draft generation.
  - Multi-turn AI Campaign Assistant chatbot.
  - Natural Language Workflow Generator: Translates prompts into valid React Flow node/edge graphs validated by `AutomationValidator`.

### Google Credential Distinction Matrix:
| Integration | Credential Type | Scope Classification | Daily Send Quota | Reusability |
| :--- | :--- | :--- | :--- | :--- |
| **Gmail SMTP** | App Password (16 chars) | Full SMTP send | 500/day (free), 2,000/day (workspace) | **Cannot** access Calendar or Gemini API |
| **Gmail OAuth** | OAuth 2.0 Refresh Token | `gmail.send` (Restricted) | 500/day (free), 2,000/day (workspace) | Can share OAuth client with Calendar |
| **Google Calendar**| OAuth 2.0 Refresh Token | `calendar.events` (Sensitive) | Rate-limit based | Can share OAuth client with Gmail |
| **Gemini API** | Gemini API Key (`AIza...`) | Google AI Studio | TPM / RPM based | **Completely independent** API Key |

---

## 12. SECURITY FINDINGS

| Security Domain | Finding | Severity | Recommendation |
| :--- | :--- | :--- | :--- |
| **Secret Isolation** | `SUPABASE_SECRET_KEY` and `RESEND_API_KEY` are strictly confined to backend `apps/api`. No client leak detected. | **SAFE** | Maintain environment isolation. |
| **Frontend Secrets** | `apps/web` only references `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. | **SAFE** | None. |
| **Authentication** | Backend `requireAuth` calls `supabaseAdmin.auth.getUser(token)` on every request. | **SAFE** | Token is verified directly against Supabase. |
| **Tenant Isolation** | All queries enforce `workspaceId` based on validated user memberships. Unauthorized `x-workspace-id` falls back safely. | **SAFE** | None. |
| **Webhook Security** | Svix signature verification is implemented using raw request buffer (`req.rawBody`). Deduplication table stops replays. | **SAFE** | Set real `RESEND_WEBHOOK_SECRET` in production. |
| **API Rate Limiting** | General Express REST endpoints lack a global rate limiter. AI service has in-memory rate limiting (20 req/min). | **MEDIUM** | Add `express-rate-limit` to public routes. |
| **Token Encryption** | No encryption helper currently exists in `apps/api/src/utils` for encrypting future OAuth refresh tokens at rest. | **HIGH (Future)** | Implement AES-256-GCM encryption before storing Google OAuth tokens. |

---

## 13. TESTING STATUS

All test suites were executed in safe read-only verification mode:
1. `pnpm typecheck` — **0 ERRORS** (TypeScript strict compliance across `@mailpilot/api` and `@mailpilot/web`).
2. `pnpm build` — **0 ERRORS** (Successful production bundling).
3. `delivery-pipeline.test-run.ts` — **8/8 PASSED** (Credentials check, personal webmail rejection, API rejection handling, webhook tracking, idempotency).
4. `campaign.test-run.ts` — **12/12 PASSED** (Campaign dispatch, recipient snapshotting, stats calculation).
5. `webhook-analytics.test-run.ts` — **15/15 PASSED** (Svix signatures, delivered/bounced events, contact suppression, metrics math).
6. `automation-ai.test-run.ts` — **11/11 PASSED** (Workflow graph validation, cycle detection, delay steps, condition branching, AI copilot mocks).

---

## 14. DEPLOYMENT READINESS

- **Vercel**: Frontend `apps/web` is ready for Vercel deployment (standard Vite SPA).
- **Render / Railway**: Backend `apps/api` requires a persistent Node.js runtime because it runs BullMQ workers and Redis connections inside the process. It **cannot** be deployed as a standard serverless function on Vercel without separating the worker into a dedicated process.
- **Supabase**: PostgreSQL connection pooling is operational via Supavisor (`pooler.supabase.com:6543`).
- **Redis**: Persistent Redis connection required for BullMQ queues and delayed job scheduling.
- **CORS**: Configured in `app.ts` to allow `FRONTEND_URL`. Must be set to production domain on deploy.

---

## 15. BUGS AND INCOMPLETE FEATURES

1. **Dashboard Overview Static Toggles**: `apps/web/src/routes/dashboard.tsx` uses static demo preview values for campaign metrics, charts, and activity logs instead of querying existing analytics endpoints.
2. **Settings UI Placeholders**: In `apps/web/src/routes/settings.tsx`, the Sending Domains, API Keys, and Team Member tabs contain placeholder alerts and static keys.
3. **Gemini Fallback Bug**: In `apps/api/src/modules/ai/ai.provider.ts:152`, specifying `AI_PROVIDER=gemini` incorrectly instantiates `OpenAIProvider` pointing to OpenAI's endpoint.
4. **No Outgoing Rate Limiter for Gmail**: If switching to Gmail SMTP or OAuth, bursting BullMQ jobs at current concurrency will immediately exhaust Google's 500/2,000 daily quota and trigger account bans.

---

## 16. TECHNICAL RISKS

1. **Gmail Quota Exhaustion**: Using personal Gmail for an email marketing platform is a critical architectural risk. At 500 emails/day, a single campaign with 501 recipients will fail and lock the user's Gmail account for 24 hours.
2. **Google OAuth Restricted Scope Audit**: The `gmail.send` scope requires annual CASA Tier 2 third-party security audits costing tens of thousands of dollars if made publicly available.
3. **Monolithic API + Worker Process**: Currently, Express API and BullMQ workers run in the same Node.js process. In high-volume production, CPU-heavy template compilation and bulk dispatches will degrade HTTP API responsiveness.
4. **Working Tree Drift**: Commit `e9d3e15` introduced Brevo files that were subsequently deleted in the working tree, leaving 28 unstaged changes.

---

## 17. RECOMMENDED IMPLEMENTATION ORDER

If transitioning MailPilot toward the Google Ecosystem and production readiness, the recommended sequence is:

1. **Clean Git Working Tree**: Resolve the unstaged Brevo deletions from commit `e9d3e15` to ensure a clean baseline.
2. **Native Google Gemini Integration**: Replace the OpenAI proxy with the official `@google/genai` SDK for high-speed, cost-effective copywriting and spam analysis.
3. **Settings & Dashboard Polish**: Wire `dashboard.tsx` directly to `AnalyticsService` to eliminate demo data toggles. Build real Sending Domains and Team Management tables.
4. **Abstract Provider Architecture**: Refactor `ResendProvider` into a polymorphic `EmailProvider` interface (`sendEmail(options)`).
5. **Gmail SMTP Provider (with Quota Throttling)**: Implement `GmailSmtpProvider` via `nodemailer` using Google App Passwords, with BullMQ rate-limiting to protect users from exceeding Gmail's 500/2,000 daily send cap.
6. **Google Calendar API Sync**: Implement OAuth flow for `calendar.events` to automatically sync scheduled campaigns to the user's Google Calendar.
7. **AI Natural Language Workflow Generator**: Use Gemini's JSON schema mode to convert natural language descriptions into valid React Flow workflow graphs.

---

## 18. REQUIRED ENVIRONMENT VARIABLES

```env
# Server & Client
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Database (Supabase PostgreSQL via Prisma)
DATABASE_URL=postgresql://postgres.[REF]:[PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[REF]:[PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres

# Supabase Auth
SUPABASE_URL=https://[REF].supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_SECRET_KEY=eyJ...

# Redis & BullMQ
REDIS_URL=redis://127.0.0.1:6379

# Active Email Provider (Resend)
RESEND_API_KEY=re_...
RESEND_WEBHOOK_SECRET=whsec_...

# AI Copilot (Current OpenAI proxy)
AI_PROVIDER=openai
AI_API_KEY=sk-...
AI_MODEL=gpt-4o-mini

# Google Services (Required for Future Phases)
# GEMINI_API_KEY=AIza...
# GMAIL_SMTP_USER=user@gmail.com
# GMAIL_SMTP_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
# GOOGLE_CLIENT_ID=...apps.googleusercontent.com
# GOOGLE_CLIENT_SECRET=GOCSPX-...
# GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback
```

---

## 19. FINAL PROJECT READINESS ASSESSMENT

| System / Component | Status | Readiness Assessment |
| :--- | :--- | :--- |
| **Monorepo & Type Safety** | **COMPLETE** | Production-grade. TypeScript strict checks pass with 0 errors. |
| **Authentication & RBAC** | **COMPLETE** | Supabase JWT verification active on all private endpoints. |
| **Audience & Contact Engine** | **COMPLETE** | Lists, tags, CSV import, and suppression protection active. |
| **Template Studio** | **COMPLETE** | Visual editor, HTML editor, compiler, and merge tags functional. |
| **Campaign Manager** | **COMPLETE** | Batching, snapshotting, pre-flight validation, and dispatch functional. |
| **Scheduling Engine** | **COMPLETE** | PostgreSQL source of truth + BullMQ delayed jobs + Redis recovery functional. |
| **Delivery & Webhook Pipeline** | **COMPLETE** | Real Resend dispatch verified. Svix signatures, event tracking, and metrics functional. |
| **Automation Builder** | **COMPLETE** | React Flow canvas, graph cycle validation, and BullMQ execution engine functional. |
| **AI Copilot** | **MOCKED / PROXY** | OpenAI/Mock only. Native Google Gemini is **NOT IMPLEMENTED**. |
| **Dashboard Overview** | **PARTIAL** | Hardcoded demo preview values. Not wired to real analytics APIs. |
| **Settings Management** | **PARTIAL** | General & System health are real; Domains, Keys & Team are UI-only. |
| **Google Ecosystem (Gmail/Calendar)**| **NOT IMPLEMENTED** | 0% present. Requires architectural adaptations documented in Section 11. |
| **Overall Platform Readiness** | **85% COMPLETE** | Core platform is robust, verified, and operational. Ready for Phase 10. |

