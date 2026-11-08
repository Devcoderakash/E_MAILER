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

  // Email Delivery Provider (Gmail SMTP)
  GMAIL_SMTP_USER: z.string().optional(),
  GMAIL_SMTP_APP_PASSWORD: z.string().optional(),
  GMAIL_SMTP_HOST: z.string().default("smtp.gmail.com"),
  GMAIL_SMTP_PORT: z.coerce.number().default(587),
  GMAIL_SMTP_SECURE: z.preprocess((val) => val === "true" || val === true || val === "1", z.boolean()).default(false),
  GMAIL_SENDER_NAME: z.string().default("MailPilot"),

  // Encryption Key for sensitive OAuth tokens & App Passwords (AES-256-GCM)
  ENCRYPTION_KEY: z.string().default("mailpilot-secure-encryption-key-32-bytes-minimum!"),
  TOKEN_ENCRYPTION_KEY: z.string().optional(),

  // Google Calendar Integration (OAuth 2.0 Preparation)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),

  // Google Gemini AI Integration (@google/genai Preparation)
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.5-flash-lite"),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment variables configuration:");
    console.error(JSON.stringify(result.error.format(), null, 2));

    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing critical environment variables in production.");
    }

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
      GMAIL_SMTP_USER: process.env.GMAIL_SMTP_USER,
      GMAIL_SMTP_APP_PASSWORD: process.env.GMAIL_SMTP_APP_PASSWORD,
      GMAIL_SMTP_HOST: process.env.GMAIL_SMTP_HOST || "smtp.gmail.com",
      GMAIL_SMTP_PORT: Number(process.env.GMAIL_SMTP_PORT) || 587,
      GMAIL_SMTP_SECURE: process.env.GMAIL_SMTP_SECURE === "true",
      GMAIL_SENDER_NAME: process.env.GMAIL_SENDER_NAME || "MailPilot",
      ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || "mailpilot-secure-encryption-key-32-bytes-minimum!",
      TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
    };
  }

  return result.data;
}

export const env = validateEnv();
