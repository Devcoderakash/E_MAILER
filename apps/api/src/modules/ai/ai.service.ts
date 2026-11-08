import { z } from "zod";
import { getAIProvider, ChatMessage } from "./ai.provider";
import { AutomationValidator, WorkflowDefinition } from "../automations/automation.validator";

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

export const generateWorkflowSchema = z.object({
  prompt: z.string().trim().min(5, "Prompt must be at least 5 characters").max(1000),
});

export const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "model", "assistant"]),
        content: z.string().min(1),
      })
    )
    .min(1, "At least one message is required"),
  context: z
    .object({
      campaignGoal: z.string().optional(),
      audience: z.string().optional(),
    })
    .optional(),
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
      // Strip markdown code fences if present (```json ... ```)
      const cleaned = text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
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

  /**
   * Generate visual automation workflow from natural language prompt
   */
  static async generateWorkflow(
    workspaceId: string,
    params: z.infer<typeof generateWorkflowSchema>
  ) {
    this.checkRateLimit(workspaceId);
    const provider = getAIProvider();

    const systemPrompt = `You are MailPilot's Automation AI Architect. You convert natural language descriptions of email marketing funnels into valid React Flow workflow definitions.
Allowed trigger types (must have exactly ONE trigger at the start):
- "contact_subscribed" (When a new subscriber signs up)
- "contact_added_to_list" (When subscriber joins a list, data: { listId: string })
- "tag_assigned" (When tag is given, data: { tagName: string })
- "contact_birthday" (Annual birthday)

Allowed logic node types:
- "delay" (data: { duration: number, unit: "minutes" | "hours" | "days" })
- "condition" (data: { conditionType: "has_tag" | "in_list", tagId?: string, listId?: string })
  * For condition nodes, edges MUST specify sourceHandle: "true" (Yes branch) or "false" (No branch).

Allowed action node types:
- "send_email" (data: { subject: string, htmlContent: string, fromName?: string, fromEmail?: string })
- "add_tag" (data: { tagName: string })
- "remove_tag" (data: { tagId: string })
- "add_to_list" (data: { listId: string })
- "remove_from_list" (data: { listId: string })

Positions:
Layout nodes vertically: trigger at {x: 250, y: 50}, next node at {x: 250, y: 180}, next at {x: 250, y: 310}, etc. If branching, branch left ({x: 100, y: 450}) and right ({x: 400, y: 450}).
Return ONLY a valid JSON object matching the schema below without markdown or comments:
{
  "name": "Title of Workflow",
  "description": "Brief description",
  "triggerType": "contact_subscribed",
  "nodes": [
    { "id": "node-1", "type": "contact_subscribed", "position": { "x": 250, "y": 50 }, "data": { "label": "Contact Subscribed" } }
  ],
  "edges": [
    { "id": "e1-2", "source": "node-1", "target": "node-2" }
  ]
}`;

    const prompt = `Create an automated marketing workflow based on this requirement:
"${params.prompt}"

Strictly return JSON matching the specified structure.`;

    const text = await provider.generateText(prompt, systemPrompt);

    const fallbackWorkflow: WorkflowDefinition & { name: string; description: string; triggerType: string } = {
      name: "Auto-Generated Workflow",
      description: params.prompt,
      triggerType: "contact_subscribed",
      nodes: [
        {
          id: "node-trig-1",
          type: "contact_subscribed",
          position: { x: 250, y: 50 },
          data: { label: "Contact Subscribed" },
        },
        {
          id: "node-delay-1",
          type: "delay",
          position: { x: 250, y: 180 },
          data: { label: "Wait 1 Day", duration: 1, unit: "days" },
        },
        {
          id: "node-act-1",
          type: "send_email",
          position: { x: 250, y: 310 },
          data: {
            label: "Send Welcome Email",
            subject: "Welcome to MailPilot!",
            htmlContent: "<p>Thank you for subscribing to our updates.</p>",
          },
        },
      ],
      edges: [
        { id: "e-trig-del", source: "node-trig-1", target: "node-delay-1" },
        { id: "e-del-act", source: "node-delay-1", target: "node-act-1" },
      ],
    };

    let generated = this.parseJSONResponse<any>(text, fallbackWorkflow);

    // Validate that nodes and edges exist
    if (!generated || !Array.isArray(generated.nodes) || generated.nodes.length === 0) {
      generated = fallbackWorkflow;
    }

    // Run official validator
    const validation = AutomationValidator.validate({
      nodes: generated.nodes,
      edges: generated.edges || [],
    });

    return {
      provider: provider.name,
      workflow: {
        name: generated.name || "AI Generated Workflow",
        description: generated.description || params.prompt,
        triggerType: generated.triggerType || generated.nodes[0]?.type || "contact_subscribed",
        nodes: generated.nodes,
        edges: generated.edges || [],
      },
      validation,
    };
  }

  /**
   * Conversational Campaign Copilot assistant
   */
  static async chatCopilot(
    workspaceId: string,
    params: z.infer<typeof chatSchema>
  ) {
    this.checkRateLimit(workspaceId);
    const provider = getAIProvider();

    const systemPrompt = `You are MailPilot's AI Campaign Copilot, a strategic email marketing and automation consultant.
Provide direct, highly actionable advice on subject lines, email copy, audience segmentation, sending cadences, and automation workflows.
Be concise, practical, and helpful.`;

    const reply = await provider.chat(params.messages as ChatMessage[], systemPrompt);

    return {
      provider: provider.name,
      reply,
    };
  }
}
