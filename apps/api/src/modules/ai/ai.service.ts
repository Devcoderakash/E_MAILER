import { z } from "zod";
import { getAIProvider } from "./ai.provider";

// Rate limiting in-memory store: workspaceId -> timestamp array
const workspaceRateLimits = new Map<string, number[]>();
const MAX_REQUESTS_PER_MINUTE = 20;

export const generateSubjectLinesSchema = z.object({
  purpose: z.string().trim().min(3, "Campaign purpose is required").max(500),
  audience: z.string().trim().max(300).optional(),
  tone: z.string().trim().max(50).optional(),
  count: z.coerce.number().min(1).max(10).default(5),
});

export const generateEmailDraftSchema = z.object({
  goal: z.string().trim().min(3, "Campaign goal is required").max(600),
  productDetails: z.string().trim().max(1000).optional(),
  audience: z.string().trim().max(300).optional(),
  tone: z.string().trim().max(50).optional(),
  cta: z.string().trim().max(100).optional(),
});

export const generatePreheaderSchema = z.object({
  subject: z.string().trim().min(2, "Subject line is required").max(300),
  emailContent: z.string().trim().max(3000).optional(),
  count: z.coerce.number().min(1).max(10).default(3),
});

export const improveCampaignSchema = z.object({
  subject: z.string().trim().max(300).optional(),
  preheader: z.string().trim().max(300).optional(),
  htmlContent: z.string().trim().max(15000).optional(),
});

export class AIService {
  /**
   * Enforce sliding-window rate limit per workspace
   */
  static checkRateLimit(workspaceId: string): void {
    const now = Date.now();
    const timestamps = workspaceRateLimits.get(workspaceId) || [];

    // Filter to requests in the last 60 seconds
    const validTimestamps = timestamps.filter((t) => now - t < 60000);

    if (validTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
      const err: any = new Error(
        `Rate limit exceeded: You can make up to ${MAX_REQUESTS_PER_MINUTE} AI requests per minute.`
      );
      err.statusCode = 429;
      throw err;
    }

    validTimestamps.push(now);
    workspaceRateLimits.set(workspaceId, validTimestamps);
  }

  /**
   * Checks if AI Copilot is configured with valid provider credentials
   */
  static isConfigured(): boolean {
    const provider = getAIProvider();
    return provider.isConfigured();
  }

  /**
   * Helper to parse AI responses that are JSON
   */
  private static parseJSONResponse<T>(text: string, fallback: T): T {
    try {
      // Strip markdown code fences if present
      const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      return JSON.parse(cleaned);
    } catch {
      return fallback;
    }
  }

  /**
   * Generate multiple subject line suggestions
   */
  static async generateSubjectLines(
    workspaceId: string,
    params: z.infer<typeof generateSubjectLinesSchema>
  ) {
    this.checkRateLimit(workspaceId);
    const provider = getAIProvider();

    const systemPrompt =
      "You are MailPilot's AI Campaign Copilot, an expert email copywriter. Return ONLY a valid JSON array of strings containing subject lines. Do not include markdown codeblocks or extra text.";

    const prompt = `Generate ${params.count} compelling, high-converting email subject lines for:
Purpose: ${params.purpose}
Target Audience: ${params.audience || "General subscribers"}
Tone: ${params.tone || "Professional and engaging"}

Format strictly as JSON array of strings: ["Subject 1", "Subject 2", ...]`;

    const text = await provider.generateText(prompt, systemPrompt);
    const suggestions = this.parseJSONResponse<string[]>(text, [
      params.purpose,
      `Quick update: ${params.purpose}`,
      `Important: ${params.purpose}`,
    ]);

    return {
      provider: provider.name,
      suggestions: Array.isArray(suggestions) ? suggestions : [String(suggestions)],
    };
  }

  /**
   * Generate complete email draft
   */
  static async generateEmailDraft(
    workspaceId: string,
    params: z.infer<typeof generateEmailDraftSchema>
  ) {
    this.checkRateLimit(workspaceId);
    const provider = getAIProvider();

    const systemPrompt =
      "You are MailPilot's AI Campaign Copilot. Return ONLY a valid JSON object matching the requested schema with HTML body content. Do not include markdown codeblocks.";

    const prompt = `Generate a complete email campaign draft:
Campaign Goal: ${params.goal}
Product/Service Details: ${params.productDetails || "Standard product feature"}
Target Audience: ${params.audience || "Subscribers"}
Tone: ${params.tone || "Friendly and professional"}
Desired CTA: ${params.cta || "Get Started"}

Format strictly as JSON with keys:
{
  "subject": "string",
  "preheader": "string",
  "heading": "string",
  "bodyHtml": "<p>clean email HTML paragraphs</p>",
  "ctaText": "button label",
  "ctaUrl": "https://example.com"
}`;

    const text = await provider.generateText(prompt, systemPrompt);
    const draft = this.parseJSONResponse(text, {
      subject: params.goal,
      preheader: `A quick note about ${params.goal}`,
      heading: params.goal,
      bodyHtml: `<p>Hello,</p><p>We wanted to reach out regarding ${params.goal}.</p>`,
      ctaText: params.cta || "Learn More",
      ctaUrl: "https://mailpilot.io",
    });

    return {
      provider: provider.name,
      draft,
    };
  }

  /**
   * Generate preheader options
   */
  static async generatePreheader(
    workspaceId: string,
    params: z.infer<typeof generatePreheaderSchema>
  ) {
    this.checkRateLimit(workspaceId);
    const provider = getAIProvider();

    const systemPrompt =
      "You are MailPilot's AI Campaign Copilot. Return ONLY a valid JSON array of short preheader text strings (40-90 characters).";

    const prompt = `Generate ${params.count} concise preheaders for:
Subject: "${params.subject}"
Content Summary: ${params.emailContent ? params.emailContent.slice(0, 300) : "Broadcast announcement"}

Format strictly as JSON array of strings: ["Preheader 1", "Preheader 2", ...]`;

    const text = await provider.generateText(prompt, systemPrompt);
    const suggestions = this.parseJSONResponse<string[]>(text, [
      `A brief preview for ${params.subject}`,
      `Details and updates inside.`,
    ]);

    return {
      provider: provider.name,
      suggestions: Array.isArray(suggestions) ? suggestions : [String(suggestions)],
    };
  }

  /**
   * Analyze campaign content for improvements and spam-risk triggers
   */
  static async improveCampaign(
    workspaceId: string,
    params: z.infer<typeof improveCampaignSchema>
  ) {
    this.checkRateLimit(workspaceId);
    const provider = getAIProvider();

    const systemPrompt =
      "You are MailPilot's AI Deliverability & Copywriting Auditor. Return ONLY a valid JSON object analyzing email clarity, CTA strength, and spam-trigger risks.";

    const prompt = `Analyze this email campaign:
Subject: "${params.subject || "No subject"}"
Preheader: "${params.preheader || "No preheader"}"
Content Preview: "${(params.htmlContent || "").replace(/<[^>]*>?/gm, " ").slice(0, 800)}"

Format strictly as JSON:
{
  "readabilityScore": 85,
  "clarityGrade": "High",
  "ctaStrength": "Strong",
  "spamRisk": "Low",
  "suggestions": ["suggestion 1", "suggestion 2"],
  "spamWarnings": ["warning if spam words found, else empty array"]
}`;

    const text = await provider.generateText(prompt, systemPrompt);
    const analysis = this.parseJSONResponse(text, {
      readabilityScore: 80,
      clarityGrade: "Good",
      ctaStrength: "Moderate",
      spamRisk: "Low",
      suggestions: [
        "Ensure CTA is placed prominently near the top third of the email.",
        "Keep subject line under 60 characters for mobile preview clarity.",
      ],
      spamWarnings: [],
    });

    return {
      provider: provider.name,
      analysis,
    };
  }
}
