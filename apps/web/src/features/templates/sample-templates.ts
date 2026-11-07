import { EditorDocument } from "./types";
import { compileBlocksToHTML } from "./compiler";

export interface StarterTemplate {
  name: string;
  category: "MARKETING" | "NEWSLETTER" | "TRANSACTIONAL" | "WELCOME" | "PROMOTIONAL" | "CUSTOM";
  description: string;
  subject: string;
  preheader: string;
  document: EditorDocument;
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    name: "Modern Product Launch",
    category: "MARKETING",
    description: "High-converting announcement template with hero banner, feature highlight, and primary CTA.",
    subject: "Introducing MailPilot 2.0: Smarter email marketing for {{company}}",
    preheader: "Experience automated workflows, instant analytics, and high-throughput delivery.",
    document: {
      settings: {
        contentWidth: 600,
        backgroundColor: "#f8fafc",
        cardColor: "#ffffff",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      },
      blocks: [
        {
          id: "blk-1",
          type: "header",
          title: "MailPilot 2.0 is Here 🚀",
          subtitle: "Built for high-scale email automation",
          bgColor: "#4f46e5",
          textColor: "#ffffff",
          align: "center",
          padding: 36,
        },
        {
          id: "blk-2",
          type: "heading",
          text: "Hi {{first_name}}, meet the new MailPilot",
          level: 2,
          color: "#0f172a",
          align: "left",
          paddingTop: 24,
          paddingBottom: 8,
        },
        {
          id: "blk-3",
          type: "text",
          content:
            "We are thrilled to unveil MailPilot 2.0. Designed from the ground up to give teams at {{company}} the speed, reliability, and deliverability needed to scale customer communication.\n\nEnjoy responsive drag-and-drop templates, real-time subscriber tagging, and sub-millisecond event processing.",
          fontSize: 15,
          lineHeight: 1.6,
          color: "#334155",
          align: "left",
          paddingTop: 8,
          paddingBottom: 16,
        },
        {
          id: "blk-4",
          type: "button",
          text: "Explore Your Dashboard",
          url: "https://mailpilot.io/dashboard",
          bgColor: "#4f46e5",
          textColor: "#ffffff",
          borderRadius: 6,
          align: "center",
          paddingY: 13,
          paddingX: 28,
        },
        {
          id: "blk-5",
          type: "divider",
          color: "#e2e8f0",
          thickness: 1,
          style: "solid",
          margin: 20,
        },
        {
          id: "blk-6",
          type: "footer",
          companyName: "MailPilot Technologies, Inc.",
          address: "548 Market St, Suite 100, San Francisco, CA 94104",
          unsubscribeText: "Unsubscribe from product updates",
          bgColor: "#f8fafc",
          textColor: "#64748b",
        },
      ],
    },
  },
  {
    name: "Weekly Editorial Digest",
    category: "NEWSLETTER",
    description: "Clean, distraction-free editorial layout inspired by Loops and Linear digests.",
    subject: "The Weekly Dispatch #42: Engineering at scale",
    preheader: "Top insights, architecture patterns, and tools hand-picked for your team.",
    document: {
      settings: {
        contentWidth: 580,
        backgroundColor: "#f1f5f9",
        cardColor: "#ffffff",
        fontFamily: "Georgia, serif",
      },
      blocks: [
        {
          id: "blk-nl-1",
          type: "heading",
          text: "The Weekly Dispatch",
          level: 1,
          color: "#0f172a",
          align: "center",
          paddingTop: 32,
          paddingBottom: 4,
        },
        {
          id: "blk-nl-2",
          type: "text",
          content: "Issue #42 • Curated by the MailPilot Engineering Team",
          fontSize: 13,
          lineHeight: 1.4,
          color: "#64748b",
          align: "center",
          paddingTop: 0,
          paddingBottom: 16,
        },
        {
          id: "blk-nl-3",
          type: "divider",
          color: "#0f172a",
          thickness: 2,
          style: "solid",
          margin: 12,
        },
        {
          id: "blk-nl-4",
          type: "text",
          content:
            "Hello {{first_name}},\n\nThis week, we dive into distributed queue design with BullMQ and Redis, optimizing PostgreSQL queries across multi-tenant architectures, and maintaining inbox reputation through strict unsubscribe preservation.",
          fontSize: 16,
          lineHeight: 1.7,
          color: "#334155",
          align: "left",
          paddingTop: 12,
          paddingBottom: 16,
        },
        {
          id: "blk-nl-5",
          type: "button",
          text: "Read the Full Post →",
          url: "https://mailpilot.io/blog/issue-42",
          bgColor: "#0f172a",
          textColor: "#ffffff",
          borderRadius: 4,
          align: "left",
          paddingY: 10,
          paddingX: 20,
        },
        {
          id: "blk-nl-6",
          type: "footer",
          companyName: "MailPilot Editorial",
          address: "Sent to {{email}} • Manage your newsletter preferences",
          unsubscribeText: "Unsubscribe from weekly newsletter",
          bgColor: "#ffffff",
          textColor: "#94a3b8",
        },
      ],
    },
  },
  {
    name: "Customer Welcome Sequence",
    category: "WELCOME",
    description: "Warm welcome message introducing key workspace features and onboarding guide.",
    subject: "Welcome to MailPilot, {{first_name}}!",
    preheader: "Let's set up your email marketing workspace in 3 quick steps.",
    document: {
      settings: {
        contentWidth: 600,
        backgroundColor: "#f8fafc",
        cardColor: "#ffffff",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      },
      blocks: [
        {
          id: "blk-wel-1",
          type: "header",
          title: "Welcome to MailPilot 🎉",
          subtitle: "We are glad you joined us",
          bgColor: "#0ea5e9",
          textColor: "#ffffff",
          align: "center",
          padding: 32,
        },
        {
          id: "blk-wel-2",
          type: "heading",
          text: "Welcome aboard, {{first_name}}!",
          level: 2,
          color: "#0f172a",
          align: "left",
          paddingTop: 24,
          paddingBottom: 8,
        },
        {
          id: "blk-wel-3",
          type: "text",
          content:
            "Thank you for choosing MailPilot for {{company}}. Here are three steps to get you up and running right away:\n\n1. Import your audience contacts via CSV\n2. Customize your first email template in our Studio\n3. Launch your campaign with full deliverability insights",
          fontSize: 15,
          lineHeight: 1.6,
          color: "#334155",
          align: "left",
          paddingTop: 8,
          paddingBottom: 20,
        },
        {
          id: "blk-wel-4",
          type: "button",
          text: "Start Workspace Setup",
          url: "https://mailpilot.io/dashboard",
          bgColor: "#0ea5e9",
          textColor: "#ffffff",
          borderRadius: 6,
          align: "center",
          paddingY: 12,
          paddingX: 26,
        },
        {
          id: "blk-wel-5",
          type: "footer",
          companyName: "MailPilot",
          address: "San Francisco, CA • support@mailpilot.io",
          unsubscribeText: "Unsubscribe",
          bgColor: "#f8fafc",
          textColor: "#64748b",
        },
      ],
    },
  },
];

export function getStarterHTML(template: StarterTemplate): string {
  return compileBlocksToHTML(template.document, {
    subject: template.subject,
    preheader: template.preheader,
  });
}
