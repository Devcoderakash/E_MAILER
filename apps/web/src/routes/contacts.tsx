import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Plus,
  Upload,
  X,
  FileSpreadsheet,
  Trash2,
  Edit2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Tag,
  FolderPlus,
  CheckCircle2,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  StatusBadge,
  EmptyState,
  SearchInput,
} from "@/components/common";
import type {
  Contact,
  ContactStatus,
} from "@/types";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/features/auth/use-auth-store";

// Helper for CSV parsing
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .split(/\r\n|\n|\r/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(cur.trim().replace(/^"|"$/g, ""));
        cur = "";
      } else {
        cur += char;
      }
    }
    result.push(cur.trim().replace(/^"|"$/g, ""));
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

export function ContactsPage() {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useAuthStore();

  // State
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [listFilter, setListFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDesc, setNewListDesc] = useState("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Clear toast after 4s
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Queries
  const { data: stats } = useQuery({
    queryKey: ["contact-stats", activeWorkspace?.id],
    queryFn: () => api.getContactStats(),
    enabled: !!activeWorkspace?.id,
  });

  const { data: listsData } = useQuery({
    queryKey: ["contact-lists", activeWorkspace?.id],
    queryFn: () => api.getContactLists(),
    enabled: !!activeWorkspace?.id,
  });

  const { data: tagsData } = useQuery({
    queryKey: ["contact-tags", activeWorkspace?.id],
    queryFn: () => api.getContactTags(),
    enabled: !!activeWorkspace?.id,
  });

  const { data: contactsData, isLoading: isLoadingContacts } = useQuery({
    queryKey: [
      "contacts",
      activeWorkspace?.id,
      page,
      limit,
      debouncedSearch,
      statusFilter,
      listFilter,
      tagFilter,
    ],
    queryFn: () =>
      api.getContacts({
        page,
        limit,
        search: debouncedSearch || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        listId: listFilter !== "all" ? listFilter : undefined,
        tagId: tagFilter !== "all" ? tagFilter : undefined,
      }),
    enabled: !!activeWorkspace?.id,
  });

  const contactsList = contactsData?.contacts || [];
  const totalContacts = contactsData?.total || 0;
  const totalPages = contactsData?.totalPages || 1;
  const lists = listsData?.lists || [];
  const tags = tagsData?.tags || [];

  // Invalidate queries helper
  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    queryClient.invalidateQueries({ queryKey: ["contact-stats"] });
    queryClient.invalidateQueries({ queryKey: ["contact-lists"] });
    queryClient.invalidateQueries({ queryKey: ["contact-tags"] });
  };

  // Add Contact Form State
  const [addForm, setAddForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    company: "",
    status: "ACTIVE" as ContactStatus,
    tags: "",
    selectedLists: [] as string[],
  });
  const [addError, setAddError] = useState("");

  const createContactMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.createContact>[0]) =>
      api.createContact(data),
    onSuccess: () => {
      refreshAll();
      setIsAddModalOpen(false);
      setAddForm({
        email: "",
        firstName: "",
        lastName: "",
        phone: "",
        company: "",
        status: "ACTIVE",
        tags: "",
        selectedLists: [],
      });
      setToastMessage({ type: "success", text: "Contact created successfully" });
    },
    onError: (err: any) => {
      setAddError(err.message || "Failed to create contact");
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    if (!addForm.email.trim()) {
      setAddError("Email address is required");
      return;
    }

    const tagList = addForm.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    createContactMutation.mutate({
      email: addForm.email.trim(),
      firstName: addForm.firstName.trim() || undefined,
      lastName: addForm.lastName.trim() || undefined,
      phone: addForm.phone.trim() || undefined,
      company: addForm.company.trim() || undefined,
      status: addForm.status,
      tags: tagList.length > 0 ? tagList : undefined,
      listIds: addForm.selectedLists.length > 0 ? addForm.selectedLists : undefined,
    });
  };

  // Edit Contact Form State
  const [editForm, setEditForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    company: "",
    status: "ACTIVE" as ContactStatus,
    tags: "",
    selectedLists: [] as string[],
  });
  const [editError, setEditError] = useState("");

  const openEditModal = (c: Contact) => {
    setEditingContact(c);
    setEditError("");
    const existingTags = (c.tags || [])
      .map((t) => (typeof t === "string" ? t : t.name))
      .join(", ");
    const existingListIds = (c.lists || []).map((l) => l.id);

    setEditForm({
      email: c.email,
      firstName: c.firstName || "",
      lastName: c.lastName || "",
      phone: c.phone || "",
      company: c.company || "",
      status: (c.status.toUpperCase() as ContactStatus) || "ACTIVE",
      tags: existingTags,
      selectedLists: existingListIds,
    });
    setIsEditModalOpen(true);
  };

  const updateContactMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.updateContact(id, data),
    onSuccess: () => {
      refreshAll();
      setIsEditModalOpen(false);
      setEditingContact(null);
      setToastMessage({ type: "success", text: "Contact updated successfully" });
    },
    onError: (err: any) => {
      setEditError(err.message || "Failed to update contact");
    },
  });

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact) return;
    setEditError("");

    const tagList = editForm.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    updateContactMutation.mutate({
      id: editingContact.id,
      data: {
        email: editForm.email.trim(),
        firstName: editForm.firstName.trim() || null,
        lastName: editForm.lastName.trim() || null,
        phone: editForm.phone.trim() || null,
        company: editForm.company.trim() || null,
        status: editForm.status,
        tags: tagList,
        listIds: editForm.selectedLists,
      },
    });
  };

  // Delete Single Contact
  const deleteContactMutation = useMutation({
    mutationFn: (id: string) => api.deleteContact(id),
    onSuccess: () => {
      refreshAll();
      setIsDeleteModalOpen(false);
      setContactToDelete(null);
      setSelectedIds((prev) => prev.filter((id) => id !== contactToDelete?.id));
      setToastMessage({ type: "success", text: "Contact deleted successfully" });
    },
    onError: (err: any) => {
      setToastMessage({ type: "error", text: err.message || "Failed to delete contact" });
    },
  });

  // Bulk Delete Contacts
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.bulkDeleteContacts(ids),
    onSuccess: (data) => {
      refreshAll();
      setIsBulkDeleteModalOpen(false);
      setSelectedIds([]);
      setToastMessage({
        type: "success",
        text: `Successfully deleted ${data.count} contact(s)`,
      });
    },
    onError: (err: any) => {
      setToastMessage({ type: "error", text: err.message || "Bulk delete failed" });
    },
  });

  // Create List Mutation
  const createListMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      api.createContactList(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-lists"] });
      queryClient.invalidateQueries({ queryKey: ["contact-stats"] });
      setIsListModalOpen(false);
      setNewListName("");
      setNewListDesc("");
      setToastMessage({ type: "success", text: "List created successfully" });
    },
    onError: (err: any) => {
      setToastMessage({ type: "error", text: err.message || "Failed to create list" });
    },
  });

  // Selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = contactsList.map((c) => c.id);
      setSelectedIds(Array.from(new Set([...selectedIds, ...allIds])));
    } else {
      const pageIds = new Set(contactsList.map((c) => c.id));
      setSelectedIds(selectedIds.filter((id) => !pageIds.has(id)));
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isAllPageSelected =
    contactsList.length > 0 &&
    contactsList.every((c) => selectedIds.includes(c.id));

  // CSV Import Wizard State
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [importMode, setImportMode] = useState<"file" | "paste">("file");
  const [csvFileName, setCsvFileName] = useState("contacts.csv");
  const [rawCsvText, setRawCsvText] = useState("");
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<{
    email: number;
    firstName: number;
    lastName: number;
    phone: number;
    company: number;
    tags: number;
  }>({
    email: -1,
    firstName: -1,
    lastName: -1,
    phone: -1,
    company: -1,
    tags: -1,
  });
  const [importSelectedLists] = useState<string[]>([]);
  const [importCustomTags, setImportCustomTags] = useState("");
  const [importResult, setImportResult] = useState<{
    jobId: string;
    totalRows: number;
    importedRows: number;
    skippedRows: number;
    failedRows: number;
    status: string;
    errors: Array<{ row: number; email?: string; error: string }>;
  } | null>(null);

  const importMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.importContacts>[0]) =>
      api.importContacts(data),
    onSuccess: (data) => {
      refreshAll();
      setImportResult(data);
      setImportStep(3);
    },
    onError: (err: any) => {
      setToastMessage({ type: "error", text: err.message || "Import failed" });
    },
  });

  const handleProcessCsv = (text: string, filename = "contacts.csv") => {
    const { headers, rows } = parseCSV(text);
    if (headers.length === 0 || rows.length === 0) {
      setToastMessage({
        type: "error",
        text: "Could not parse CSV: file must contain header and at least one row.",
      });
      return;
    }

    setCsvFileName(filename);
    setParsedHeaders(headers);
    setParsedRows(rows);

    // Auto-detect mappings
    const mapping = {
      email: -1,
      firstName: -1,
      lastName: -1,
      phone: -1,
      company: -1,
      tags: -1,
    };

    headers.forEach((h, index) => {
      const lower = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (lower.includes("email") || lower === "mail") mapping.email = index;
      else if (lower.includes("firstname") || lower === "first" || lower === "fname")
        mapping.firstName = index;
      else if (lower.includes("lastname") || lower === "last" || lower === "lname")
        mapping.lastName = index;
      else if (lower.includes("phone") || lower.includes("mobile") || lower.includes("tel"))
        mapping.phone = index;
      else if (lower.includes("company") || lower.includes("organization") || lower.includes("org"))
        mapping.company = index;
      else if (lower.includes("tag") || lower.includes("group"))
        mapping.tags = index;
    });

    // Fallback if no email detected, take first column
    if (mapping.email === -1 && headers.length > 0) {
      mapping.email = 0;
    }

    setColumnMapping(mapping);
    setImportStep(2);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleProcessCsv(content, file.name);
    };
    reader.readAsText(file);
  };

  const handleStartImport = () => {
    if (columnMapping.email === -1) {
      setToastMessage({ type: "error", text: "Please map the Email Address column." });
      return;
    }

    const rowsToImport = parsedRows.map((row) => {
      const email = row[columnMapping.email] || "";
      const firstName = columnMapping.firstName >= 0 ? row[columnMapping.firstName] : undefined;
      const lastName = columnMapping.lastName >= 0 ? row[columnMapping.lastName] : undefined;
      const phone = columnMapping.phone >= 0 ? row[columnMapping.phone] : undefined;
      const company = columnMapping.company >= 0 ? row[columnMapping.company] : undefined;
      let tags: string[] | undefined = undefined;
      if (columnMapping.tags >= 0 && row[columnMapping.tags]) {
        tags = row[columnMapping.tags]
          .split(/[,;|]/)
          .map((t) => t.trim())
          .filter(Boolean);
      }

      return {
        email,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        phone: phone || undefined,
        company: company || undefined,
        tags,
      };
    });

    const extraTags = importCustomTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    importMutation.mutate({
      fileName: csvFileName,
      rows: rowsToImport,
      tags: extraTags.length > 0 ? extraTags : undefined,
      listIds: importSelectedLists.length > 0 ? importSelectedLists : undefined,
    });
  };

  const resetImportWizard = () => {
    setImportStep(1);
    setImportMode("file");
    setRawCsvText("");
    setParsedHeaders([]);
    setParsedRows([]);
    setImportResult(null);
    setImportCustomTags("");
    setIsImportModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Toast Banner */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-3 shadow-lg text-xs font-medium border animate-in slide-in-from-top-2 duration-200 ${
            toastMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-600" />
          )}
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 hover:opacity-70"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title="Contacts & Audiences"
        description="Manage your subscriber lists, segments, and contact properties with strict workspace isolation."
        badge={
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
            {stats ? stats.total.toLocaleString() : totalContacts} Total
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setIsListModalOpen(true)}
              className="border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5 text-xs h-9 px-3.5"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              New List
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setImportStep(1);
                setIsImportModalOpen(true);
              }}
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

      {/* Audience Overview Real Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-slate-200/80 bg-white shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Contacts
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {stats ? stats.total.toLocaleString() : "..."}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Across {stats?.listCount ?? 0} lists & {stats?.tagCount ?? 0} tags
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/80 bg-white shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Active Subscribers
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1 text-emerald-600">
            {stats ? stats.active.toLocaleString() : "..."}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {stats && stats.total > 0
              ? `${Math.round((stats.active / stats.total) * 100)}% deliverable`
              : "Ready for campaigns"}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/80 bg-white shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Unsubscribed
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1 text-slate-700">
            {stats ? stats.unsubscribed.toLocaleString() : "..."}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Opt-out status preserved
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/80 bg-white shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Bounced
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1 text-rose-600">
            {stats ? stats.bounced.toLocaleString() : "..."}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Suppressed automatically
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Status Tabs */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-xs shrink-0">
            {[
              { id: "all", label: "All Contacts" },
              { id: "ACTIVE", label: "Active" },
              { id: "UNSUBSCRIBED", label: "Unsubscribed" },
              { id: "BOUNCED", label: "Bounced" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.id);
                  setPage(1);
                }}
                className={`rounded-md px-3 py-1 font-medium transition-colors ${
                  statusFilter === tab.id
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* List & Tag Filters + Search */}
          <div className="flex flex-wrap items-center gap-2">
            {/* List Filter */}
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">
              <FolderPlus className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={listFilter}
                onChange={(e) => {
                  setListFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by list"
                className="bg-transparent border-none text-xs focus:outline-none cursor-pointer pr-2"
              >
                <option value="all">All Lists</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.memberCount ?? 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Tag Filter */}
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">
              <Tag className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={tagFilter}
                onChange={(e) => {
                  setTagFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by tag"
                className="bg-transparent border-none text-xs focus:outline-none cursor-pointer pr-2"
              >
                <option value="all">All Tags</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.count ?? 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="w-full sm:w-60">
              <SearchInput
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery("")}
                placeholder="Search email, name..."
              />
            </div>
          </div>
        </div>

        {/* Bulk Selection Bar */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between rounded-xl bg-indigo-50 border border-indigo-200/80 px-4 py-2.5 text-xs text-indigo-900 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 font-medium">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white font-bold">
                {selectedIds.length}
              </span>
              <span>contact(s) selected across current view</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedIds([])}
                className="h-7 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-100/60"
              >
                Deselect
              </Button>
              <Button
                size="sm"
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="h-7 text-xs bg-rose-600 hover:bg-rose-700 text-white gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Selected
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Contacts Table */}
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        {isLoadingContacts ? (
          <div className="p-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            <span>Loading contacts...</span>
          </div>
        ) : contactsList.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Users}
              title="No contacts found"
              description={
                searchQuery || statusFilter !== "all" || listFilter !== "all" || tagFilter !== "all"
                  ? "No contacts matched your search and filter criteria. Try resetting filters."
                  : "Your active workspace doesn't have any contacts yet. Import existing subscribers from a CSV or add your first contact manually."
              }
              actionLabel="Add Contact"
              onAction={() => setIsAddModalOpen(true)}
              secondaryActionLabel="Import CSV File"
              onSecondaryAction={() => {
                setImportStep(1);
                setIsImportModalOpen(true);
              }}
            />
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-semibold text-slate-600">
                  <tr>
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={isAllPageSelected}
                        onChange={handleSelectAll}
                        aria-label="Select all contacts on page"
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Tags & Lists</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contactsList.map((contact) => {
                    const isSelected = selectedIds.includes(contact.id);
                    const tagItems = (contact.tags || []).map((t) =>
                      typeof t === "string" ? { name: t, color: "#4f46e5" } : t
                    );
                    const listItems = contact.lists || [];

                    return (
                      <tr
                        key={contact.id}
                        className={`hover:bg-slate-50/70 transition-colors ${
                          isSelected ? "bg-indigo-50/40" : ""
                        }`}
                      >
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectOne(contact.id)}
                            aria-label={`Select contact ${contact.email}`}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">
                            {contact.email}
                          </div>
                          {(contact.firstName || contact.lastName) && (
                            <div className="text-slate-500 text-[11px]">
                              {[contact.firstName, contact.lastName].filter(Boolean).join(" ")}
                              {contact.company && ` • ${contact.company}`}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={contact.status} />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {tagItems.map((tag, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 border border-slate-200/70"
                              >
                                {tag.name}
                              </span>
                            ))}
                            {listItems.map((l, idx) => (
                              <span
                                key={`list-${idx}`}
                                className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 border border-indigo-200/60"
                              >
                                {l.name}
                              </span>
                            ))}
                            {tagItems.length === 0 && listItems.length === 0 && (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {new Date(contact.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(contact)}
                              className="rounded p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
                              title="Edit Contact"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setContactToDelete(contact);
                                setIsDeleteModalOpen(true);
                              }}
                              className="rounded p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors"
                              title="Delete Contact"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="flex items-center justify-between border-t border-slate-200/80 px-4 py-3 bg-slate-50/50 text-xs text-slate-600">
              <div>
                Showing{" "}
                <span className="font-semibold text-slate-900">
                  {totalContacts === 0 ? 0 : (page - 1) * limit + 1}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-slate-900">
                  {Math.min(page * limit, totalContacts)}
                </span>{" "}
                of <span className="font-semibold text-slate-900">{totalContacts}</span> contacts
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-7 text-xs border-slate-200"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  Previous
                </Button>
                <span className="text-xs font-medium text-slate-700">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-7 text-xs border-slate-200"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

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

            {addError && (
              <div className="mt-3 rounded-lg bg-rose-50 p-2.5 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="subscriber@example.com"
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={addForm.firstName}
                    onChange={(e) => setAddForm({ ...addForm, firstName: e.target.value })}
                    placeholder="Jane"
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={addForm.lastName}
                    onChange={(e) => setAddForm({ ...addForm, lastName: e.target.value })}
                    placeholder="Doe"
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    placeholder="+1 555-0100"
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Company
                  </label>
                  <input
                    type="text"
                    value={addForm.company}
                    onChange={(e) => setAddForm({ ...addForm, company: e.target.value })}
                    placeholder="Acme Inc"
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={addForm.status}
                  onChange={(e) =>
                    setAddForm({ ...addForm, status: e.target.value as ContactStatus })
                  }
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="UNSUBSCRIBED">UNSUBSCRIBED</option>
                  <option value="BOUNCED">BOUNCED</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={addForm.tags}
                  onChange={(e) => setAddForm({ ...addForm, tags: e.target.value })}
                  placeholder="VIP, Early Adopter, Lead"
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              {lists.length > 0 && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Assign to Lists
                  </label>
                  <div className="max-h-24 overflow-y-auto space-y-1.5 p-2 rounded-lg border border-slate-200 bg-slate-50/50">
                    {lists.map((l) => (
                      <label key={l.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={addForm.selectedLists.includes(l.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAddForm({
                                ...addForm,
                                selectedLists: [...addForm.selectedLists, l.id],
                              });
                            } else {
                              setAddForm({
                                ...addForm,
                                selectedLists: addForm.selectedLists.filter(
                                  (id) => id !== l.id
                                ),
                              });
                            }
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs text-slate-700">{l.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

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
                  disabled={createContactMutation.isPending}
                  className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                >
                  {createContactMutation.isPending && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Save Contact
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Contact Modal */}
      {isEditModalOpen && editingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Edit Contact</h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {editError && (
              <div className="mt-3 rounded-lg bg-rose-50 p-2.5 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Company
                  </label>
                  <input
                    type="text"
                    value={editForm.company}
                    onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm({ ...editForm, status: e.target.value as ContactStatus })
                  }
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="UNSUBSCRIBED">UNSUBSCRIBED</option>
                  <option value="BOUNCED">BOUNCED</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={editForm.tags}
                  onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                  placeholder="VIP, Beta Tester"
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              {lists.length > 0 && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Assign to Lists
                  </label>
                  <div className="max-h-24 overflow-y-auto space-y-1.5 p-2 rounded-lg border border-slate-200 bg-slate-50/50">
                    {lists.map((l) => (
                      <label key={l.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editForm.selectedLists.includes(l.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditForm({
                                ...editForm,
                                selectedLists: [...editForm.selectedLists, l.id],
                              });
                            } else {
                              setEditForm({
                                ...editForm,
                                selectedLists: editForm.selectedLists.filter(
                                  (id) => id !== l.id
                                ),
                              });
                            }
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs text-slate-700">{l.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                  className="h-8 px-3 text-xs border-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateContactMutation.isPending}
                  className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                >
                  {updateContactMutation.isPending && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Single Contact Confirmation Modal */}
      {isDeleteModalOpen && contactToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Delete Contact</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-600">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-slate-900">{contactToDelete.email}</span>?
              All tag and list associations for this contact will also be removed.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteModalOpen(false)}
                className="text-xs border-slate-200"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={deleteContactMutation.isPending}
                onClick={() => deleteContactMutation.mutate(contactToDelete.id)}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1.5"
              >
                {deleteContactMutation.isPending && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Bulk Delete Contacts</h3>
                <p className="text-xs text-slate-500">Permanent deletion</p>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-600">
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-slate-900">{selectedIds.length}</span>{" "}
              selected contact(s) from this workspace?
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="text-xs border-slate-200"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={bulkDeleteMutation.isPending}
                onClick={() => bulkDeleteMutation.mutate(selectedIds)}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1.5"
              >
                {bulkDeleteMutation.isPending && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                Delete {selectedIds.length} Contacts
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create List Modal */}
      {isListModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Create Contact List</h3>
              <button
                type="button"
                onClick={() => setIsListModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newListName.trim()) return;
                createListMutation.mutate({
                  name: newListName.trim(),
                  description: newListDesc.trim() || undefined,
                });
              }}
              className="mt-4 space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  List Name *
                </label>
                <input
                  type="text"
                  required
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g. VIP Customers, Newsletter"
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newListDesc}
                  onChange={(e) => setNewListDesc(e.target.value)}
                  placeholder="Optional list description"
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsListModalOpen(false)}
                  className="h-8 px-3 text-xs border-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createListMutation.isPending}
                  className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {createListMutation.isPending ? "Creating..." : "Create List"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3-Step CSV Import Wizard Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Import Audience CSV
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Step {importStep} of 3 •{" "}
                    {importStep === 1
                      ? "Select File or Paste"
                      : importStep === 2
                      ? "Map Columns & Settings"
                      : "Import Results Summary"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetImportWizard}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Step 1: Upload or Paste */}
            {importStep === 1 && (
              <div className="mt-4 space-y-4 text-xs">
                {/* Tabs */}
                <div className="flex border-b border-slate-200">
                  <button
                    type="button"
                    onClick={() => setImportMode("file")}
                    className={`pb-2 px-3 text-xs font-medium border-b-2 transition-colors ${
                      importMode === "file"
                        ? "border-indigo-600 text-indigo-600 font-semibold"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Upload CSV File
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode("paste")}
                    className={`pb-2 px-3 text-xs font-medium border-b-2 transition-colors ${
                      importMode === "paste"
                        ? "border-indigo-600 text-indigo-600 font-semibold"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Paste Raw CSV
                  </button>
                </div>

                {importMode === "file" ? (
                  <label className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer flex flex-col items-center justify-center">
                    <Upload className="h-8 w-8 text-slate-400 mb-2" />
                    <p className="font-semibold text-slate-800 text-xs">
                      Click to choose or drop a CSV file
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Supports: email, first_name, last_name, phone, company, tags
                    </p>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-slate-700 font-medium text-xs">
                      Paste CSV content (first line should contain headers):
                    </label>
                    <textarea
                      rows={6}
                      value={rawCsvText}
                      onChange={(e) => setRawCsvText(e.target.value)}
                      placeholder="email,first_name,last_name&#10;user1@domain.com,Alice,Smith&#10;user2@domain.com,Bob,Jones"
                      className="w-full rounded-lg border border-slate-200 p-2.5 font-mono text-xs focus:outline-none focus:border-indigo-500"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        disabled={!rawCsvText.trim()}
                        onClick={() => handleProcessCsv(rawCsvText, "pasted-contacts.csv")}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1"
                      >
                        Parse & Next <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                <div className="rounded-lg bg-amber-50 p-3 border border-amber-200/80 text-[11px] text-amber-800">
                  <span className="font-semibold">Unsubscribe Protection:</span> Any contact
                  previously marked as UNSUBSCRIBED will retain their opt-out status and will not
                  be reactivated.
                </div>
              </div>
            )}

            {/* Step 2: Column Mapping & Preview */}
            {importStep === 2 && (
              <div className="mt-4 space-y-4 text-xs">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>
                    Detected <span className="font-semibold">{parsedRows.length}</span> rows in{" "}
                    <span className="font-mono text-slate-800">{csvFileName}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setImportStep(1)}
                    className="text-indigo-600 hover:underline"
                  >
                    Change file
                  </button>
                </div>

                {/* Column Mappers Grid */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Email Address * (Required)
                    </label>
                    <select
                      value={columnMapping.email}
                      onChange={(e) =>
                        setColumnMapping({
                          ...columnMapping,
                          email: parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full h-8 rounded-md border border-slate-200 bg-white px-2 text-xs focus:outline-none"
                    >
                      <option value={-1}>-- Select Email Column --</option>
                      {parsedHeaders.map((h, i) => (
                        <option key={i} value={i}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      First Name
                    </label>
                    <select
                      value={columnMapping.firstName}
                      onChange={(e) =>
                        setColumnMapping({
                          ...columnMapping,
                          firstName: parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full h-8 rounded-md border border-slate-200 bg-white px-2 text-xs focus:outline-none"
                    >
                      <option value={-1}>-- Ignore --</option>
                      {parsedHeaders.map((h, i) => (
                        <option key={i} value={i}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Last Name
                    </label>
                    <select
                      value={columnMapping.lastName}
                      onChange={(e) =>
                        setColumnMapping({
                          ...columnMapping,
                          lastName: parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full h-8 rounded-md border border-slate-200 bg-white px-2 text-xs focus:outline-none"
                    >
                      <option value={-1}>-- Ignore --</option>
                      {parsedHeaders.map((h, i) => (
                        <option key={i} value={i}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Phone Number
                    </label>
                    <select
                      value={columnMapping.phone}
                      onChange={(e) =>
                        setColumnMapping({
                          ...columnMapping,
                          phone: parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full h-8 rounded-md border border-slate-200 bg-white px-2 text-xs focus:outline-none"
                    >
                      <option value={-1}>-- Ignore --</option>
                      {parsedHeaders.map((h, i) => (
                        <option key={i} value={i}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Company
                    </label>
                    <select
                      value={columnMapping.company}
                      onChange={(e) =>
                        setColumnMapping({
                          ...columnMapping,
                          company: parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full h-8 rounded-md border border-slate-200 bg-white px-2 text-xs focus:outline-none"
                    >
                      <option value={-1}>-- Ignore --</option>
                      {parsedHeaders.map((h, i) => (
                        <option key={i} value={i}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Tags Column
                    </label>
                    <select
                      value={columnMapping.tags}
                      onChange={(e) =>
                        setColumnMapping({
                          ...columnMapping,
                          tags: parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full h-8 rounded-md border border-slate-200 bg-white px-2 text-xs focus:outline-none"
                    >
                      <option value={-1}>-- Ignore --</option>
                      {parsedHeaders.map((h, i) => (
                        <option key={i} value={i}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Additional Settings */}
                <div className="space-y-2">
                  <label className="block font-semibold text-slate-700 text-xs">
                    Apply Global Tags to this Import (optional)
                  </label>
                  <input
                    type="text"
                    value={importCustomTags}
                    onChange={(e) => setImportCustomTags(e.target.value)}
                    placeholder="e.g. CSV Import May 2026, Q2 Leads"
                    className="w-full h-8 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Data Preview Table (First 3 rows) */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 mb-1">
                    Preview (First {Math.min(3, parsedRows.length)} rows)
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-200 text-[11px]">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          {parsedHeaders.map((h, i) => (
                            <th key={i} className="py-1.5 px-2">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedRows.slice(0, 3).map((r, ri) => (
                          <tr key={ri}>
                            {r.map((cell, ci) => (
                              <td key={ci} className="py-1.5 px-2 text-slate-700 truncate max-w-[120px]">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setImportStep(1)}
                    className="h-8 px-3 text-xs border-slate-200"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    disabled={importMutation.isPending || columnMapping.email === -1}
                    onClick={handleStartImport}
                    className="h-8 px-4 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                  >
                    {importMutation.isPending && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    Start Batch Ingestion
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Import Results Summary */}
            {importStep === 3 && importResult && (
              <div className="mt-4 space-y-4 text-xs">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                  <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <span>Import Completed</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mt-4 text-center">
                    <div className="rounded-lg bg-white p-2.5 border border-slate-200/80">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Total</div>
                      <div className="text-base font-bold text-slate-900 mt-0.5">
                        {importResult.totalRows}
                      </div>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-2.5 border border-emerald-200">
                      <div className="text-[10px] text-emerald-700 uppercase font-semibold">Imported</div>
                      <div className="text-base font-bold text-emerald-700 mt-0.5">
                        {importResult.importedRows}
                      </div>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-2.5 border border-amber-200">
                      <div className="text-[10px] text-amber-700 uppercase font-semibold">Skipped</div>
                      <div className="text-base font-bold text-amber-700 mt-0.5">
                        {importResult.skippedRows}
                      </div>
                    </div>
                    <div className="rounded-lg bg-rose-50 p-2.5 border border-rose-200">
                      <div className="text-[10px] text-rose-700 uppercase font-semibold">Failed</div>
                      <div className="text-base font-bold text-rose-700 mt-0.5">
                        {importResult.failedRows}
                      </div>
                    </div>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-slate-700 mb-1">
                      Audit Log & Skipped Details ({importResult.errors.length}):
                    </div>
                    <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 p-2 space-y-1 bg-slate-50 text-[11px] text-slate-600">
                      {importResult.errors.map((err, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <span className="font-semibold text-slate-800">Row {err.row}:</span>
                          <span>{err.email ? `(${err.email}) ` : ""}{err.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                  <Button
                    type="button"
                    onClick={resetImportWizard}
                    className="h-8 px-4 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    Done & View Contacts
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
