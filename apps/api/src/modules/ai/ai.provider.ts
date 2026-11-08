import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env";

export interface ChatMessage {
  role: "user" | "model" | "assistant";
  content: string;
}

export interface AIProvider {
  name: string;
  isConfigured(): boolean;
  generateText(prompt: string, systemPrompt?: string): Promise<string>;
  chat(messages: ChatMessage[], systemPrompt?: string): Promise<string>;
}

/**
 * Google Gemini Provider (@google/genai native official SDK integration)
 */
export class GeminiProvider implements AIProvider {
  name = "gemini";
  private ai: GoogleGenAI | null = null;
  private apiKey: string | undefined;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey !== undefined ? apiKey : env.GEMINI_API_KEY;
    this.model = model || env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    if (this.isConfigured()) {
      this.ai = new GoogleGenAI({ apiKey: this.apiKey! });
    }
  }

  isConfigured(): boolean {
    return Boolean(
      this.apiKey &&
      this.apiKey.trim().length > 0 &&
      !this.apiKey.includes("placeholder") &&
      !this.apiKey.includes("your_gemini")
    );
  }

  async generateText(prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.isConfigured() || !this.ai) {
      const err: any = new Error(
        "Google Gemini AI is unconfigured. Please set GEMINI_API_KEY in server environment to enable AI Copilot."
      );
      err.statusCode = 503;
      throw err;
    }

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: systemPrompt ? { systemInstruction: systemPrompt } : undefined,
      });

      const text = response.text;
      if (!text) throw new Error("Empty response received from Google Gemini.");
      return text.trim();
    } catch (err: any) {
      if (err.statusCode === 503) throw err;
      throw new Error(`Google Gemini generation error: ${err.message || String(err)}`);
    }
  }

  async chat(messages: ChatMessage[], systemPrompt?: string): Promise<string> {
    if (!this.isConfigured() || !this.ai) {
      const err: any = new Error(
        "Google Gemini AI is unconfigured. Please set GEMINI_API_KEY in server environment."
      );
      err.statusCode = 503;
      throw err;
    }

    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents,
        config: systemPrompt ? { systemInstruction: systemPrompt } : undefined,
      });

      return response.text?.trim() || "";
    } catch (err: any) {
      throw new Error(`Google Gemini chat error: ${err.message || String(err)}`);
    }
  }
}

/**
 * Deterministic Mock AI Provider for automated tests & fallback offline development
 */
export class MockAIProvider implements AIProvider {
  name = "mock";

  isConfigured(): boolean {
    return true;
  }

  async generateText(prompt: string, _systemPrompt?: string): Promise<string> {
    const lower = prompt.toLowerCase();

    // 1. Natural Language Automation Workflow Generation
    if (
      lower.includes("react flow workflow") ||
      lower.includes("automated marketing workflow") ||
      lower.includes("allowed trigger types") ||
      lower.includes("create an automated marketing workflow")
    ) {
      return JSON.stringify({
        name: "AI Generated Onboarding & Retention",
        description: "Automated sequence generated from prompt",
        triggerType: "contact_subscribed",
        nodes: [
          {
            id: "node-trigger-1",
            type: "contact_subscribed",
            position: { x: 300, y: 50 },
            data: { label: "Contact Subscribed" },
          },
          {
            id: "node-delay-1",
            type: "delay",
            position: { x: 300, y: 180 },
            data: { label: "Wait 2 Days", duration: 2, unit: "days" },
          },
          {
            id: "node-action-1",
            type: "send_email",
            position: { x: 300, y: 320 },
            data: {
              label: "Send Welcome Discount",
              subject: "Welcome to MailPilot! Here is your exclusive pass",
              htmlContent: "<p>Hi {{firstName}}, thank you for joining us! Use code WELCOME20 for 20% off.</p>",
              fromName: "MailPilot Onboarding",
              fromEmail: "welcome@mailpilot.io",
            },
          },
        ],
        edges: [
          { id: "edge-1", source: "node-trigger-1", target: "node-delay-1" },
          { id: "edge-2", source: "node-delay-1", target: "node-action-1" },
        ],
      });
    }

    // 2. Email draft request
    if (lower.includes("draft") || lower.includes("bodyhtml") || lower.includes("complete email campaign")) {
      return JSON.stringify({
        subject: "Supercharge your customer retention with MailPilot",
        preheader: "Everything you need to automate onboarding sequences seamlessly.",
        heading: "Automate Your Email Marketing with Millisecond Precision",
        bodyHtml:
          "<p>Hi there,</p><p>We are thrilled to announce MailPilot's new visual workflow automation engine. Connect triggers, delay steps, and branching logic effortlessly.</p><p>Experience higher deliverability and granular behavioral analytics from your unified dashboard.</p>",
        ctaText: "Explore Visual Automations",
        ctaUrl: "https://mailpilot.io/automations",
      });
    }

    // 3. Campaign improvement / spam risk analysis
    if (
      lower.includes("analyze this email") ||
      lower.includes("spam") ||
      lower.includes("improve") ||
      lower.includes("readabilityscore")
    ) {
      return JSON.stringify({
        readabilityScore: 88,
        clarityGrade: "High",
        ctaStrength: "Strong",
        spamRisk: "Low",
        suggestions: [
          "Subject line length is concise and avoids all-caps triggers.",
          "Clear, single call-to-action button enhances conversion rate.",
          "Preheader text complements the subject without redundancy.",
        ],
        spamWarnings: [],
      });
    }

    // 4. Subject lines request
    if (lower.includes("subject line") || lower.includes("subject-lines")) {
      return JSON.stringify([
        "🚀 Unlock 30% faster campaign delivery with MailPilot",
        "Introducing our next-generation automation suite",
        "Quick update regarding your email deliverability",
        "Why top SaaS teams are migrating their dispatches",
        "Action required: Verify your sending reputation",
      ]);
    }

    // 5. Preheaders request
    if (lower.includes("preheader") || lower.includes("pre-header")) {
      return JSON.stringify([
        "See what's new inside your MailPilot workspace today.",
        "A smarter way to automate drip sequences and triggers.",
        "Exclusive early access for your team inside.",
      ]);
    }

    return "Mock response generated by MailPilot Gemini Copilot.";
  }

  async chat(messages: ChatMessage[], _systemPrompt?: string): Promise<string> {
    const lastMessage = messages[messages.length - 1]?.content || "";
    return `MailPilot AI Copilot: Based on your request "${lastMessage.slice(0, 50)}...", here is my strategic recommendation: Focus on personalized subject lines, segment your active subscribers, and test clear call-to-action buttons.`;
  }
}

let activeProvider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (activeProvider) return activeProvider;

  if (process.env.NODE_ENV === "test") {
    activeProvider = new MockAIProvider();
    return activeProvider;
  }

  // If Gemini API key is configured, use native GeminiProvider
  if (env.GEMINI_API_KEY && !env.GEMINI_API_KEY.includes("placeholder")) {
    activeProvider = new GeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL);
    return activeProvider;
  }

  // Otherwise, fallback gracefully to GeminiProvider (which throws clear 503 on execute) or MockAIProvider in dev
  activeProvider = new GeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL);
  return activeProvider;
}

export function setTestAIProvider(mock?: AIProvider): void {
  activeProvider = mock || new MockAIProvider();
}
