import { z } from "zod";
import dotenv from "dotenv";
import path from "path";

// Load .env from root or current directory
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().default("http://localhost:5173"),

  // Database (Supabase PostgreSQL via Prisma)
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().optional(),

  // Supabase Auth & Storage
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1, "SUPABASE_PUBLISHABLE_KEY is required"),
  SUPABASE_SECRET_KEY: z.string().min(1, "SUPABASE_SECRET_KEY is required"),

  // Redis & BullMQ
  REDIS_URL: z.string().min(1, "REDIS_URL is required").default("redis://127.0.0.1:6379"),

  // Future Integrations
  RESEND_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment variables configuration:");
    console.error(JSON.stringify(result.error.format(), null, 2));
    
    // In test or initial setup without .env, we provide fallback defaults to avoid premature crashing during dry runs if needed,
    // but in strict production or runtime, fail early.
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing critical environment variables in production.");
    }
    
    // For local dev convenience if .env is missing or incomplete, output warning
    console.warn("⚠️  Operating with fallback environment variables. Please populate .env file.");
    return {
      NODE_ENV: "development",
      PORT: Number(process.env.PORT) || 4000,
      FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/mailpilot",
      DIRECT_URL: process.env.DIRECT_URL,
      SUPABASE_URL: process.env.SUPABASE_URL || "https://placeholder-project.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY || "placeholder-publishable-key",
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || "placeholder-secret-key",
      REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",
      RESEND_API_KEY: process.env.RESEND_API_KEY,
    };
  }

  return result.data;
}

export const env = validateEnv();
