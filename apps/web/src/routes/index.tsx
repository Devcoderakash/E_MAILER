import { useQuery } from "@tanstack/react-query";
import { Mail, CheckCircle2, Activity, Server, Database, Cpu, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  services: {
    redis: { status: string; latencyMs?: number };
    database: { status: string };
  };
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE_URL}/health`);
  if (!res.ok) {
    throw new Error(`Health check failed with status: ${res.status}`);
  }
  return res.json();
}

export function AppRoutes() {
  const { data: health, isLoading, isError, error, refetch } = useQuery<HealthResponse>({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 10000,
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900">MailPilot</span>
              <span className="ml-2 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                Phase 1 Foundation
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <a
              href={`${API_BASE_URL}/health`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              API Health Endpoint &rarr;
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center justify-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600 mb-6">
          <Radio className="h-3 w-3 text-emerald-500 animate-pulse" />
          Production-Ready Monorepo Architecture
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 max-w-3xl">
          Create. Automate. Deliver. Analyze.
        </h1>

        <p className="mt-4 text-lg text-slate-600 max-w-2xl leading-relaxed">
          MailPilot is an intelligent email marketing and automation platform.
          Phase 1 provides a clean, scalable TypeScript monorepo with Express, Supabase PostgreSQL, Prisma, Redis, and BullMQ.
        </p>

        {/* System Health Card */}
        <div className="mt-12 w-full max-w-xl bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-left">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-blue-600" />
              <h2 className="text-base font-semibold text-slate-900">Backend Services Connectivity</h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="text-xs"
            >
              Refresh Status
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {/* Express API */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center space-x-3">
                <Server className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">Express API Gateway</span>
              </div>
              <div>
                {isLoading ? (
                  <span className="text-xs text-slate-400">Checking...</span>
                ) : isError ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                    Offline ({String(error)})
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                    Online (Port 4000)
                  </span>
                )}
              </div>
            </div>

            {/* Redis & BullMQ */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center space-x-3">
                <Cpu className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">Redis & BullMQ Engine</span>
              </div>
              <div>
                {isLoading ? (
                  <span className="text-xs text-slate-400">Checking...</span>
                ) : isError ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-600">
                    Awaiting API
                  </span>
                ) : health?.services?.redis?.status === "connected" ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                    Connected ({health.services.redis.latencyMs}ms)
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                    {health?.services?.redis?.status || "disconnected"}
                  </span>
                )}
              </div>
            </div>

            {/* Supabase PostgreSQL */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center space-x-3">
                <Database className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">Supabase PostgreSQL (Prisma)</span>
              </div>
              <div>
                {isLoading ? (
                  <span className="text-xs text-slate-400">Checking...</span>
                ) : isError ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-600">
                    Awaiting API
                  </span>
                ) : health?.services?.database?.status === "connected" ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                    {health?.services?.database?.status || "disconnected"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Foundation Checklist */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 text-left w-full max-w-xl">
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-start space-x-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Type-Safe Architecture</p>
              <p className="text-xs text-slate-500 mt-1">
                Full-stack TypeScript with Zod environment validation.
              </p>
            </div>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-start space-x-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Production Background Workers</p>
              <p className="text-xs text-slate-500 mt-1">
                BullMQ queue with isolated workers ready for async operations.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500">
          MailPilot &copy; {new Date().getFullYear()} &bull; Foundation Phase 1
        </div>
      </footer>
    </div>
  );
}
