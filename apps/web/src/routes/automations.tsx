import { useState } from "react";
import {
  Workflow,
  Plus,
  Zap,
  ArrowRight,
  GitBranch,
  CheckCircle2,
  Users,
  Eye,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusBadge, EmptyState, SearchInput } from "@/components/common";
import type { AutomationWorkflow, AutomationTriggerType } from "@/types";

const sampleWorkflows: AutomationWorkflow[] = [
  {
    id: "wf-1",
    name: "Customer Welcome & Activation Series",
    description: "4-step onboarding sequence triggered immediately when a new user verifies their email.",
    triggerType: "user_signup",
    isActive: true,
    stepCount: 4,
    totalEnrolled: 1420,
    completedCount: 1280,
    lastTriggeredAt: "15 minutes ago",
  },
  {
    id: "wf-2",
    name: "VIP Customer Engagement Drip",
    description: "Sends customized perk announcements and invitations when 'VIP' tag is applied.",
    triggerType: "tag_added",
    isActive: true,
    stepCount: 3,
    totalEnrolled: 420,
    completedCount: 390,
    lastTriggeredAt: "2 hours ago",
  },
  {
    id: "wf-3",
    name: "Abandoned Checkout Recovery",
    description: "Multi-touch notification schedule with 1hr delay, 24hr reminder, and 10% coupon code.",
    triggerType: "cart_abandoned",
    isActive: false,
    stepCount: 3,
    totalEnrolled: 890,
    completedCount: 710,
    lastTriggeredAt: "Yesterday",
  },
  {
    id: "wf-4",
    name: "Re-engagement Sequence (60d Inactive)",
    description: "Re-activates dormant subscribers before moving unengaged contacts to clean archive.",
    triggerType: "custom_event",
    isActive: true,
    stepCount: 2,
    totalEnrolled: 640,
    completedCount: 580,
    lastTriggeredAt: "3 days ago",
  },
];

export function AutomationBuilderPage() {
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>(sampleWorkflows);
  const [filterState, setFilterState] = useState<"all" | "active" | "paused">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showEmptyState, setShowEmptyState] = useState(false);
  const [selectedWorkflowPreview, setSelectedWorkflowPreview] = useState<AutomationWorkflow | null>(null);

  const toggleWorkflowStatus = (id: string) => {
    setWorkflows((prev) =>
      prev.map((wf) => (wf.id === id ? { ...wf, isActive: !wf.isActive } : wf))
    );
  };

  const filtered = workflows.filter((wf) => {
    const matchesFilter =
      filterState === "all"
        ? true
        : filterState === "active"
        ? wf.isActive
        : !wf.isActive;
    const matchesSearch =
      wf.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wf.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const displayedList = showEmptyState ? [] : filtered;

  const getTriggerLabel = (type: AutomationTriggerType) => {
    switch (type) {
      case "user_signup":
        return "User Sign-up";
      case "tag_added":
        return "Tag Applied";
      case "cart_abandoned":
        return "Abandoned Cart";
      case "link_clicked":
        return "Link Clicked";
      default:
        return "Custom Event";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automation Builder"
        description="Build trigger-based workflows, drip sequences, and behavioral autoresponders."
        badge={
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
            {workflows.length} Workflows
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEmptyState(!showEmptyState)}
              className="text-xs text-slate-500 hover:text-indigo-600 underline underline-offset-2 px-2"
            >
              {showEmptyState ? "Show Sample Workflows" : "View Empty State"}
            </button>
            <Button
              onClick={() =>
                alert("Visual Automation Flow Editor will be activated in Phase 7.")
              }
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm gap-2 text-xs sm:text-sm font-medium h-9 px-4"
            >
              <Plus className="h-4 w-4" />
              Create Workflow
            </Button>
          </div>
        }
      />

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-xs">
          {(["all", "active", "paused"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilterState(tab)}
              className={`rounded-md px-3 py-1 font-medium capitalize transition-colors ${
                filterState === tab
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <SearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery("")}
            placeholder="Search workflows..."
          />
        </div>
      </div>

      {/* Workflows Cards Grid */}
      {displayedList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {displayedList.map((wf) => (
            <div
              key={wf.id}
              className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
            >
              <div>
                {/* Header: Title + Active Toggle */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-slate-900">
                        {wf.name}
                      </h3>
                      <StatusBadge
                        status={wf.isActive ? "active" : "paused"}
                        label={wf.isActive ? "Running" : "Paused"}
                      />
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {wf.description}
                    </p>
                  </div>

                  {/* Active / Pause Switch */}
                  <button
                    type="button"
                    onClick={() => toggleWorkflowStatus(wf.id)}
                    className={`h-6 w-11 rounded-full p-0.5 transition-colors focus:outline-none shrink-0 ${
                      wf.isActive ? "bg-indigo-600" : "bg-slate-200"
                    }`}
                    title={wf.isActive ? "Pause workflow" : "Activate workflow"}
                  >
                    <div
                      className={`h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                        wf.isActive ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Workflow Flow Steps Visual Preview */}
                <div className="mt-4 p-3 rounded-lg bg-slate-50/70 border border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    <span>Trigger: {getTriggerLabel(wf.triggerType)}</span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                  <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500">
                    <GitBranch className="h-3 w-3 text-indigo-500" />
                    <span>{wf.stepCount} Steps</span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                  <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Delivery</span>
                  </div>
                </div>
              </div>

              {/* Bottom Metrics & Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-4 text-slate-500">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    <strong className="text-slate-700">{wf.totalEnrolled.toLocaleString()}</strong> enrolled
                  </span>
                  <span>&bull;</span>
                  <span>
                    Last fired: <strong className="text-slate-700">{wf.lastTriggeredAt}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedWorkflowPreview(wf)}
                    className="h-7 px-2 text-xs text-slate-600 hover:text-indigo-600"
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Inspect
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      alert(`Editing flow for ${wf.name} (ready for Phase 7 flow designer).`)
                    }
                    className="h-7 px-2 text-xs text-indigo-600 font-medium"
                  >
                    Edit Flow
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Workflow}
          title="No automations configured"
          description={
            showEmptyState
              ? "You haven't set up any automated journeys yet. Engage leads automatically with triggered emails."
              : "No workflows matched your search filter."
          }
          actionLabel="Create First Automation"
          onAction={() => setShowEmptyState(false)}
        />
      )}

      {/* Workflow Inspect Drawer Modal */}
      {selectedWorkflowPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Workflow className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  {selectedWorkflowPreview.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWorkflowPreview(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70 space-y-2">
                <div className="font-semibold text-slate-900">Step 1: Ingestion Trigger</div>
                <p className="text-slate-500">
                  Listens to webhook event <code>user.created</code> from Supabase Authentication.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70 space-y-2">
                <div className="font-semibold text-slate-900">Step 2: Time Delay</div>
                <p className="text-slate-500">
                  Wait 10 minutes before dispatching initial welcome message.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70 space-y-2">
                <div className="font-semibold text-slate-900">Step 3: Dispatch Email</div>
                <p className="text-slate-500">
                  Send template <strong>"Modern SaaS Product Launch"</strong> with personal merge tags.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedWorkflowPreview(null)}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
