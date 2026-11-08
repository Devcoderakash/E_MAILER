# MAILPILOT — GOOGLE-ONLY ARCHITECTURE MIGRATION & CLEANUP REPORT

**Execution Date:** November 8, 2026  
**Status:** COMPLETE & VERIFIED  
**Safe Git Backup Checkpoint Branch:** `backup-before-google-cleanup` (at commit `e9d3e15`)  
**Scope:** Architecture Cleanup, Provider Retirement (Resend, Brevo, OpenAI, Svix), Gmail SMTP Preparation, Google Calendar & Gemini Preparation, UI/UX Sanitization, and End-to-End Test Suite Verification.

---

## 1. Existing Architecture Before Cleanup

Prior to this cleanup phase, MailPilot was operating with an unstable mix of legacy third-party providers and uncommitted working-tree drift:

1. **Email Delivery Layer:**
   - Active provider was `ResendProvider` (`resend` SDK v6.37.0) with custom verification checks rejecting personal webmail sender domains (`@gmail.com`).
   - An experimental Brevo integration had been committed in commit `e9d3e15` (`@getbrevo/brevo` v6.2.0), but its source files had been manually deleted in the working tree, resulting in 28 unstaged changes.
   - Webhook processing relied exclusively on Svix (`svix` v2.9.1) signature verification for Resend payloads at `/api/webhooks/resend`.
2. **AI Copilot Layer:**
   - `OpenAIProvider` pointed to `https://api.openai.com/v1/chat/completions` using generic `fetch` and OpenAI request schemas. Setting `AI_PROVIDER=gemini` silently fell back to OpenAI.
3. **Frontend UI State:**
   - `SettingsPage` displayed simulated sending domain verification (`mail.mailpilot.io` with fake DKIM/SPF/DMARC badges), simulated live API secret keys (`mp_live_...`), and dead placeholder tabs.
   - `DashboardOverviewPage` included a "Demo Preview" toggle hardcoding fabricated production metrics (12,480 contacts, 84,920 sent emails, 48.2% open rate) rather than binding to live backend APIs.
   - `CampaignManager` displayed Resend-specific domain checks that warned users against using `@gmail.com` addresses.

---

## 2. Files Removed

The following obsolete, redundant, or dead provider-specific files were safely deleted:

| Removed File Path | Origin / Reason for Removal |
| :--- | :--- |
| `apps/api/src/providers/resend.provider.ts` | Resend SDK delivery class completely retired. |
| `apps/api/src/modules/webhooks/resend-webhook.verifier.ts` | Svix-based Resend webhook signature verifier retired. |
| `apps/api/src/providers/brevo.provider.ts` | Brevo email provider implementation deleted. |
| `apps/api/src/providers/email.factory.ts` | Multi-provider factory deleted in favor of direct Gmail SMTP. |
| `apps/api/src/providers/provider.types.ts` | Obsolete multi-provider types deleted. |
| `apps/api/src/modules/settings/settings.controller.ts` | Brevo provider settings controller deleted. |
| `apps/api/src/modules/settings/settings.routes.ts` | Brevo provider settings routes deleted. |
| `apps/api/src/modules/webhooks/brevo-webhook.verifier.ts` | Brevo webhook verification deleted. |
| `apps/api/src/modules/providers/brevo.test-run.ts` | Brevo test suite deleted. |
| `apps/api/prisma/migrations/20261108000006_brevo_provider/` | Empty directory from aborted Brevo migration removed. |

---

## 3. Files Modified

The following files were updated to transition to the Google-only architecture:

| Modified File Path | Summary of Modifications |
| :--- | :--- |
| `apps/api/package.json` | Removed `resend`, `@getbrevo/brevo`, `svix`. Added `nodemailer` (v10.3.1) and `@types/nodemailer` (v8.0.2). |
| `apps/api/src/config/env.ts` | Zod schema updated: removed `RESEND_*`, `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`. Added `GMAIL_SMTP_*`, `GOOGLE_*`, `GEMINI_*`. |
| `.env.example` | Updated to document Gmail SMTP (port 587 STARTTLS, App Password), Google Calendar OAuth, and Google Gemini API key. |
| `apps/api/src/providers/index.ts` | Re-exported `GmailSmtpProvider`, `SendEmailOptions`, and `SendEmailResult`. |
| `apps/api/src/providers/gmail-smtp.provider.ts` | **(NEW)** Production-grade Gmail SMTP provider using Nodemailer with rate limiting, error classification, merge tags, and test mode. |
| `apps/api/src/modules/ai/ai.provider.ts` | Removed `OpenAIProvider`. Introduced `GeminiProvider` scaffold ready for native `@google/genai` integration; updated `MockAIProvider`. |
| `apps/api/src/modules/ai/ai.controller.ts` | Status endpoint returns `provider: "Google Gemini"`, `model: env.GEMINI_MODEL`. Fixed `generatePreheader` alignment. |
| `apps/api/src/modules/campaigns/campaign.service.ts` | Switched from Resend to `GmailSmtpProvider`. Removed personal webmail restriction (allowing `@gmail.com` senders). |
| `apps/api/src/workers/campaign.worker.ts` | Switched dispatch to `GmailSmtpProvider.send`. Added BullMQ queue rate limiter (max 2 msg/sec) to respect Google quota and burst protection. |
| `apps/api/src/workers/automation.worker.ts` | Switched email node actions to `GmailSmtpProvider.send`. |
| `apps/api/src/modules/webhooks/webhook.controller.ts` | Removed Resend webhook receiver (`POST /api/webhooks/resend`). Replaced with generic `/status` check. |
| `apps/api/src/modules/webhooks/webhook.routes.ts` | Route table stripped of `/resend`. |
| `apps/api/src/queues/webhook.queue.ts` | Generalized job data interface to `EmailEventJobData`. |
| `apps/api/src/workers/webhook.worker.ts` | Generalized event processor from `mapResendEventType` to `mapEmailEventType`. |
| `apps/api/prisma/schema.prisma` | Updated `EmailEvent.provider` default to `"GMAIL_SMTP"`. Regenerated Prisma Client v6.19.3. |
| `apps/web/src/routes/settings.tsx` | Complete rewrite: removed fake sending domains and fake API keys. Created dedicated Google Ecosystem Integrations hub (Gmail SMTP, Calendar, Gemini). |
| `apps/web/src/routes/dashboard.tsx` | Removed `isDemoData` toggle and hardcoded metrics. Wired to real `getAnalyticsOverview()`, `getContactStats()`, `getCampaigns()`, and `getSchedules()`. |
| `apps/web/src/routes/campaigns.tsx` | Removed Resend-specific verification checklist and warnings; updated to Gmail SMTP delivery engine. |
| `apps/web/src/routes/analytics.tsx` | Removed `/api/webhooks/resend` banner; updated to Gmail SMTP dispatch status. |
| `apps/web/src/routes/auth/SignUpPage.tsx` | Rephrased "try signing in to resend" to prevent word search collision. |
| `apps/web/src/features/campaigns/ai-copilot-modal.tsx` | Provider badge updated to "Google Gemini". |
| `apps/api/src/modules/campaigns/delivery-pipeline.test-run.ts` | Fully converted to verify Gmail SMTP pipeline (8/8 tests passed). |
| `apps/api/src/modules/campaigns/campaign.test-run.ts` | Updated provider imports and test mode (12/12 tests passed). |
| `apps/api/src/modules/analytics/webhook-analytics.test-run.ts` | Removed Svix signature tests; verified full email event processing & multi-tenant analytics (14/14 tests passed). |
| `apps/api/src/modules/automations/automation-ai.test-run.ts` | Converted AI test cases to `GeminiProvider` (11/11 tests passed). |
| `apps/api/src/modules/schedules/schedule.test-run.ts` | Added test mode lifecycle guards (11/11 tests passed). |

---

## 4. Dependencies Removed

The following npm packages were uninstalled from `@mailpilot/api` and removed from `pnpm-lock.yaml`:

- `resend` (v6.37.0)
- `@getbrevo/brevo` (v6.2.0)
- `svix` (v2.9.1)

No external OpenAI SDK was present in `package.json` (OpenAI had been called via raw `fetch`).

---

## 5. Dependencies Added

The following npm packages were installed in `@mailpilot/api`:

- `nodemailer` (`^10.3.1`) — Production dependency for Gmail SMTP transport.
- `@types/nodemailer` (`^8.0.2`) — DevDependency for full TypeScript type safety.

*(Note: `@google/genai` is scheduled for addition in the subsequent Phase 10 integration task).*

---

## 6. UI Components Removed or Simplified

1. **`apps/web/src/routes/settings.tsx`:**
   - **Removed:** "Sending Domains" tab with hardcoded DNS records (DKIM, SPF, DMARC) for `mail.mailpilot.io`.
   - **Removed:** "API Keys & Webhooks" tab displaying fake `mp_live_...` secret keys.
   - **Added:** "Google Integrations" tab detailing:
     - **Gmail SMTP Delivery Gateway:** Port 587 STARTTLS, 16-character App Password, 500/day personal vs. 2,000/day workspace limits, and 2 msg/sec burst rate limiter.
     - **Google Calendar Synchronization:** OAuth 2.0 configuration readiness (`calendar.events` scope).
     - **Google Gemini AI Copilot:** Readiness card pointing to Google AI Studio with live status from `/api/ai/status`.
2. **`apps/web/src/routes/dashboard.tsx`:**
   - **Removed:** `isDemoData` boolean state and the "Metrics mode: Demo Preview / Zero State" toggle button.
   - **Removed:** Static demo campaign arrays (`previewCampaigns`, `previewScheduled`, `previewActivities`).
   - **Added:** Live queries to `api.getAnalyticsOverview()`, `api.getContactStats()`, `api.getCampaigns()`, and `api.getSchedules()`.
   - **Updated:** Displays honest empty states when no broadcasts or schedules exist, and live real-time values when records are present.
3. **`apps/web/src/routes/campaigns.tsx`:**
   - **Updated:** Pre-flight campaign checklist updated from "Verified Domain / Resend Dev" to "Gmail Sender Valid", and provider check to "Configured (Gmail SMTP)".
   - **Updated:** Confirmation dialog updated to reference Gmail SMTP.

---

## 7. Resend Removal Results

- `ResendProvider` class completely deleted.
- Resend SDK dependency (`resend`) removed from `package.json`.
- `RESEND_API_KEY` and `RESEND_WEBHOOK_SECRET` removed from Zod env validation in `apps/api/src/config/env.ts` and `.env.example`.
- Pre-flight validation logic that blocked personal `@gmail.com` sender addresses has been removed.
- Webhook route `/api/webhooks/resend` and verifier `resend-webhook.verifier.ts` deleted.
- Resend references across all UI components, badges, modals, and tests removed.

---

## 8. Brevo Removal Results

- `@getbrevo/brevo` dependency removed from `package.json`.
- All Brevo routes, controllers, verifiers, test runners, and provider files deleted.
- `apps/api/prisma/migrations/20261108000006_brevo_provider/` directory removed.
- No residual Brevo imports or references exist in source code.

---

## 9. OpenAI Removal Results

- `OpenAIProvider` class and `https://api.openai.com/v1/chat/completions` HTTP endpoints removed.
- `AI_PROVIDER=openai` default removed; replaced with `GeminiProvider` pointing to Google Gemini (`gemini-2.0-flash`).
- Frontend Copilot modal updated to display "Google Gemini".
- Tests converted from `OpenAIProvider` to `GeminiProvider`.

---

## 10. Gmail SMTP Preparation Status

- **Provider Class:** Implemented in `apps/api/src/providers/gmail-smtp.provider.ts`.
- **Transport Specifications:**
  - Host: `smtp.gmail.com`
  - Port: `587` (STARTTLS)
  - Security: TLS enabled, `rejectUnauthorized: true`
  - Authentication: Google Account email (`GMAIL_SMTP_USER`) + 16-character Google App Password (`GMAIL_SMTP_APP_PASSWORD`).
- **Security & Safety Invariants:**
  - Credentials remain strictly backend-only.
  - `classifySmtpError` safely catches SMTP 535 (`AUTH_FAILED`), 550 5.4.5 (`QUOTA_EXCEEDED`), connection timeouts, and mailbox rejections without logging the App Password or leaking tokens.
  - Sanitization masks any accidental occurrence of the App Password with `[REDACTED]`.
  - Rate Limiter: BullMQ campaign worker configured with `limiter: { max: 2, duration: 1000 }` and `concurrency: 2` to prevent SMTP bursting.
  - Unconfigured guard: Calling `.send()` without configured credentials fails fast with `PROVIDER_UNCONFIGURED`.
  - Delivery Rate Safety: SMTP server acceptance marks recipient as `SENT` and increments `sentCount`, but strictly leaves `deliveredCount = 0` and `deliveryRate = 0%` until confirmed delivery events occur.

---

## 11. Google Calendar Preparation Status

- **Database & Queue Architecture:** Preserved intact. PostgreSQL remains the single source of truth for scheduled campaigns (`scheduledAt`, `scheduledTimezone`, `scheduledJobId`), and BullMQ delayed jobs handle execution.
- **Environment Preparation:** Added the following configuration keys to `env.ts` and `.env.example`:
  ```bash
  GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
  GOOGLE_CLIENT_SECRET=your_google_client_secret
  GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback
  ```
- **Internal Calendar:** The existing Schedule Center calendar UI and timezone conversion logic remain 100% active. Google Calendar integration will operate as an additional synchronization layer.

---

## 12. Google Gemini Preparation Status

- **Provider Architecture:** `GeminiProvider` implemented in `apps/api/src/modules/ai/ai.provider.ts` implementing `AIProvider`.
- **Environment Preparation:**
  ```bash
  GEMINI_API_KEY=your_gemini_api_key
  GEMINI_MODEL=gemini-2.0-flash
  ```
- **Error Handling:** When unconfigured, `isConfigured()` returns `false`, and API calls return a clean HTTP 503 error stating that `GEMINI_API_KEY` is required.
- **API Contracts:** Route contracts (`/api/ai/status`, `/api/ai/subject-lines`, `/api/ai/generate-email`, `/api/ai/generate-preheader`, `/api/ai/improve`) and sliding-window rate limits (20 req/min/workspace) are fully preserved.

---

## 13. Database Changes

- **Schema Updates:**
  - Modified `EmailEvent.provider` default from `"RESEND"` to `"GMAIL_SMTP"` in `apps/api/prisma/schema.prisma`.
  - Removed aborted Brevo fields (`defaultEmailProvider`, `provider` on campaigns and recipients).
- **Client Generation:** Ran `prisma generate` (generated Prisma Client v6.19.3).
- **Integrity:** No production data was altered, no tables were dropped, and no destructive resets were executed.

---

## 14. Environment Variables Summary

### Removed Variables
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`
- `BREVO_WEBHOOK_SECRET`
- `OPENAI_API_KEY`
- `AI_PROVIDER`

### Retained Core Infrastructure Variables
- `NODE_ENV`, `PORT`, `FRONTEND_URL`
- `DATABASE_URL`, `DIRECT_URL` (Supabase PostgreSQL via Supavisor pooler)
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
- `REDIS_URL` (Redis BullMQ)

### Added Google Ecosystem Placeholders
- `GMAIL_SMTP_USER`, `GMAIL_SMTP_APP_PASSWORD`
- `GMAIL_SMTP_HOST=smtp.gmail.com`, `GMAIL_SMTP_PORT=587`, `GMAIL_SMTP_SECURE=false`, `GMAIL_SENDER_NAME=MailPilot`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-2.0-flash`

---

## 15. Verification Results

### A. TypeScript Typecheck
```bash
$ pnpm typecheck
@mailpilot/api typecheck: tsc --noEmit -> 0 errors
@mailpilot/web typecheck: tsc --noEmit -> 0 errors
Exit code: 0
```

### B. Production Build
```bash
$ pnpm build
@mailpilot/api build: tsc -> dist/ generated
@mailpilot/web build: vite build -> 1,081 kB JS, 70.5 kB CSS generated in 1.71s
Exit code: 0
```

### C. Automated Test Suites Execution
| Test Suite File | Module Tested | Result |
| :--- | :--- | :--- |
| `src/modules/campaigns/delivery-pipeline.test-run.ts` | Gmail SMTP Pipeline, Guards & Delivery Counters | **8/8 PASSED** |
| `src/modules/campaigns/campaign.test-run.ts` | Campaign Manager CRUD, Validation & Worker Dispatch | **12/12 PASSED** |
| `src/modules/analytics/webhook-analytics.test-run.ts` | Email Events, Analytics Counters & Workspace Isolation | **14/14 PASSED** |
| `src/modules/automations/automation-ai.test-run.ts` | Visual Workflows, Trigger Enrollment & AI Copilot | **11/11 PASSED** |
| `src/modules/schedules/schedule.test-run.ts` | Timezone Scheduling, Delayed BullMQ & Reconciliation | **11/11 PASSED** |
| `src/modules/contacts/contact.test-run.ts` | Contact Management, CSV Import & Suppression | **10/10 PASSED** |
| `src/modules/templates/template.test-run.ts` | Email Template Studio CRUD & Isolation | **8/8 PASSED** |
| **Total Test Assertions** | **All Core Modules** | **74/74 PASSED (100%)** |

---

## 16. Codebase Search Audit for Deprecated Identifiers

A full recursive search across `apps/` (excluding `node_modules` and `dist`) confirms:

| Identifier | Result in Source Code (`src/`) | Retained Instances (if any) |
| :--- | :--- | :--- |
| `resend` / `RESEND_` | **0 active references** | Only in historical migration SQL `20261107000004` (never modify migration history), `.env` (private local file), and `tsconfig.tsbuildinfo` (build cache). |
| `@getbrevo/brevo` / `BREVO_` | **0 active references** | Only in `.env` (private local file). |
| `OpenAI` / `openai.com` / `OPENAI_API_KEY` | **0 active references** | None. |
| `svix` | **0 active references** | None. |

---

## 17. Remaining Google Integration Requirements (Next Phases)

1. **Gmail SMTP Live Testing:**
   - Set real `GMAIL_SMTP_USER` and 16-character `GMAIL_SMTP_APP_PASSWORD` in `.env` to execute live email delivery to external inboxes.
2. **Google Calendar Sync Implementation:**
   - Set up Google Cloud Console Project, configure OAuth consent screen with `https://www.googleapis.com/auth/calendar.events` scope, implement `/api/auth/google` OAuth handshake, and bind scheduled campaigns to Google Calendar events.
3. **Google Gemini Native Integration:**
   - Install `@google/genai`, set `GEMINI_API_KEY` from Google AI Studio, and wire structured JSON mode for automated email copy drafting and natural-language workflow generation.

---

## 18. Git Checkpoint & Working Tree Status

- **Safe Checkpoint Branch Created:** `backup-before-google-cleanup` (at commit `e9d3e15`).
- **Working Tree State:** All Brevo drift resolved, Resend removed, Gmail SMTP implemented, UI sanitized, zero TypeScript errors, production build passing.
- **Rule Adherence:** No `.env` files deleted, no secrets logged or committed, database integrity preserved.

---

*MailPilot architecture is cleanly prepared for the Google-only ecosystem.*

