import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Plus,
  Eye,
  Edit2,
  Copy,
  Trash2,
  Code,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Save,
  Loader2,
  X,
  Layers,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState, SearchInput } from "@/components/common";
import type { EmailTemplate, TemplateCategory, TemplateStatus } from "@/types";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/features/auth/use-auth-store";
import { formatDate } from "@/lib/utils";
import {
  VisualEditor,
  HtmlEditor,
  PreviewModal,
  EditorDocument,
  compileBlocksToHTML,
  STARTER_TEMPLATES,
  getStarterHTML,
} from "@/features/templates";

interface TemplatesPageProps {
  onUseInCampaign?: (template: EmailTemplate) => void;
  hideHeader?: boolean;
}

export function TemplatesPage({ onUseInCampaign, hideHeader }: TemplatesPageProps = {}) {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useAuthStore();

  // Mode: "library" (list/grid) or "editor" (studio mode)
  const [viewMode, setViewMode] = useState<"library" | "editor">("library");

  // Library State
  const [page, setPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);

  // New Template Form
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDesc, setNewTemplateDesc] = useState("");
  const [newTemplateCategory, setNewTemplateCategory] = useState<TemplateCategory>("MARKETING");
  const [selectedStarterIdx, setSelectedStarterIdx] = useState<number>(0);

  // Active Editor State
  const [activeTemplate, setActiveTemplate] = useState<EmailTemplate | null>(null);
  const [editorMode, setEditorMode] = useState<"visual" | "html">("visual");
  const [editorSubject, setEditorSubject] = useState("");
  const [editorPreheader, setEditorPreheader] = useState("");
  const [editorName, setEditorName] = useState("");
  const [editorCategory, setEditorCategory] = useState<TemplateCategory>("MARKETING");
  const [editorStatus, setEditorStatus] = useState<TemplateStatus>("DRAFT");
  const [rawHtml, setRawHtml] = useState("");
  const [editorDoc, setEditorDoc] = useState<EditorDocument>({
    blocks: [],
    settings: {
      contentWidth: 600,
      backgroundColor: "#f8fafc",
      cardColor: "#ffffff",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Clear toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Fetch Templates
  const { data: templatesData, isLoading } = useQuery({
    queryKey: [
      "templates",
      activeWorkspace?.id,
      selectedCategory,
      selectedStatus,
      debouncedSearch,
      page,
    ],
    queryFn: () =>
      api.getTemplates({
        page,
        limit: 18,
        search: debouncedSearch || undefined,
        category: selectedCategory !== "all" ? selectedCategory : undefined,
        status: selectedStatus !== "all" ? selectedStatus : undefined,
      }),
    enabled: !!activeWorkspace?.id,
  });

  const templates = templatesData?.templates || [];
  const totalTemplates = templatesData?.total || 0;

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.createTemplate>[0]) =>
      api.createTemplate(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setIsNewModalOpen(false);
      setToastMessage({ type: "success", text: "Template created successfully" });
      openEditor(data.template);
    },
    onError: (err: any) => {
      setToastMessage({ type: "error", text: err.message || "Failed to create template" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.updateTemplate(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setActiveTemplate(data.template);
      setToastMessage({ type: "success", text: "Template saved successfully" });
    },
    onError: (err: any) => {
      setToastMessage({ type: "error", text: err.message || "Failed to save template" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => api.duplicateTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setToastMessage({ type: "success", text: "Template duplicated as a draft" });
    },
    onError: (err: any) => {
      setToastMessage({ type: "error", text: err.message || "Failed to duplicate template" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setIsDeleteModalOpen(false);
      setTemplateToDelete(null);
      setToastMessage({ type: "success", text: "Template deleted" });
    },
    onError: (err: any) => {
      setToastMessage({ type: "error", text: err.message || "Failed to delete template" });
    },
  });

  // Open Studio Editor for a template
  const openEditor = (tpl: EmailTemplate) => {
    setActiveTemplate(tpl);
    setEditorName(tpl.name);
    setEditorCategory(tpl.category);
    setEditorStatus(tpl.status);
    setEditorSubject(tpl.subject || "");
    setEditorPreheader(tpl.preheader || "");
    setRawHtml(tpl.htmlContent);

    if (tpl.editorContent && tpl.editorContent.blocks) {
      setEditorDoc(tpl.editorContent as EditorDocument);
      setEditorMode("visual");
    } else {
      // Default initial blocks if none existed
      const starter = STARTER_TEMPLATES[0];
      setEditorDoc(starter.document);
      setEditorMode(tpl.htmlContent ? "html" : "visual");
    }

    setViewMode("editor");
  };

  // Handle Save in Studio Editor
  const handleSaveEditor = () => {
    if (!activeTemplate) return;

    let finalHtml = rawHtml;

    if (editorMode === "visual") {
      finalHtml = compileBlocksToHTML(editorDoc, {
        subject: editorSubject,
        preheader: editorPreheader,
      });
      setRawHtml(finalHtml);
    }

    saveMutation.mutate({
      id: activeTemplate.id,
      data: {
        name: editorName.trim() || activeTemplate.name,
        category: editorCategory,
        status: editorStatus,
        subject: editorSubject.trim() || null,
        preheader: editorPreheader.trim() || null,
        htmlContent: finalHtml,
        editorContent: editorDoc,
      },
    });
  };

  // Handle Create Template Submit
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim()) return;

    let initialHtml = "";
    let initialDoc: any = null;

    if (selectedStarterIdx >= 0 && STARTER_TEMPLATES[selectedStarterIdx]) {
      const chosen = STARTER_TEMPLATES[selectedStarterIdx];
      initialDoc = chosen.document;
      initialHtml = getStarterHTML(chosen);
    } else {
      const starter = STARTER_TEMPLATES[0];
      initialDoc = starter.document;
      initialHtml = getStarterHTML(starter);
    }

    createMutation.mutate({
      name: newTemplateName.trim(),
      description: newTemplateDesc.trim() || undefined,
      category: newTemplateCategory,
      subject:
        selectedStarterIdx >= 0
          ? STARTER_TEMPLATES[selectedStarterIdx]?.subject
          : undefined,
      preheader:
        selectedStarterIdx >= 0
          ? STARTER_TEMPLATES[selectedStarterIdx]?.preheader
          : undefined,
      htmlContent: initialHtml,
      editorContent: initialDoc,
      status: "DRAFT",
    });
  };

  // Variable insertion into active subject/preheader
  const insertVariableIntoHeader = (variableTag: string) => {
    setEditorSubject((prev) => `${prev} ${variableTag}`);
    setToastMessage({ type: "success", text: `Inserted ${variableTag} into subject` });
  };

  // Switch between Visual and HTML Mode safely
  const handleSwitchMode = (targetMode: "visual" | "html") => {
    if (targetMode === editorMode) return;

    if (targetMode === "html") {
      // Compile visual blocks to HTML before switching to HTML editor
      const compiled = compileBlocksToHTML(editorDoc, {
        subject: editorSubject,
        preheader: editorPreheader,
      });
      setRawHtml(compiled);
      setEditorMode("html");
    } else {
      // Switching from HTML to Visual
      setEditorMode("visual");
    }
  };

  // =========================================================================
  // RENDER: STUDIO EDITOR VIEW
  // =========================================================================
  if (viewMode === "editor" && activeTemplate) {
    return (
      <div className="space-y-4">
        {/* Toast Alert */}
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
          </div>
        )}

        {/* Studio Top Control Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-xs">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setViewMode("library");
                setActiveTemplate(null);
              }}
              className="h-8 text-xs text-slate-600 border-slate-200 gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Templates
            </Button>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            <input
              type="text"
              value={editorName}
              onChange={(e) => setEditorName(e.target.value)}
              placeholder="Template Name"
              className="text-sm font-semibold text-slate-900 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Category Selector */}
            <select
              value={editorCategory}
              onChange={(e) => setEditorCategory(e.target.value as TemplateCategory)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-indigo-500"
            >
              <option value="MARKETING">Marketing</option>
              <option value="NEWSLETTER">Newsletter</option>
              <option value="TRANSACTIONAL">Transactional</option>
              <option value="WELCOME">Welcome</option>
              <option value="PROMOTIONAL">Promotional</option>
              <option value="CUSTOM">Custom</option>
            </select>

            {/* Status Selector */}
            <select
              value={editorStatus}
              onChange={(e) => setEditorStatus(e.target.value as TemplateStatus)}
              className={`h-8 rounded-lg border px-2.5 text-xs font-semibold focus:outline-none ${
                editorStatus.toUpperCase() === "READY"
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                  : "bg-amber-50 border-amber-300 text-amber-700"
              }`}
            >
              <option value="DRAFT">DRAFT</option>
              <option value="READY">READY</option>
            </select>

            {/* Visual vs HTML Mode Switcher */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => handleSwitchMode("visual")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-colors ${
                  editorMode === "visual"
                    ? "bg-white text-indigo-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                Visual
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMode("html")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-colors ${
                  editorMode === "html"
                    ? "bg-white text-indigo-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Code className="h-3.5 w-3.5" />
                HTML
              </button>
            </div>

            {/* Preview Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPreviewTemplate({
                  ...activeTemplate,
                  name: editorName,
                  subject: editorSubject,
                  preheader: editorPreheader,
                  htmlContent:
                    editorMode === "visual"
                      ? compileBlocksToHTML(editorDoc, {
                          subject: editorSubject,
                          preheader: editorPreheader,
                        })
                      : rawHtml,
                  category: editorCategory,
                  status: editorStatus,
                })
              }
              className="h-8 text-xs border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5"
            >
              <Eye className="h-3.5 w-3.5 text-indigo-600" />
              Preview
            </Button>

            {/* Save Button */}
            <Button
              size="sm"
              disabled={saveMutation.isPending}
              onClick={handleSaveEditor}
              className="h-8 px-4 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save Template
            </Button>
          </div>
        </div>

        {/* Email Meta Info Bar (Subject & Preheader) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 rounded-xl border border-slate-200/80 bg-white text-xs">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700">Subject Line</label>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400">Insert:</span>
                {["{{first_name}}", "{{company}}"].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariableIntoHeader(v)}
                    className="text-[10px] text-indigo-600 hover:underline font-mono"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={editorSubject}
              onChange={(e) => setEditorSubject(e.target.value)}
              placeholder="e.g. Welcome to {{company}}, {{first_name}}!"
              className="w-full h-8 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Preheader Text (Snippet shown next to subject in inbox)
            </label>
            <input
              type="text"
              value={editorPreheader}
              onChange={(e) => setEditorPreheader(e.target.value)}
              placeholder="e.g. Here are 3 steps to get started immediately..."
              className="w-full h-8 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Editor Body: Visual or HTML */}
        {editorMode === "visual" ? (
          <VisualEditor
            document={editorDoc}
            onChange={(newDoc) => setEditorDoc(newDoc)}
            onInsertVariable={(v) => insertVariableIntoHeader(v)}
          />
        ) : (
          <HtmlEditor
            html={rawHtml}
            onChange={(newHtml) => setRawHtml(newHtml)}
            onInsertVariable={(v) => insertVariableIntoHeader(v)}
          />
        )}

        {/* Interactive Preview Modal */}
        {previewTemplate && (
          <PreviewModal
            isOpen={!!previewTemplate}
            onClose={() => setPreviewTemplate(null)}
            html={previewTemplate.htmlContent}
            subject={previewTemplate.subject || undefined}
            preheader={previewTemplate.preheader || undefined}
            templateName={previewTemplate.name}
          />
        )}
      </div>
    );
  }

  // =========================================================================
  // RENDER: TEMPLATE LIBRARY VIEW
  // =========================================================================
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

      {/* Header (conditionally hidden in unified Campaign Studio) */}
      {!hideHeader ? (
        <PageHeader
          title="Email Template Studio"
          description="Design responsive email templates with visual drag-and-drop blocks, raw HTML mode, and dynamic merge tags."
          badge={
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
              {totalTemplates} Templates
            </span>
          }
          actions={
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  setNewTemplateName("");
                  setNewTemplateDesc("");
                  setNewTemplateCategory("MARKETING");
                  setSelectedStarterIdx(0);
                  setIsNewModalOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm gap-1.5 text-xs h-9 px-3.5"
              >
                <Plus className="h-3.5 w-3.5" />
                New Template
              </Button>
            </div>
          }
        />
      ) : (
        <div className="flex items-center justify-between pb-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Template Library</h3>
            <p className="text-xs text-slate-500">Pick from existing designs or start with a pre-built starter.</p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setNewTemplateName("");
              setNewTemplateDesc("");
              setNewTemplateCategory("MARKETING");
              setSelectedStarterIdx(0);
              setIsNewModalOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm gap-1.5 text-xs h-8 px-3"
          >
            <Plus className="h-3.5 w-3.5" />
            New Template
          </Button>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Category Pills */}
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-xs overflow-x-auto no-scrollbar shrink-0">
          {[
            { id: "all", label: "All Categories" },
            { id: "MARKETING", label: "Marketing" },
            { id: "NEWSLETTER", label: "Newsletter" },
            { id: "TRANSACTIONAL", label: "Transactional" },
            { id: "WELCOME", label: "Welcome" },
            { id: "PROMOTIONAL", label: "Promotional" },
            { id: "CUSTOM", label: "Custom" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setSelectedCategory(cat.id);
                setPage(1);
              }}
              className={`rounded-md px-3 py-1 font-medium transition-colors whitespace-nowrap ${
                selectedCategory.toUpperCase() === cat.id
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Status Filter & Search */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">
            <span className="text-slate-400">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="bg-transparent border-none text-xs focus:outline-none cursor-pointer pr-1 font-medium"
            >
              <option value="all">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="READY">Ready</option>
            </select>
          </div>

          <div className="w-full sm:w-60">
            <SearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery("")}
              placeholder="Search templates..."
            />
          </div>
        </div>
      </div>

      {/* Template Grid or Empty State */}
      {isLoading ? (
        <div className="p-16 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          <span>Loading templates from active workspace...</span>
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No email templates found"
          description={
            searchQuery || selectedCategory !== "all" || selectedStatus !== "all"
              ? "No templates match your search or category filter. Try clearing filters."
              : "Your workspace has no templates yet. Create your first responsive template from a starter layout or build from scratch."
          }
          actionLabel="Create First Template"
          onAction={() => {
            setNewTemplateName("My First Email Template");
            setNewTemplateDesc("Initial customer announcement template");
            setNewTemplateCategory("MARKETING");
            setSelectedStarterIdx(0);
            setIsNewModalOpen(true);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.map((tpl) => {
            const isReady = tpl.status.toUpperCase() === "READY";
            const updatedDate = formatDate(tpl.updatedAt);

            return (
              <div
                key={tpl.id}
                className="group rounded-xl border border-slate-200/90 bg-white overflow-hidden shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Visual Header / Wireframe Preview */}
                  <div className="h-32 w-full bg-slate-900 p-4 flex flex-col justify-between relative overflow-hidden group-hover:bg-slate-800 transition-colors">
                    <div className="flex items-center justify-between z-10">
                      <span className="rounded bg-white/10 backdrop-blur-xs px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white border border-white/15">
                        {tpl.category}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          isReady
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                            : "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                        }`}
                      >
                        {tpl.status}
                      </span>
                    </div>

                    {/* Miniature wireframe graphic */}
                    <div className="w-full bg-white/5 backdrop-blur-xs rounded p-2.5 space-y-1.5 border border-white/10">
                      <div className="h-2 w-2/3 bg-white/60 rounded-full" />
                      <div className="h-1.5 w-full bg-white/30 rounded-full" />
                      <div className="h-1.5 w-4/5 bg-white/30 rounded-full" />
                    </div>
                  </div>

                  {/* Template Details */}
                  <div className="p-4 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors text-sm line-clamp-1">
                        {tpl.name}
                      </h3>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {tpl.description || (tpl.subject ? `Subject: ${tpl.subject}` : "No description provided.")}
                    </p>

                    {tpl.subject && (
                      <div className="text-[11px] text-slate-600 font-mono truncate pt-1">
                        Subject: <span className="text-indigo-600">{tpl.subject}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs text-slate-500">
                  <span className="text-[11px]">{updatedDate}</span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewTemplate(tpl)}
                      className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-200/50 transition-colors"
                      title="Preview Template"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => duplicateMutation.mutate(tpl.id)}
                      className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-200/50 transition-colors"
                      title="Duplicate Template"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTemplateToDelete(tpl);
                        setIsDeleteModalOpen(true);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-200/50 transition-colors"
                      title="Delete Template"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {onUseInCampaign && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUseInCampaign(tpl)}
                        className="h-7 px-2.5 text-xs text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 border-indigo-200 font-semibold gap-1 mr-1 shadow-xs"
                      >
                        <Send className="h-3 w-3 text-indigo-600" />
                        Use in Campaign
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditor(tpl)}
                      className="h-7 px-2.5 text-xs text-indigo-600 hover:bg-indigo-50 font-semibold gap-1 ml-1"
                    >
                      <Edit2 className="h-3 w-3" />
                      Edit
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Template Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">
                Create Email Template
              </h3>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  required
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="e.g. Q2 Customer Announcement"
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={newTemplateCategory}
                    onChange={(e) =>
                      setNewTemplateCategory(e.target.value as TemplateCategory)
                    }
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs bg-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="MARKETING">Marketing</option>
                    <option value="NEWSLETTER">Newsletter</option>
                    <option value="TRANSACTIONAL">Transactional</option>
                    <option value="WELCOME">Welcome</option>
                    <option value="PROMOTIONAL">Promotional</option>
                    <option value="CUSTOM">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={newTemplateDesc}
                    onChange={(e) => setNewTemplateDesc(e.target.value)}
                    placeholder="Optional notes or purpose"
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Starter Layout Selector */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Choose a Starting Layout
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {STARTER_TEMPLATES.map((starter, i) => (
                    <button
                      key={starter.name}
                      type="button"
                      onClick={() => setSelectedStarterIdx(i)}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        selectedStarterIdx === i
                          ? "border-indigo-600 bg-indigo-50/50 shadow-xs"
                          : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
                      }`}
                    >
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-600 block mb-0.5">
                          {starter.category}
                        </span>
                        <div className="font-semibold text-slate-900 text-xs line-clamp-1">
                          {starter.name}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-2 line-clamp-2">
                        {starter.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsNewModalOpen(false)}
                  className="h-8 px-3 text-xs border-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || !newTemplateName.trim()}
                  className="h-8 px-4 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                >
                  {createMutation.isPending && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Create & Open Studio
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && templateToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Delete Template
                </h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-600">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-slate-900">
                {templateToDelete.name}
              </span>
              ?
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
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(templateToDelete.id)}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1.5"
              >
                {deleteMutation.isPending && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Preview Modal */}
      {previewTemplate && (
        <PreviewModal
          isOpen={!!previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          html={previewTemplate.htmlContent}
          subject={previewTemplate.subject || undefined}
          preheader={previewTemplate.preheader || undefined}
          templateName={previewTemplate.name}
        />
      )}
    </div>
  );
}
