import { useState } from "react";
import {
  FileText,
  Plus,
  Eye,
  Layout,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState, SearchInput } from "@/components/common";
import type { Template, TemplateCategory } from "@/types";

const sampleTemplates: Template[] = [
  {
    id: "tpl-1",
    name: "Modern SaaS Product Launch",
    description: "High-converting announcement template with hero visual, feature cards, and CTA button.",
    category: "marketing",
    thumbnailColor: "from-indigo-500 to-purple-600",
    lastModified: "May 4, 2026",
    tags: ["Announcement", "Product", "Responsive"],
  },
  {
    id: "tpl-2",
    name: "Minimalist Weekly Digest",
    description: "Clean editorial layout modeled after Linear and Loops newsletters.",
    category: "newsletter",
    thumbnailColor: "from-slate-700 to-slate-900",
    lastModified: "May 1, 2026",
    tags: ["Digest", "Markdown", "Clean"],
  },
  {
    id: "tpl-3",
    name: "Magic Link & Auth Verification",
    description: "High-deliverability transactional email for authentication codes and password resets.",
    category: "transactional",
    thumbnailColor: "from-emerald-500 to-teal-700",
    lastModified: "Apr 28, 2026",
    tags: ["Transactional", "Security"],
  },
  {
    id: "tpl-4",
    name: "Customer Onboarding Sequence — Day 1",
    description: "Friendly introduction email highlighting top 3 workspace setup steps.",
    category: "onboarding",
    thumbnailColor: "from-blue-500 to-cyan-600",
    lastModified: "Apr 22, 2026",
    tags: ["Drip", "Onboarding"],
  },
  {
    id: "tpl-5",
    name: "Black Friday & Seasonal Promotion",
    description: "Eye-catching banner with countdown timer merge tag and coupon block.",
    category: "marketing",
    thumbnailColor: "from-rose-500 to-pink-600",
    lastModified: "Apr 15, 2026",
    tags: ["Promotion", "E-Commerce"],
  },
];

export function TemplatesPage() {
  const [templates] = useState<Template[]>(sampleTemplates);
  const [selectedCategory, setSelectedCategory] = useState<"all" | TemplateCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showEmptyState, setShowEmptyState] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  const filteredTemplates = templates.filter((tpl) => {
    const matchesCategory =
      selectedCategory === "all" ? true : tpl.category === selectedCategory;
    const matchesSearch =
      tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const displayedList = showEmptyState ? [] : filteredTemplates;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Templates"
        description="Design responsive email templates with modern layouts and dynamic merge tags."
        badge={
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
            {templates.length} Templates
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEmptyState(!showEmptyState)}
              className="text-xs text-slate-500 hover:text-indigo-600 underline underline-offset-2 px-2"
            >
              {showEmptyState ? "Show Sample Templates" : "View Empty State"}
            </button>
            <Button
              onClick={() =>
                alert("Template designer canvas will be activated in subsequent phases.")
              }
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm gap-2 text-xs sm:text-sm font-medium h-9 px-4"
            >
              <Plus className="h-4 w-4" />
              New Template
            </Button>
          </div>
        }
      />

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-xs overflow-x-auto">
          {(["all", "marketing", "newsletter", "transactional", "onboarding"] as const).map(
            (cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-md px-3 py-1 font-medium capitalize whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {cat}
              </button>
            )
          )}
        </div>

        <div className="w-full sm:w-64">
          <SearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery("")}
            placeholder="Search templates..."
          />
        </div>
      </div>

      {/* Template Grid or Empty State */}
      {displayedList.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedList.map((template) => (
            <div
              key={template.id}
              className="group rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Mock Visual Thumbnail Header */}
                <div
                  className={`h-36 w-full bg-gradient-to-br ${template.thumbnailColor} p-4 flex flex-col justify-between relative overflow-hidden`}
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-black/20 backdrop-blur-xs px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                      {template.category}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewTemplate(template)}
                      className="h-7 w-7 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-xs text-white flex items-center justify-center transition-colors"
                      title="Quick Preview"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Mock Wireframe Inside */}
                  <div className="w-full bg-white/10 backdrop-blur-xs rounded p-2.5 space-y-1.5 border border-white/15">
                    <div className="h-2 w-2/3 bg-white/70 rounded-full" />
                    <div className="h-1.5 w-full bg-white/40 rounded-full" />
                    <div className="h-1.5 w-4/5 bg-white/40 rounded-full" />
                  </div>
                </div>

                {/* Details */}
                <div className="p-4 space-y-2">
                  <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors text-sm line-clamp-1">
                    {template.name}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                    {template.description}
                  </p>

                  <div className="flex flex-wrap gap-1 pt-1">
                    {template.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200/60"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
                <span>Updated {template.lastModified}</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewTemplate(template)}
                    className="h-7 px-2 text-xs text-slate-600 hover:text-indigo-600"
                  >
                    Preview
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      alert(`Editing ${template.name} canvas (ready for Phase 5 template builder).`)
                    }
                    className="h-7 px-2 text-xs text-indigo-600 font-medium"
                  >
                    Edit
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="No email templates found"
          description={
            showEmptyState
              ? "You haven't created any templates yet. Start by generating a responsive layout."
              : "No templates matched your category or search query."
          }
          actionLabel="Create First Template"
          onAction={() => setShowEmptyState(false)}
          secondaryActionLabel={showEmptyState ? "Show Gallery" : undefined}
          onSecondaryAction={() => setShowEmptyState(false)}
        />
      )}

      {/* Template Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Layout className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  {previewTemplate.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 p-6 rounded-xl border border-slate-200 bg-slate-50 text-center space-y-4">
              <div className="max-w-md mx-auto bg-white rounded-lg shadow-sm border border-slate-200/80 p-6 text-left space-y-3">
                <div className="h-6 w-24 bg-indigo-600 rounded flex items-center justify-center text-[10px] text-white font-bold tracking-wider">
                  MAILPILOT
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  Exclusive Preview: MailPilot Automation 2.0
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Hi {"{{ contact.first_name | default: 'there' }}"}, we are thrilled to introduce our new real-time email deliverability engine.
                </p>
                <div className="py-2 text-center">
                  <span className="inline-block px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold text-xs shadow-xs">
                    Get Early Access &rarr;
                  </span>
                </div>
                <div className="pt-3 border-t border-slate-100 text-[10px] text-slate-400 text-center">
                  You received this because you are subscribed to {"{{ workspace.name }}"}.
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewTemplate(null)}
                className="text-xs"
              >
                Close Preview
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  alert(`Template copied to your workspace.`);
                  setPreviewTemplate(null);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
              >
                Use This Template
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
