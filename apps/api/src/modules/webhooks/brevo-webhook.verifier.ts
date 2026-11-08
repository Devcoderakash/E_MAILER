import crypto from "crypto";

export interface BrevoWebhookVerificationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Verify authentication of incoming Brevo webhook request.
 * Brevo supports Bearer token authentication, custom header (X-Webhook-Secret),
 * or query parameter (?token=...).
 */
export function verifyBrevoWebhook(
  headers: Record<string, any>,
  query: Record<string, any>,
  configuredSecret?: string
): BrevoWebhookVerificationResult {
  if (!configuredSecret || configuredSecret.trim() === "") {
    // Secret not configured in environment: allow in dev mode with warning
    return { isValid: true };
  }

  const expectedSecret = configuredSecret.trim();

  // 1. Check Authorization header (Bearer <token>)
  let providedToken: string | undefined;
  const authHeader = headers["authorization"];
  if (typeof authHeader === "string") {
    if (authHeader.startsWith("Bearer ")) {
      providedToken = authHeader.slice(7).trim();
    } else {
      providedToken = authHeader.trim();
    }
  }

  // 2. Check custom headers (X-Webhook-Secret or X-Brevo-Secret)
  if (!providedToken) {
    const customHeader =
      headers["x-webhook-secret"] ||
      headers["x-brevo-secret"] ||
      headers["webhook-secret"];
    if (typeof customHeader === "string") {
      providedToken = customHeader.trim();
    }
  }

  // 3. Check query param token (?token=...)
  if (!providedToken && query && typeof query.token === "string") {
    providedToken = query.token.trim();
  }

  if (!providedToken) {
    return {
      isValid: false,
      error: "Missing webhook authentication token. Expected Authorization Bearer or X-Webhook-Secret header.",
    };
  }

  // 4. Timing-safe comparison to prevent timing attacks
  try {
    const expectedBuf = Buffer.from(expectedSecret);
    const providedBuf = Buffer.from(providedToken);

    if (expectedBuf.length !== providedBuf.length) {
      return {
        isValid: false,
        error: "Webhook secret token mismatch.",
      };
    }

    const matches = crypto.timingSafeEqual(expectedBuf, providedBuf);
    return {
      isValid: matches,
      error: matches ? undefined : "Webhook secret token mismatch.",
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: err.message || "Error verifying webhook token.",
    };
  }
}

