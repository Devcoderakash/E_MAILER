import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export interface DatabaseHealthResult {
  status: "connected" | "disconnected" | "error";
  latencyMs?: number;
  error?: string;
}

export async function checkDatabaseHealth(): Promise<DatabaseHealthResult> {
  const start = Date.now();
  try {
    // Perform raw query to verify actual PostgreSQL connectivity
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: "connected",
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      status: "disconnected",
      error: err?.message || "Database connection test failed",
    };
  }
}
