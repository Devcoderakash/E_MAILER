# MailPilot — Architecture Overview (Phase 1)

**Tagline:** Create. Automate. Deliver. Analyze.

MailPilot is an enterprise-ready, intelligent Email Marketing & Automation platform.

---

## 1. Monorepo Structure

```text
mailpilot/
├── apps/
│   ├── api/                      # Backend Express & Background Processing
│   │   ├── prisma/
│   │   │   └── schema.prisma     # Prisma ORM schema (Supabase PostgreSQL)
│   │   ├── src/
│   │   │   ├── config/           # Environment variables (Zod), Redis, Prisma, Supabase
│   │   │   ├── middleware/       # Error handling, request logging, JWT auth verification
│   │   │   ├── modules/          # Business modules (to be expanded in Phase 2+)
│   │   │   ├── queues/           # BullMQ queues & queue definitions
│   │   │   ├── workers/          # BullMQ background workers
│   │   │   ├── providers/        # External integrations (e.g., Resend)
│   │   │   ├── utils/            # Shared backend helper functions
│   │   │   ├── app.ts            # Express application factory
│   │   │   └── server.ts         # Server lifecycle and graceful shutdown
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                      # Frontend Single Page Application
│       ├── src/
│       │   ├── components/       # UI component library (shadcn/ui style)
│       │   ├── features/         # Feature-specific state and logic (Zustand)
│       │   ├── hooks/            # Reusable custom React hooks
│       │   ├── lib/              # Supabase browser client, TanStack Query client, utils
│       │   ├── routes/           # Application views and routing
│       │   ├── types/            # TypeScript interfaces and contracts
│       │   ├── App.tsx           # Top-level application component
│       │   ├── main.tsx          # Application entry point
│       │   └── index.css         # Tailwind directives & CSS design tokens
│       ├── index.html
│       ├── package.json
│       ├── tailwind.config.js
│       ├── vite.config.ts
│       └── tsconfig.json
├── docs/                         # System architecture and technical documentation
├── .env.example                  # Environment variable reference template
├── .gitignore
├── package.json                  # Root workspace package configuration
├── pnpm-workspace.yaml           # pnpm monorepo workspace definition
└── README.md                     # Setup, verification, and run guide
```

---

## 2. Security Architecture

1. **Supabase Key Isolation:**
   - Frontend (`apps/web`) has access strictly to `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key).
   - Backend (`apps/api`) possesses `SUPABASE_SECRET_KEY` (service_role key), which allows privileged operations in secure server environments.
   - Secrets are strictly prohibited from client bundles and public repositories.

2. **JWT Authentication Flow:**
   - In frontend, `supabase.auth` manages tokens, auto-refreshing sessions via secure storage.
   - In backend, `requireAuth` middleware verifies incoming `Authorization: Bearer <token>` directly against Supabase Auth.

3. **HTTP Security Standards:**
   - `helmet` sets HTTP response security headers.
   - `cors` explicitly allows requests only from trusted origins (such as `FRONTEND_URL` and local development hosts).

4. **Environment Validation:**
   - Backend environment variables are strictly parsed and validated using Zod at process initialization, failing fast if required variables are invalid.

---

## 3. Background Processing (BullMQ & Redis)

- `ioredis` establishes a persistent connection with configured reconnection backoff.
- BullMQ separates queue dispatch (`apps/api/src/queues/`) from isolated worker execution (`apps/api/src/workers/`).
- Health checks monitor Redis ping latency and report statuses through `/health`.

