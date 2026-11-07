import { useState } from "react";
import {
  Mail,
  Plus,
  Eye,
  Copy,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  DataTable,
  StatusBadge,
  EmptyState,
  SearchInput,
  type Column,
} from "@/components/common";
import type { Campaign, CampaignStatus } from "@/types";

const sampleCampaigns: Campaign[] = [
  {
    id: "camp-101",
    name: "Summer Product Launch 2026",
    subject: "Announcing MailPilot 2.0: Smarter email automation",
    status: "sent",
    audience: "All Subscribers",
    recipientCount: 4850,
    sentAt: "May 5, 2026, 10:30 AM",
    createdAt: "2026-05-04T12:00:00Z",
    stats: {
      sent: 4850,
      delivered: 4820,
      opens: 2480,
      openRate: 51.4,
      clicks: 890,
      clickRate: 18.4,
    },
  },
  {
    id: "camp-102",
    name: "Weekly Engineering Digest #42",
    subject: "Scaling Redis & BullMQ to 10M events",
    status: "sent",
    audience: "Tech Segment",
    recipientCount: 3120,
    sentAt: "May 3, 2026, 02:00 PM",
    createdAt: "2026-05-02T10:00:00Z",
    stats: {
      sent: 3120,
      delivered: 3110,
      opens: 1420,
      openRate: 45.6,
      clicks: 410,
      clickRate: 13.1,
    },
  },
  {
    id: "camp-103",
    name: "Customer Onboarding Sequence — Step 1",
    subject: "Welcome to MailPilot! Here are your API keys",
    status: "scheduled",
    audience: "New Signups",
    recipientCount: 650,
    scheduledFor: "Tomorrow at 09:00 AM",
    createdAt: "2026-05-06T15:00:00Z",
  },
  {
    id: "camp-104",
    name: "Early Access Beta Invitation",
    subject: "You're invited to test our new AI email composer",
    status: "draft",
    audience: "VIP Waitlist",
    recipientCount: 200,
    createdAt: "2026-05-07T08:30:00Z",
  },
  {
    id: "camp-105",
    name: "Flash Sale 24-Hour Notice",
    subject: "Last chance: 40% off Pro tier subscription",
    status: "sending",
    audience: "Inactive 30d",
    recipientCount: 1200,
    createdAt: "2026-05-07T18:00:00Z",
  },
];

export function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(sampleCampaigns);
  const [selectedFilter, setSelectedFilter] = useState<"all" | CampaignStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showEmptyState, setShowEmptyState] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New campaign modal form state
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newAudience, setNewAudience] = useState("All Subscribers");

  // Filtering
  const filteredCampaigns = campaigns.filter((c) => {
    const matchesFilter =
      selectedFilter === "all" ? true : c.status === selectedFilter;
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.subject.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const displayedList = showEmptyState ? [] : filteredCampaigns;

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newCamp: Campaign = {
      id: `camp-${Date.now()}`,
      name: newTitle.trim(),
      subject: newSubject.trim() || "Untitled Broadcast",
      status: "draft",
      audience: newAudience,
      recipientCount: 0,
      createdAt: new Date().toISOString(),
    };

    setCampaigns([newCamp, ...campaigns]);
    setNewTitle("");
    setNewSubject("");
    setIsCreateModalOpen(false);
    setShowEmptyState(false);
  };

  const columns: Column<Campaign>[] = [
    {
      header: "Campaign",
      cell: (row) => (
        <div className="space-y-0.5 max-w-xs sm:max-w-md">
          <div className="font-semibold text-slate-900 truncate">{row.name}</div>
          <div className="text-xs text-slate-500 truncate">{row.subject}</div>
        </div>
      ),
    },
    {
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: "Audience",
      cell: (row) => (
        <span className="text-xs text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded font-medium">
          {row.audience}
        </span>
      ),
    },
    {
      header: "Recipients",
      cell: (row) => (
        <span className="font-mono text-xs text-slate-700">
          {row.recipientCount.toLocaleString()}
        </span>
      ),
    },
    {
      header: "Delivery Date",
      cell: (row) => (
        <span className="text-xs text-slate-500">
          {row.sentAt || row.scheduledFor || "Not scheduled"}
        </span>
      ),
    },
    {
      header: "Open Rate",
      cell: (row) =>
        row.stats?.openRate ? (
          <span className="font-semibold text-emerald-600">
            {row.stats.openRate}%
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      header: "Actions",
      className: "text-right",
      cell: () => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
            title="Preview campaign"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
            title="Duplicate"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Create, manage and monitor your broadcast email campaigns."
        badge={
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
            {campaigns.length} Total
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEmptyState(!showEmptyState)}
              className="text-xs text-slate-500 hover:text-indigo-600 underline underline-offset-2 px-2"
            >
              {showEmptyState ? "Show Sample Campaigns" : "View Empty State"}
            </button>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm gap-2 text-xs sm:text-sm font-medium h-9 px-4"
            >
              <Plus className="h-4 w-4" />
              Create Campaign
            </Button>
          </div>
        }
      />

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Status Filter Pills */}
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-xs">
          {(["all", "draft", "scheduled", "sending", "sent"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setSelectedFilter(tab)}
              className={`rounded-md px-3 py-1 font-medium capitalize transition-colors ${
                selectedFilter === tab
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-64">
          <SearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery("")}
            placeholder="Filter campaigns..."
          />
        </div>
      </div>

      {/* Campaign List or Empty State */}
      {displayedList.length > 0 ? (
        <DataTable<Campaign>
          columns={columns}
          data={displayedList}
          keyExtractor={(row) => row.id}
        />
      ) : (
        <EmptyState
          icon={Mail}
          title="No campaigns found"
          description={
            showEmptyState
              ? "You haven't dispatched any campaigns yet. Launch your first broadcast in minutes."
              : "No campaigns matched your current search filter."
          }
          actionLabel="Create First Campaign"
          onAction={() => setIsCreateModalOpen(true)}
          secondaryActionLabel={
            showEmptyState ? "Show Sample Data" : undefined
          }
          onSecondaryAction={() => setShowEmptyState(false)}
        />
      )}

      {/* Create Campaign Dialog */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Create New Campaign
                  </h3>
                  <p className="text-xs text-slate-500">
                    Draft a single broadcast or scheduled email.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Campaign Name (Internal)
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. June Product Update #3"
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Subject Line (Recipient Inbox)
                </label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="e.g. Big improvements to your workspace..."
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Target Audience
                </label>
                <select
                  value={newAudience}
                  onChange={(e) => setNewAudience(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs bg-white focus:outline-none focus:border-indigo-500 text-slate-700"
                >
                  <option value="All Subscribers">All Subscribers (12,480)</option>
                  <option value="VIP Customers">VIP Customers (1,200)</option>
                  <option value="Tech Segment">Tech Segment (3,120)</option>
                  <option value="New Signups">New Signups (650)</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="h-9 px-4 text-xs border-slate-200 text-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="h-9 px-4 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm"
                >
                  Save Draft Campaign
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
