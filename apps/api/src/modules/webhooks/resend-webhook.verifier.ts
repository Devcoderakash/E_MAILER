import { Webhook } from "svix";

export interface VerificationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Verify Resend/Svix webhook signatures
 */
export function verifyResendWebhook(
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
  secret?: string
): VerificationResult {
  // If no secret configured in environment
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return {
        isValid: false,
        error: "RESEND_WEBHOOK_SECRET is not configured on the server.",
      };
    }
    // In dev, warn but allow if no headers passed; but if headers passed, still test
    if (!headers["svix-id"] && !headers["svix-signature"]) {
      return { isValid: true };
    }
  }

  const svixId = (headers["svix-id"] || headers["webhook-id"]) as string | undefined;
  const svixTimestamp = (headers["svix-timestamp"] || headers["webhook-timestamp"]) as string | undefined;
  const svixSignature = (headers["svix-signature"] || headers["webhook-signature"]) as string | undefined;

  if (!svixId || !svixTimestamp || !svixSignature) {
    return {
      isValid: false,
      error: "Missing required webhook verification headers (svix-id, svix-timestamp, svix-signature).",
    };
  }

  const effectiveSecret = secret || "whsec_test_secret_for_development_placeholder_1234567";

  try {
    const wh = new Webhook(effectiveSecret);
    wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
    return { isValid: true };
  } catch (err: any) {
    return {
      isValid: false,
      error: err.message || "Invalid webhook signature.",
    };
  }
}

/**
 * Helper for generating test signatures in automated tests
 */
export function createTestWebhookHeaders(
  payloadString: string,
  secret: string,
  customTimestamp?: Date
): {
  "svix-id": string;
  "svix-timestamp": string;
  "svix-signature": string;
} {
  const wh = new Webhook(secret);
  const msgId = `msg_${Math.random().toString(36).substring(2, 12)}`;
  const timestamp = customTimestamp || new Date();
  const timestampSec = Math.floor(timestamp.getTime() / 1000).toString();

  const signature = wh.sign(msgId, timestamp, payloadString);

  return {
    "svix-id": msgId,
    "svix-timestamp": timestampSec,
    "svix-signature": signature,
  };
}
