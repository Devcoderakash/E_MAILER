import { useState } from "react";
import {
  Users,
  Plus,
  Upload,
  X,
  FileSpreadsheet,
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
import type { Contact, ContactStatus } from "@/types";

const sampleContacts: Contact[] = [
  {
    id: "cnt-1",
    email: "sarah.connor@cyberdyne.io",
    name: "Sarah Connor",
    status: "active",
    tags: ["VIP", "Beta Tester"],
    createdAt: "May 2, 2026",
    engagementScore: 94,
  },
  {
    id: "cnt-2",
    email: "alex.mercer@gentek.org",
    name: "Alex Mercer",
    status: "active",
    tags: ["Tech Segment", "Developer"],
    createdAt: "May 1, 2026",
    engagementScore: 82,
  },
  {
    id: "cnt-3",
    email: "elena.fisher@uncharted.com",
    name: "Elena Fisher",
    status: "active",
    tags: ["Journalist", "Newsletter"],
    createdAt: "Apr 28, 2026",
    engagementScore: 88,
  },
  {
    id: "cnt-4",
    email: "gordon.freeman@blackmesa.gov",
    name: "Dr. Gordon Freeman",
    status: "unsubscribed",
    tags: ["Research"],
    createdAt: "Apr 15, 2026",
    engagementScore: 12,
  },
  {
    id: "cnt-5",
    email: "invalid-mail@broken-domain.xyz",
    name: "Legacy Bounced Contact",
    status: "bounced",
    tags: ["Import Error"],
    createdAt: "Apr 10, 2026",
    engagementScore: 0,
  },
];

export function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>(sampleContacts);
  const [statusFilter, setStatusFilter] = useState<"all" | ContactStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showEmptyState, setShowEmptyState] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New Contact form
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");

  const filteredContacts = contacts.filter((c) => {
    const matchesFilter =
      statusFilter === "all" ? true : c.status === statusFilter;
    const matchesSearch =
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.name && c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const displayedList = showEmptyState ? [] : filteredContacts;

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    const newContact: Contact = {
      id: `cnt-${Date.now()}`,
      email: newEmail.trim(),
      name: newName.trim() || undefined,
      status: "active",
      tags: ["Direct Entry"],
      createdAt: "Today",
      engagementScore: 50,
    };

    setContacts([newContact, ...contacts]);
    setNewEmail("");
    setNewName("");
    setIsAddModalOpen(false);
    setShowEmptyState(false);
  };

  const columns: Column<Contact>[] = [
    {
      header: "Subscriber",
      cell: (row) => (
        <div className="space-y-0.5">
          <div className="font-semibold text-slate-900">{row.email}</div>
          {row.name && <div className="text-xs text-slate-500">{row.name}</div>}
        </div>
      ),
    },
    {
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: "Tags",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200/60"
            >
              {tag}
            </span>
          ))}
        </div>
      ),
    },
    {
      header: "Added Date",
      cell: (row) => (
        <span className="text-xs text-slate-500">{row.createdAt}</span>
      ),
    },
    {
      header: "Engagement",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                (row.engagementScore ?? 0) > 70
                  ? "bg-emerald-500"
                  : (row.engagementScore ?? 0) > 30
                  ? "bg-indigo-500"
                  : "bg-slate-300"
              }`}
              style={{ width: `${row.engagementScore ?? 0}%` }}
            />
          </div>
          <span className="text-xs font-mono font-medium text-slate-600">
            {row.engagementScore}%
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts & Audiences"
        description="Manage your subscriber lists, segments, and contact properties."
        badge={
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
            {contacts.length} Total
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEmptyState(!showEmptyState)}
              className="text-xs text-slate-500 hover:text-indigo-600 underline underline-offset-2 px-2"
            >
              {showEmptyState ? "Show Sample Contacts" : "View Empty State"}
            </button>
            <Button
              variant="outline"
              onClick={() => setIsImportModalOpen(true)}
              className="border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5 text-xs h-9 px-3.5"
            >
              <Upload className="h-3.5 w-3.5" />
              Import CSV
            </Button>
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm gap-1.5 text-xs h-9 px-3.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Contact
            </Button>
          </div>
        }
      />

      {/* Audience Overview Mini-Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-slate-200/80 bg-white shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Contacts
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">12,480</div>
          <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
            +140 this week
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/80 bg-white shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Active Subscribers
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">11,890</div>
          <div className="text-[10px] text-slate-500 mt-0.5">95.2% deliverable</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/80 bg-white shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Unsubscribed
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">540</div>
          <div className="text-[10px] text-slate-500 mt-0.5">4.3% opt-out</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/80 bg-white shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Bounced
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">50</div>
          <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
            0.4% (Healthy)
          </div>
        </div>
      </div>

      {/* Search & Status Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-xs">
          {(["all", "active", "unsubscribed", "bounced"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`rounded-md px-3 py-1 font-medium capitalize transition-colors ${
                statusFilter === tab
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
            placeholder="Search email or name..."
          />
        </div>
      </div>

      {/* Contacts List or Empty State */}
      {displayedList.length > 0 ? (
        <DataTable<Contact>
          columns={columns}
          data={displayedList}
          keyExtractor={(row) => row.id}
        />
      ) : (
        <EmptyState
          icon={Users}
          title="No contacts found"
          description={
            showEmptyState
              ? "Your audience list is currently empty. Import existing subscribers from a CSV or add them manually."
              : "No contacts matched your search filter criteria."
          }
          actionLabel="Add First Contact"
          onAction={() => setIsAddModalOpen(true)}
          secondaryActionLabel="Import CSV File"
          onSecondaryAction={() => setIsImportModalOpen(true)}
        />
      )}

      {/* Add Contact Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Add New Contact</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddContact} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddModalOpen(false)}
                  className="h-8 px-3 text-xs border-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Save Contact
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Contacts Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Import Audience CSV
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs text-slate-600">
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer">
                <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="font-semibold text-slate-800">
                  Drop your CSV file here, or browse
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Supports columns: email, first_name, last_name, tags (Max 50MB)
                </p>
              </div>

              <div className="rounded-lg bg-amber-50 p-3 border border-amber-200/80 text-[11px] text-amber-800">
                Ensure you have explicit opt-in consent from all subscribers to protect your domain reputation.
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsImportModalOpen(false)}
                  className="text-xs"
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    alert("CSV parsing engine ready for Phase 4 ingestion.");
                    setIsImportModalOpen(false);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                >
                  Start Import
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
