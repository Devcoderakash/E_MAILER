import { env } from "../../config/env";
import nodemailer from "nodemailer";
import { GoogleGenAI } from "@google/genai";
import { google } from "googleapis";
import { encryptCredential, decryptCredential, maskSecret } from "../../utils/crypto.util";

interface VerificationReport {
  timestamp: string;
  envCheck: Record<string, { present: boolean; masked?: string; note?: string }>;
  encryptionCheck: { success: boolean; details: string };
  smtpCheck: { success: boolean; details: string; latencyMs?: number };
  geminiCheck: { success: boolean; details: string; latencyMs?: number; responsePreview?: string };
  calendarCheck: { success: boolean; details: string; authUrl?: string; redirectUriMatched: boolean };
}

async function verifyGoogleIntegrations(): Promise<VerificationReport> {
  const report: VerificationReport = {
    timestamp: new Date().toISOString(),
    envCheck: {},
    encryptionCheck: { success: false, details: "" },
    smtpCheck: { success: false, details: "" },
    geminiCheck: { success: false, details: "" },
    calendarCheck: { success: false, details: "", redirectUriMatched: false },
  };

  console.log("=================================================");
  console.log("🔍 MAILPILOT: GOOGLE CREDENTIALS & INTEGRATION AUDIT");
  console.log("=================================================\n");

  // 1. Environment Variable Presence Check (Zero secrets printed)
  console.log("--- 1. Environment Variables Audit ---");
  const checkEnvVar = (name: string, value: string | undefined, isSecret = false) => {
    const present = Boolean(value && value.trim().length > 0 && !value.includes("your_"));
    const masked = isSecret && present ? maskSecret(value!) : present ? (isSecret ? "••••••••" : value) : "MISSING";
    report.envCheck[name] = { present, masked };
    console.log(`  ${present ? "✅" : "❌"} ${name}: ${present ? (isSecret ? "CONFIGURED (securely masked)" : value) : "NOT CONFIGURED"}`);
  };

  checkEnvVar("GMAIL_SMTP_USER", env.GMAIL_SMTP_USER, false);
  checkEnvVar("GMAIL_SMTP_APP_PASSWORD", env.GMAIL_SMTP_APP_PASSWORD, true);
  checkEnvVar("GMAIL_SMTP_HOST", env.GMAIL_SMTP_HOST, false);
  checkEnvVar("GMAIL_SMTP_PORT", String(env.GMAIL_SMTP_PORT), false);
  checkEnvVar("GMAIL_SMTP_SECURE", String(env.GMAIL_SMTP_SECURE), false);
  checkEnvVar("GEMINI_API_KEY", env.GEMINI_API_KEY, true);
  checkEnvVar("GEMINI_MODEL", env.GEMINI_MODEL, false);
  checkEnvVar("GOOGLE_CLIENT_ID", env.GOOGLE_CLIENT_ID, true);
  checkEnvVar("GOOGLE_CLIENT_SECRET", env.GOOGLE_CLIENT_SECRET, true);
  checkEnvVar("GOOGLE_REDIRECT_URI", env.GOOGLE_REDIRECT_URI, false);
  checkEnvVar("TOKEN_ENCRYPTION_KEY", env.TOKEN_ENCRYPTION_KEY || env.ENCRYPTION_KEY, true);

  // 2. Token Encryption Key Validation & Round-Trip Test
  console.log("\n--- 2. Cryptographic Token Encryption Key Test ---");
  try {
    const activeKey = env.TOKEN_ENCRYPTION_KEY || env.ENCRYPTION_KEY;
    if (!activeKey || activeKey.length < 32) {
      report.encryptionCheck = {
        success: false,
        details: `Key length ${activeKey?.length || 0} is less than recommended 32 bytes.`,
      };
      console.log(`  ❌ Encryption key validation failed: key length too short.`);
    } else {
      const sampleSecret = "google-oauth-refresh-token-sample-1234567890";
      const encrypted = encryptCredential(sampleSecret);
      const decrypted = decryptCredential(encrypted);
      if (decrypted === sampleSecret) {
        report.encryptionCheck = {
          success: true,
          details: `AES-256-GCM authenticated encryption verified successfully with 32-byte key.`,
        };
        console.log("  ✅ AES-256-GCM authenticated encryption/decryption round-trip verified.");
      } else {
        report.encryptionCheck = { success: false, details: "Decrypted text mismatch." };
        console.log("  ❌ Decrypted text did not match original plaintext.");
      }
    }
  } catch (err: any) {
    report.encryptionCheck = { success: false, details: err.message };
    console.error("  ❌ Encryption test failed:", err.message);
  }

  // 3. Gmail SMTP Transporter Verification (NO emails dispatched)
  console.log("\n--- 3. Gmail SMTP Connection Handshake ---");
  if (!env.GMAIL_SMTP_USER || !env.GMAIL_SMTP_APP_PASSWORD) {
    report.smtpCheck = {
      success: false,
      details: "GMAIL_SMTP_USER or GMAIL_SMTP_APP_PASSWORD is not set in environment.",
    };
    console.log("  ⚠️  Gmail SMTP unconfigured. Skipping connection verification.");
  } else {
    const startTime = Date.now();
    try {
      // Normalize App Password (strip internal spaces)
      const cleanPassword = env.GMAIL_SMTP_APP_PASSWORD.replace(/\s+/g, "");
      const transporter = nodemailer.createTransport({
        host: env.GMAIL_SMTP_HOST || "smtp.gmail.com",
        port: env.GMAIL_SMTP_PORT || 587,
        secure: env.GMAIL_SMTP_SECURE || false,
        auth: {
          user: env.GMAIL_SMTP_USER,
          pass: cleanPassword,
        },
        connectionTimeout: 10000,
      });

      console.log(`  Connecting to ${env.GMAIL_SMTP_HOST}:${env.GMAIL_SMTP_PORT} with user ${env.GMAIL_SMTP_USER}...`);
      await transporter.verify();
      const latencyMs = Date.now() - startTime;
      report.smtpCheck = {
        success: true,
        details: `SMTP handshake and authentication succeeded in ${latencyMs}ms.`,
        latencyMs,
      };
      console.log(`  ✅ Gmail SMTP connection and authentication verified! (${latencyMs}ms)`);
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      report.smtpCheck = {
        success: false,
        details: `SMTP verification failed: ${err.message}`,
        latencyMs,
      };
      console.error(`  ❌ Gmail SMTP verification failed (${latencyMs}ms):`, err.message);
    }
  }

  // 4. Gemini API Connectivity & Test Request
  console.log("\n--- 4. Google Gemini API Verification ---");
  if (!env.GEMINI_API_KEY) {
    report.geminiCheck = {
      success: false,
      details: "GEMINI_API_KEY is not set in environment.",
    };
    console.log("  ⚠️  GEMINI_API_KEY unconfigured. Skipping API verification.");
  } else {
    const startTime = Date.now();
    try {
      const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
      const model = env.GEMINI_MODEL || "gemini-2.0-flash";
      console.log(`  Dispatching test prompt to model '${model}'...`);
      
      const response = await ai.models.generateContent({
        model,
        contents: "Respond with the exact phrase: MailPilot Gemini Integration Verified.",
      });

      const latencyMs = Date.now() - startTime;
      const text = response.text?.trim() || "";
      report.geminiCheck = {
        success: true,
        details: `Gemini API connection succeeded in ${latencyMs}ms.`,
        latencyMs,
        responsePreview: text,
      };
      console.log(`  ✅ Google Gemini API response received in ${latencyMs}ms!`);
      console.log(`     Model Response: "${text}"`);
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      report.geminiCheck = {
        success: false,
        details: `Gemini API call failed: ${err.message}`,
        latencyMs,
      };
      console.error(`  ❌ Gemini API call failed (${latencyMs}ms):`, err.message);
    }
  }

  // 5. Google Calendar OAuth Verification
  console.log("\n--- 5. Google Calendar OAuth Configuration ---");
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    report.calendarCheck = {
      success: false,
      details: "GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing.",
      redirectUriMatched: false,
    };
    console.log("  ⚠️  Google OAuth credentials unconfigured. Skipping OAuth URL generation.");
  } else {
    try {
      const redirectUri =
        env.GOOGLE_REDIRECT_URI ||
        `http://localhost:${env.PORT}/api/auth/google/calendar/callback`;

      const oauth2Client = new google.auth.OAuth2(
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET,
        redirectUri
      );

      const state = Buffer.from(
        JSON.stringify({
          workspaceId: "test-workspace-id",
          userId: "test-user-id",
          timestamp: Date.now(),
        })
      ).toString("base64");

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: ["https://www.googleapis.com/auth/calendar.events"],
        state,
      });

      const urlObj = new URL(authUrl);
      const urlRedirectUri = urlObj.searchParams.get("redirect_uri");
      const redirectUriMatched = urlRedirectUri === redirectUri;

      report.calendarCheck = {
        success: true,
        details: `OAuth2 client successfully initialized. Valid authorization URL generated.`,
        authUrl,
        redirectUriMatched,
      };

      console.log(`  ✅ OAuth2 Client initialized with Client ID.`);
      console.log(`  ✅ Configured Redirect URI: ${redirectUri}`);
      console.log(`  ✅ Generated Consent URL includes 'calendar.events' scope and state token.`);
      console.log(`     Redirect URI match in authUrl: ${redirectUriMatched ? "YES" : "NO"}`);
    } catch (err: any) {
      report.calendarCheck = {
        success: false,
        details: `OAuth configuration failed: ${err.message}`,
        redirectUriMatched: false,
      };
      console.error("  ❌ Google OAuth verification failed:", err.message);
    }
  }

  console.log("\n=================================================");
  console.log("🏁 VERIFICATION AUDIT COMPLETE");
  console.log("=================================================\n");

  return report;
}

verifyGoogleIntegrations()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Audit runner encountered an error:", err);
    process.exit(1);
  });

