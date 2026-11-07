# MailPilot 🚀

> **Create. Automate. Deliver. Analyze.**  
> MailPilot is an intelligent Email Marketing & Automation SaaS platform built for high-throughput campaign delivery, event-driven workflows, and actionable behavioral analytics.

---

## 📦 Monorepo Architecture

- **`apps/web`**: Single Page Application built with React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui design tokens, React Router, TanStack Query, and Zustand.
- **`apps/api`**: REST API Gateway and Background Engine built with Node.js, Express, TypeScript, Zod, Helmet, CORS, Prisma ORM (Supabase PostgreSQL), and BullMQ on Redis.
- **`docs`**: Technical architecture and system documentation.

---

## 🛠 Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: `>= 20.0.0`
- **pnpm**: `>= 9.0.0`
- **Redis**: `>= 7.0.0` (Running locally on `127.0.0.1:6379` or accessible via `REDIS_URL`)
- **Supabase Project** (PostgreSQL database and Auth credentials)

---

## ⚙️ Quick Start Setup

### 1. Clone & Install Dependencies

```bash
# Clone the repository
git clone <repo-url>
cd mailpilot

# Install all workspace dependencies
pnpm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` in the root directory:

```bash
cp .env.example .env
```

Populate `.env` with your actual Supabase credentials and Redis URL:

```env
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Database & Supabase
DATABASE_URL=postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:5432/postgres
SUPABASE_URL=https://[REF].supabase.co
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_anon_key
SUPABASE_SECRET_KEY=your_supabase_secret_service_role_key

# Redis
REDIS_URL=redis://127.0.0.1:6379

# Resend (Phase 2+)
RESEND_API_KEY=re_123456789_abcdefg
```

> **Security Note:**  
> The client app (`apps/web`) strictly consumes `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.  
> Never expose `SUPABASE_SECRET_KEY` in frontend code.

### 3. Generate Prisma Client

```bash
pnpm --filter @mailpilot/api prisma:generate
```

---

## 🚀 Running the Development Servers

### Run Both Frontend & Backend Concurrently

```bash
pnpm dev
```

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:4000](http://localhost:4000)
- **API Health Check**: [http://localhost:4000/health](http://localhost:4000/health)

### Run Services Individually

```bash
# Run API only
pnpm dev:api

# Run Web only
pnpm dev:web
```

---

## 🧪 Testing & Verification

### BullMQ Background Job Verification

Test the BullMQ queue and worker end-to-end:

```bash
pnpm test:queue
```

### Type Checking & Production Build

```bash
# Verify TypeScript strict checks across all packages
pnpm typecheck

# Build both applications for production
pnpm build
```

---

## 🔒 Security Standards

1. **Strict Type-Safety:** All input parameters and environment variables are strictly verified with Zod schemas.
2. **Hardened HTTP Gateway:** Protected with Helmet headers and restricted CORS origin policies.
3. **JWT Bearer Token Guard:** Ready for Supabase JWT verification via `requireAuth` middleware.
