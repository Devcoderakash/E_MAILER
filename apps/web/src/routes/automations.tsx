import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Workflow,
  Plus,
  Zap,
  ArrowRight,
  GitBranch,
  CheckCircle2,
  Users,
  X,
  Play,
  Pause,
  Trash2,
  Save,
  Clock,
  Mail,
  Tag,
  Layers,
  Activity,
  History,
  AlertCircle,
  Maximize2,
  Minimize2,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PageHeader,
  StatusBadge,
  SearchInput,
} from "@/components/common";
import { nodeTypes } from "@/features/automations/custom-nodes";
import { api } from "@/lib/api-client";
import type {
  Automation,
  WorkflowDefinition,
} from "@/types";

export function AutomationBuilderPage() {
  const queryClient = useQueryClient();

  // Filter & Search State
  const [filterState, setFilterState] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Notifications
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Queries
  const { data: automationsData, isLoading } = useQuery({
    queryKey: ["automations", filterState, debouncedSearch],
    queryFn: () =>
      api.getAutomations({
        status: filterState === "all" ? undefined : filterState,
        search: debouncedSearch || undefined,
      }),
  });

  const automations = automationsData?.items || [];

  // Metrics summary
  const metrics = useMemo(() => {
    const total = automations.length;
    const activeCount = automations.filter((a) => a.status === "ACTIVE").length;
    const totalEnrolled = automations.reduce(
      (acc, a) => acc + (a.totalEnrolled || 0),
      0
    );
    const completedCount = automations.reduce(
      (acc, a) => acc + (a.completedCount || 0),
      0
    );
    return { total, activeCount, totalEnrolled, completedCount };
  }, [automations]);

  // Editor Modal State
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(
    null
  );
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Executions History Drawer State
  const [historyAutomation, setHistoryAutomation] = useState<Automation | null>(
    null
  );
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(
    null
  );

  // Create Automation Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [newWorkflowDesc, setNewWorkflowDesc] = useState("");
  const [newTriggerType, setNewTriggerType] = useState("contact_subscribed");

  // React Flow State for active workflow
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  // AI Workflow Generator State
  const [isAiWorkflowModalOpen, setIsAiWorkflowModalOpen] = useState(false);
  const [aiWorkflowPrompt, setAiWorkflowPrompt] = useState("");
  const [isGeneratingAiWorkflow, setIsGeneratingAiWorkflow] = useState(false);
  const [aiWorkflowError, setAiWorkflowError] = useState<string | null>(null);

  const handleGenerateWorkflowWithAi = async () => {
    if (!aiWorkflowPrompt.trim()) return;
    setIsGeneratingAiWorkflow(true);
    setAiWorkflowError(null);
    try {
      const res = await api.generateWorkflow({ prompt: aiWorkflowPrompt.trim() });
      if (res?.workflow?.nodes) {
        const generatedNodes = res.workflow.nodes.map((n: any) => ({
          id: n.id,
          type: n.type,
          data: { ...n.data, type: n.type },
          position: n.position || { x: 250, y: 100 },
        }));
        const generatedEdges = (res.workflow.edges || []).map((e: any) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle || null,
          targetHandle: e.targetHandle || null,
          label: e.label || (e.sourceHandle === "true" ? "Yes" : e.sourceHandle === "false" ? "No" : undefined),
        }));

        setNodes(generatedNodes);
        setEdges(generatedEdges);
        setSelectedNode(null);
        setIsAiWorkflowModalOpen(false);
        setAiWorkflowPrompt("");
        showToast("AI workflow generated successfully! Previewing on canvas.");
      }
    } catch (err: any) {
      setAiWorkflowError(err.message || "Failed to generate workflow with AI.");
    } finally {
      setIsGeneratingAiWorkflow(false);
    }
  };

  // Open Editor with loaded automation
  const handleOpenEditor = async (auto: Automation) => {
    try {
      const full = await api.getAutomation(auto.id);
      setEditingAutomation(full);
      const def = (full.workflowDefinition || {}) as WorkflowDefinition;
      const initialNodes = (def.nodes || []).map((n) => ({
        id: n.id,
        type: n.type,
        data: { ...n.data, type: n.type },
        position: n.position || { x: 250, y: 100 },
      }));
      const initialEdges = (def.edges || []).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle || null,
        targetHandle: e.targetHandle || null,
        label: e.label || (e.sourceHandle === "true" ? "Yes" : e.sourceHandle === "false" ? "No" : undefined),
      }));

      setNodes(initialNodes);
      setEdges(initialEdges);
      setSelectedNode(null);
      setValidationErrors([]);
      setValidationWarnings([]);
      setIsEditorOpen(true);
    } catch (err: any) {
      showToast(err.message || "Failed to load workflow", "error");
    }
  };

  // Connect Edges
  const onConnect = useCallback(
    (params: Connection) => {
      let label: string | undefined = undefined;
      if (params.sourceHandle === "true") label = "Yes";
      if (params.sourceHandle === "false") label = "No";

      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            label,
            style: { stroke: "#6366F1", strokeWidth: 2 },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      triggerType: string;
    }) => api.createAutomation(data),
    onSuccess: (newAuto) => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      setIsCreateModalOpen(false);
      setNewWorkflowName("");
      setNewWorkflowDesc("");
      showToast(`Created workflow "${newAuto.name}"`);
      handleOpenEditor(newAuto);
    },
    onError: (err: any) => {
      showToast(err.message || "Failed to create workflow", "error");
    },
  });

  const saveWorkflowMutation = useMutation({
    mutationFn: async ({
      id,
      workflowDefinition,
    }: {
      id: string;
      workflowDefinition: WorkflowDefinition;
    }) => api.updateAutomation(id, { workflowDefinition }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      setEditingAutomation(updated);
      showToast("Workflow definition saved successfully.");
    },
    onError: (err: any) => {
      showToast(err.message || "Failed to save workflow", "error");
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => api.activateAutomation(id),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      if (editingAutomation?.id === updated.id) {
        setEditingAutomation(updated);
      }
      showToast(`Workflow "${updated.name}" is now ACTIVE!`);
    },
    onError: (err: any) => {
      showToast(err.message || "Activation blocked by validation error", "error");
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => api.pauseAutomation(id),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      if (editingAutomation?.id === updated.id) {
        setEditingAutomation(updated);
      }
      showToast(`Workflow paused.`);
    },
    onError: (err: any) => {
      showToast(err.message || "Failed to pause workflow", "error");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAutomation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      showToast("Automation deleted.");
    },
    onError: (err: any) => {
      showToast(err.message || "Failed to delete automation", "error");
    },
  });

  // Client / Server Validation Check
  const handleValidateWorkflow = async () => {
    if (!editingAutomation) return;
    try {
      // First save current definition
      const def: WorkflowDefinition = {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type || "action",
          data: n.data,
          position: n.position,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          label: typeof e.label === "string" ? e.label : undefined,
        })),
      };

      await api.updateAutomation(editingAutomation.id, { workflowDefinition: def });
      const res = await api.validateAutomation(editingAutomation.id);
      setValidationErrors(res.errors || []);
      setValidationWarnings(res.warnings || []);

      if (res.isValid) {
        showToast("Workflow graph is fully valid and ready to run!");
      } else {
        showToast(`Workflow has ${res.errors.length} validation errors`, "error");
      }
    } catch (err: any) {
      showToast(err.message || "Validation error", "error");
    }
  };

  // Add Node to Canvas
  const handleAddNode = (
    type: string,
    defaultData: Record<string, any> = {}
  ) => {
    const id = `node_${type}_${Date.now()}`;
    // Position slightly offset from center
    const x = 200 + Math.floor(Math.random() * 80);
    const y = 150 + nodes.length * 90;

    const newNode: Node = {
      id,
      type,
      position: { x, y },
      data: {
        ...defaultData,
        type,
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setSelectedNode(newNode);
    showToast(`Added ${defaultData.label || type} node`);
  };

  // Update Selected Node Data
  const handleUpdateSelectedNodeData = (updates: Record<string, any>) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === selectedNode.id) {
          const updated = {
            ...n,
            data: {
              ...n.data,
              ...updates,
            },
          };
          setSelectedNode(updated);
          return updated;
        }
        return n;
      })
    );
  };

  // Delete Selected Node
  const handleDeleteSelectedNode = () => {
    if (!selectedNode) return;
    const nodeId = selectedNode.id;
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) =>
      eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
    );
    setSelectedNode(null);
    showToast("Node removed");
  };

  // Save current workflow definition
  const handleSaveFlow = () => {
    if (!editingAutomation) return;
    const def: WorkflowDefinition = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type || "action",
        data: n.data,
        position: n.position,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        label: typeof e.label === "string" ? e.label : undefined,
      })),
    };

    saveWorkflowMutation.mutate({
      id: editingAutomation.id,
      workflowDefinition: def,
    });
  };

  // Executions query for drawer
  const { data: executionsData, isLoading: isLoadingExecutions } = useQuery({
    queryKey: ["automation-executions", historyAutomation?.id],
    queryFn: () =>
      historyAutomation
        ? api.getAutomationExecutions(historyAutomation.id)
        : Promise.resolve({ items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } }),
    enabled: Boolean(historyAutomation),
  });

  // Single execution detail query
  const { data: executionDetail } = useQuery({
    queryKey: [
      "automation-execution-detail",
      historyAutomation?.id,
      selectedExecutionId,
    ],
    queryFn: () =>
      historyAutomation && selectedExecutionId
        ? api.getAutomationExecutionDetail(
            historyAutomation.id,
            selectedExecutionId
          )
        : null,
    enabled: Boolean(historyAutomation && selectedExecutionId),
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-medium shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200 ${
            toast.type === "success"
              ? "bg-slate-900 text-white border border-slate-700"
              : "bg-rose-600 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-white" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title="Automations"
        description="Send emails automatically when someone signs up or clicks a link."
        badge={
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 border border-indigo-200/60">
            {metrics.total} Workflows ({metrics.activeCount} Active)
          </span>
        }
        actions={
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm gap-2 text-xs sm:text-sm font-medium h-9 px-4"
          >
            <Plus className="h-4 w-4" />
            New Automation
          </Button>
        }
      />

      {/* Metric Summary Cards — only show when automations exist */}
      {automations.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
              <span>Total Automations</span>
              <Workflow className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{metrics.total}</div>
            <div className="text-[11px] text-slate-400 mt-1">Configured in workspace</div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
              <span>Active Sequences</span>
              <Activity className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-600">
              {metrics.activeCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Listening for triggers</div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
              <span>Enrolled Contacts</span>
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {metrics.totalEnrolled.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Total journeys initiated</div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
              <span>Completed Runs</span>
              <CheckCircle2 className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {metrics.completedCount.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Full flows finished</div>
          </div>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-xs overflow-x-auto no-scrollbar shrink-0">
          {(["all", "active", "paused", "draft"] as const).map((tab) => (
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
      {isLoading ? (
        <div className="py-16 text-center text-xs text-slate-500">
          Loading automated sequences...
        </div>
      ) : automations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {automations.map((auto) => (
            <div
              key={auto.id}
              className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
            >
              <div>
                {/* Header: Title + Active Toggle */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-slate-900">
                        {auto.name}
                      </h3>
                      <StatusBadge
                        status={
                          auto.status === "ACTIVE"
                            ? "active"
                            : auto.status === "PAUSED"
                            ? "paused"
                            : "draft"
                        }
                        label={auto.status}
                      />
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {auto.description || "Trigger-based automated customer journey"}
                    </p>
                  </div>

                  {/* Active / Pause Switch */}
                  <button
                    type="button"
                    onClick={() => {
                      if (auto.status === "ACTIVE") {
                        pauseMutation.mutate(auto.id);
                      } else {
                        activateMutation.mutate(auto.id);
                      }
                    }}
                    className={`h-6 w-11 rounded-full p-0.5 transition-colors focus:outline-none shrink-0 ${
                      auto.status === "ACTIVE" ? "bg-indigo-600" : "bg-slate-200"
                    }`}
                    title={
                      auto.status === "ACTIVE"
                        ? "Pause workflow"
                        : "Activate workflow"
                    }
                  >
                    <div
                      className={`h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                        auto.status === "ACTIVE"
                          ? "translate-x-5"
                          : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Workflow Flow Steps Visual Preview */}
                <div className="mt-4 p-3 rounded-lg bg-slate-50/70 border border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Zap className="h-3.5 w-3.5 text-emerald-500" />
                    <span>
                      {auto.triggerType === "contact_subscribed"
                        ? "New Contact"
                        : auto.triggerType === "tag_assigned"
                        ? "Tag Applied"
                        : auto.triggerType === "contact_added_to_list"
                        ? "List Enrolled"
                        : "Trigger Event"}
                    </span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                  <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500">
                    <GitBranch className="h-3 w-3 text-indigo-500" />
                    <span>{auto.stepCount || 1} Actions</span>
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
                    <strong className="text-slate-700">
                      {(auto.totalEnrolled || 0).toLocaleString()}
                    </strong>{" "}
                    enrolled
                  </span>
                  <span>&bull;</span>
                  <span>
                    <strong>{(auto.completedCount || 0).toLocaleString()}</strong> completed
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setHistoryAutomation(auto);
                      setSelectedExecutionId(null);
                    }}
                    className="h-7 px-2 text-xs text-slate-600 hover:text-indigo-600"
                    title="View live runs and step audit trail"
                  >
                    <History className="h-3.5 w-3.5 mr-1 text-slate-400" />
                    Runs
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEditor(auto)}
                    className="h-7 px-2.5 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-medium"
                  >
                    Visual Editor
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (
                        confirm(
                          `Are you sure you want to delete "${auto.name}"?`
                        )
                      ) {
                        deleteMutation.mutate(auto.id);
                      }
                    }}
                    className="h-7 px-1.5 text-xs text-slate-400 hover:text-rose-600"
                    title="Delete workflow"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 sm:p-12 text-center max-w-2xl mx-auto">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-4">
              <Workflow className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              No automations yet
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Send emails automatically when someone signs up or clicks a link. Start from scratch or pick a starter template below.
            </p>
            <div className="mt-5">
              <Button
                onClick={() => {
                  setNewWorkflowName("");
                  setNewWorkflowDesc("");
                  setNewTriggerType("contact_subscribed");
                  setIsCreateModalOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 px-4 gap-2 font-medium"
              >
                <Plus className="h-4 w-4" />
                Create Custom Automation
              </Button>
            </div>
          </div>

          {/* Starter Template Suggestion Cards */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 px-1">
              Suggested Starter Templates
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Template 1: Welcome series */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 hover:border-indigo-300 hover:shadow-sm transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <Zap className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-slate-900">Welcome series</h4>
                      <span className="text-[10px] text-emerald-700 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">Trigger: New Contact</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Automatically send a friendly greeting immediately when someone subscribes, then follow up with helpful tips 2 days later.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">2 emails · 1 delay node</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setNewWorkflowName("Welcome series");
                      setNewWorkflowDesc("Automatically send a friendly greeting when someone subscribes, with a follow-up 2 days later.");
                      setNewTriggerType("contact_subscribed");
                      setIsCreateModalOpen(true);
                    }}
                    className="text-xs font-medium text-indigo-600 border-indigo-200 hover:bg-indigo-50 h-8 gap-1.5"
                  >
                    <span>Use Template</span>
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Template 2: Re-engage inactive */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 hover:border-indigo-300 hover:shadow-sm transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-slate-900">Re-engage inactive</h4>
                      <span className="text-[10px] text-amber-700 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60">Trigger: Inactivity Tag</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Check in with subscribers who haven't opened your recent emails. Offer a special incentive or ask for feedback to rekindle interest.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">1 email · condition branch</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setNewWorkflowName("Re-engage inactive");
                      setNewWorkflowDesc("Reach out to inactive subscribers with a friendly check-in or feedback question.");
                      setNewTriggerType("tag_assigned");
                      setIsCreateModalOpen(true);
                    }}
                    className="text-xs font-medium text-indigo-600 border-indigo-200 hover:bg-indigo-50 h-8 gap-1.5"
                  >
                    <span>Use Template</span>
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VISUAL WORKFLOW BUILDER MODAL / FULLSCREEN CANVAS         */}
      {/* ========================================================= */}
      {isEditorOpen && editingAutomation && (
        <div
          className={`fixed z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 ${
            isFullscreen ? "inset-0 p-0" : "inset-0"
          }`}
        >
          <div
            className={`w-full bg-white flex flex-col shadow-2xl overflow-hidden border border-slate-200 ${
              isFullscreen
                ? "h-full rounded-none"
                : "h-full sm:h-[92vh] max-w-7xl sm:rounded-2xl rounded-none"
            }`}
          >
            {/* Top Studio Toolbar */}
            <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 border-b border-slate-200 bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Workflow className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-sm text-slate-900">
                      {editingAutomation.name}
                    </h2>
                    <StatusBadge
                      status={
                        editingAutomation.status === "ACTIVE"
                          ? "active"
                          : editingAutomation.status === "PAUSED"
                          ? "paused"
                          : "draft"
                      }
                      label={editingAutomation.status}
                    />
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Visual Workflow Designer &middot; Drag handles to connect steps
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAiWorkflowModalOpen(true)}
                  className="h-8 text-xs gap-1.5 border-purple-200 text-purple-700 bg-purple-50/60 hover:bg-purple-100"
                >
                  <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                  Generate with AI
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleValidateWorkflow}
                  className="h-8 text-xs gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500" />
                  Validate Graph
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveFlow}
                  disabled={saveWorkflowMutation.isPending}
                  className="h-8 text-xs gap-1.5 border-slate-300"
                >
                  <Save className="h-3.5 w-3.5 text-slate-600" />
                  Save Draft
                </Button>

                {editingAutomation.status === "ACTIVE" ? (
                  <Button
                    size="sm"
                    onClick={() => pauseMutation.mutate(editingAutomation.id)}
                    className="h-8 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <Pause className="h-3.5 w-3.5" />
                    Pause Workflow
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={async () => {
                      await handleSaveFlow();
                      activateMutation.mutate(editingAutomation.id);
                    }}
                    className="h-8 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Activate
                  </Button>
                )}

                <div className="h-4 w-px bg-slate-200 mx-1" />

                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  title="Close Studio"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Validation Alert Banners if present */}
            {validationErrors.length > 0 && (
              <div className="bg-rose-50 border-b border-rose-200 px-5 py-2 flex items-center justify-between text-xs text-rose-800">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>
                    <strong>Validation Blockers:</strong> {validationErrors.join("; ")}
                  </span>
                </div>
                <button
                  onClick={() => setValidationErrors([])}
                  className="text-rose-500 hover:text-rose-700 font-bold"
                >
                  &times;
                </button>
              </div>
            )}

            {validationWarnings.length > 0 && (
              <div className="bg-amber-50 border-b border-amber-200 px-5 py-2 flex items-center justify-between text-xs text-amber-800">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Warnings:</strong> {validationWarnings.join("; ")}
                  </span>
                </div>
                <button
                  onClick={() => setValidationWarnings([])}
                  className="text-amber-500 hover:text-amber-700 font-bold"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Main Interactive Canvas Area */}
            <div className="flex-1 flex overflow-hidden relative">
              {/* ReactFlow Canvas */}
              <div className="flex-1 h-full bg-slate-50/50">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  nodeTypes={nodeTypes}
                  onNodeClick={(_evt, node) => setSelectedNode(node)}
                  onPaneClick={() => setSelectedNode(null)}
                  fitView
                >
                  <Background
                    variant={BackgroundVariant.Dots}
                    gap={16}
                    size={1}
                    color="#cbd5e1"
                  />
                  <Controls className="!bg-white !border-slate-200 !shadow-sm !rounded-lg" />
                  <MiniMap
                    nodeStrokeColor="#6366F1"
                    nodeColor="#e0e7ff"
                    className="!bg-white !border-slate-200 !shadow-sm !rounded-lg"
                  />

                  {/* Add Node Floating Palette Panel */}
                  <Panel
                    position="top-left"
                    className="bg-white/95 backdrop-blur-xs p-2 rounded-xl border border-slate-200 shadow-md flex items-center gap-1.5 text-xs"
                  >
                    <span className="text-[11px] font-semibold text-slate-400 px-2 uppercase tracking-wider">
                      Add Step:
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleAddNode("send_email", {
                          label: "Send Email",
                          subject: "Automated Message",
                          htmlContent: "<p>Hello! Welcome to MailPilot.</p>",
                        })
                      }
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors"
                    >
                      <Mail className="h-3.5 w-3.5 text-sky-600" />
                      <span>Send Email</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleAddNode("delay", {
                          label: "Wait 1 Hour",
                          duration: 1,
                          unit: "hours",
                        })
                      }
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
                    >
                      <Clock className="h-3.5 w-3.5 text-amber-600" />
                      <span>Time Delay</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleAddNode("condition", {
                          label: "Has Tag VIP?",
                          conditionType: "has_tag",
                          conditionValue: "VIP",
                        })
                      }
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 transition-colors"
                    >
                      <GitBranch className="h-3.5 w-3.5 text-violet-600" />
                      <span>Condition</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleAddNode("add_tag", {
                          label: "Apply Tag",
                          tagName: "Engaged",
                        })
                      }
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                    >
                      <Tag className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Add Tag</span>
                    </button>
                  </Panel>
                </ReactFlow>
              </div>

              {/* Node Configuration Slide-Over Panel */}
              {selectedNode && (
                <div className="w-80 border-l border-slate-200 bg-white p-5 flex flex-col justify-between overflow-y-auto shrink-0 shadow-lg animate-in slide-in-from-right-4 duration-150">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-indigo-600" />
                        <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wide">
                          Step Settings
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedNode(null)}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Step Label */}
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Step Label
                      </label>
                      <input
                        type="text"
                        value={String(selectedNode.data?.label || "")}
                        onChange={(e) =>
                          handleUpdateSelectedNodeData({ label: e.target.value })
                        }
                        className="w-full text-xs rounded-lg border border-slate-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Node-specific configuration fields */}
                    {selectedNode.type === "delay" && (
                      <div className="space-y-3 pt-2 border-t border-slate-100">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Duration
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={Number(selectedNode.data?.duration ?? 1)}
                            onChange={(e) =>
                              handleUpdateSelectedNodeData({
                                duration: Number(e.target.value) || 1,
                              })
                            }
                            className="w-full text-xs rounded-lg border border-slate-200 px-3 py-1.5"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Time Unit
                          </label>
                          <select
                            value={String(selectedNode.data?.unit || "hours")}
                            onChange={(e) =>
                              handleUpdateSelectedNodeData({ unit: e.target.value })
                            }
                            className="w-full text-xs rounded-lg border border-slate-200 px-3 py-1.5 bg-white"
                          >
                            <option value="minutes">Minutes</option>
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {selectedNode.type === "send_email" && (
                      <div className="space-y-3 pt-2 border-t border-slate-100">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Subject Line <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Welcome aboard!"
                            value={String(selectedNode.data?.subject || "")}
                            onChange={(e) =>
                              handleUpdateSelectedNodeData({
                                subject: e.target.value,
                              })
                            }
                            className="w-full text-xs rounded-lg border border-slate-200 px-3 py-1.5"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            HTML Email Body
                          </label>
                          <textarea
                            rows={4}
                            value={String(selectedNode.data?.htmlContent || "")}
                            onChange={(e) =>
                              handleUpdateSelectedNodeData({
                                htmlContent: e.target.value,
                              })
                            }
                            className="w-full text-xs font-mono rounded-lg border border-slate-200 p-2.5 leading-relaxed"
                            placeholder="<p>Hello {{first_name}},</p>"
                          />
                        </div>
                      </div>
                    )}

                    {selectedNode.type === "condition" && (
                      <div className="space-y-3 pt-2 border-t border-slate-100">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Condition Rule
                          </label>
                          <select
                            value={String(selectedNode.data?.conditionType || "has_tag")}
                            onChange={(e) =>
                              handleUpdateSelectedNodeData({
                                conditionType: e.target.value,
                              })
                            }
                            className="w-full text-xs rounded-lg border border-slate-200 px-3 py-1.5 bg-white"
                          >
                            <option value="has_tag">Contact has tag</option>
                            <option value="in_list">Contact is in list</option>
                            <option value="domain_matches">
                              Email domain matches
                            </option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Match Value
                          </label>
                          <input
                            type="text"
                            placeholder={
                              selectedNode.data?.conditionType === "domain_matches"
                                ? "@acme.com"
                                : "VIP"
                            }
                            value={String(selectedNode.data?.conditionValue || selectedNode.data?.value || "")}
                            onChange={(e) =>
                              handleUpdateSelectedNodeData({
                                conditionValue: e.target.value,
                                value: e.target.value,
                              })
                            }
                            className="w-full text-xs rounded-lg border border-slate-200 px-3 py-1.5"
                          />
                        </div>
                        <div className="p-2.5 rounded-lg bg-violet-50/70 border border-violet-100 text-[11px] text-violet-800 space-y-1">
                          <div className="font-semibold">Branching Directions:</div>
                          <div>&bull; Connect from <strong>Yes</strong> handle for contacts meeting rule</div>
                          <div>&bull; Connect from <strong>No</strong> handle for fallback branch</div>
                        </div>
                      </div>
                    )}

                    {(selectedNode.type === "add_tag" ||
                      selectedNode.type === "remove_tag") && (
                      <div className="space-y-3 pt-2 border-t border-slate-100">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Tag Name
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. VIP, Onboarded"
                            value={String(selectedNode.data?.tagName || "")}
                            onChange={(e) =>
                              handleUpdateSelectedNodeData({
                                tagName: e.target.value,
                              })
                            }
                            className="w-full text-xs rounded-lg border border-slate-200 px-3 py-1.5"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Delete Node action */}
                  <div className="pt-4 border-t border-slate-100">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeleteSelectedNode}
                      className="w-full text-xs text-rose-600 hover:bg-rose-50 border-rose-200 gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Step
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* EXECUTION RUNS & AUDIT TIMELINE DRAWER                    */}
      {/* ========================================================= */}
      {historyAutomation && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-indigo-600" />
                  <h3 className="font-semibold text-sm text-slate-900">
                    Execution History
                  </h3>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Workflow: <strong>{historyAutomation.name}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryAutomation(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content: List of Runs & Step Detail */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {isLoadingExecutions ? (
                <div className="text-center py-10 text-xs text-slate-500">
                  Loading execution runs...
                </div>
              ) : executionsData?.items && executionsData.items.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Recent Enrolled Contacts ({executionsData.items.length})
                  </div>
                  {executionsData.items.map((exec) => {
                    const isSelected = selectedExecutionId === exec.id;
                    return (
                      <div
                        key={exec.id}
                        onClick={() =>
                          setSelectedExecutionId(isSelected ? null : exec.id)
                        }
                        className={`rounded-xl border p-3.5 text-xs transition-all cursor-pointer ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-50/30 shadow-xs"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-semibold text-slate-900">
                            {exec.contact?.email || "Unknown Contact"}
                          </span>
                          <StatusBadge
                            status={
                              exec.status === "COMPLETED"
                                ? "completed"
                                : exec.status === "RUNNING"
                                ? "active"
                                : "failed"
                            }
                            label={exec.status}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>
                            Started: {new Date(exec.startedAt).toLocaleTimeString()}
                          </span>
                          <span>{exec.stepCount} steps executed</span>
                        </div>

                        {/* Expanded Step Timeline */}
                        {isSelected && executionDetail && (
                          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                            <div className="text-[11px] font-semibold text-slate-700">
                              Step-by-step Audit Trail:
                            </div>
                            <div className="space-y-1.5 pl-2 border-l-2 border-indigo-200">
                              {(executionDetail.stepExecutions || []).map((step, idx) => (
                                <div
                                  key={step.id || idx}
                                  className="text-[11px] bg-slate-50 p-2 rounded border border-slate-200/60"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-slate-800">
                                      Node: {step.nodeId} ({step.nodeType})
                                    </span>
                                    <span
                                      className={`text-[10px] font-bold uppercase ${
                                        step.status === "COMPLETED"
                                          ? "text-emerald-600"
                                          : step.status === "SKIPPED"
                                          ? "text-amber-600"
                                          : "text-slate-500"
                                      }`}
                                    >
                                      {step.status}
                                    </span>
                                  </div>
                                  {step.result && (
                                    <pre className="mt-1 text-[10px] font-mono text-slate-500 overflow-x-auto bg-white p-1 rounded border border-slate-100">
                                      {JSON.stringify(step.result, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-xs text-slate-500">
                  No contacts have entered this automation yet.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistoryAutomation(null)}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* CREATE NEW AUTOMATION MODAL                               */}
      {/* ========================================================= */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs"
          onClick={() => setIsCreateModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Workflow className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Create New Automation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Automation Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. VIP Customer Onboarding"
                  value={newWorkflowName}
                  onChange={(e) => setNewWorkflowName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Nurture sequence triggered when new customers sign up"
                  value={newWorkflowDesc}
                  onChange={(e) => setNewWorkflowDesc(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Starting Trigger
                </label>
                <select
                  value={newTriggerType}
                  onChange={(e) => setNewTriggerType(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="contact_subscribed">Contact Subscribed / Registered</option>
                  <option value="tag_assigned">Tag Applied to Contact</option>
                  <option value="contact_added_to_list">Contact Added to List</option>
                </select>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!newWorkflowName.trim() || createMutation.isPending}
                onClick={() =>
                  createMutation.mutate({
                    name: newWorkflowName.trim(),
                    description: newWorkflowDesc.trim() || undefined,
                    triggerType: newTriggerType,
                  })
                }
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Launch Visual Studio
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AI Workflow Generation Modal */}
      {isAiWorkflowModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-slate-900">
                    Generate Workflow with Google Gemini
                  </h3>
                  <p className="text-slate-500 text-[11px]">
                    Describe your marketing funnel in plain English.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAiWorkflowModalOpen(false);
                  setAiWorkflowError(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            {aiWorkflowError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-xs">
                {aiWorkflowError}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Funnel Description / Instructions
              </label>
              <textarea
                rows={4}
                value={aiWorkflowPrompt}
                onChange={(e) => setAiWorkflowPrompt(e.target.value)}
                placeholder="e.g. When a new contact subscribes, wait 2 days, then send a welcome discount email with code SAVE20. If they have the VIP tag, also send an exclusive invitation."
                className="w-full rounded-xl border border-slate-300 p-3 text-xs focus:outline-indigo-600 resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-slate-500">Quick Prompt Templates:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Welcome new subscriber, wait 2 days, send 20% coupon",
                  "Send onboarding email, wait 1 day, follow up if inactive",
                  "Tag VIP subscribers and send personal calendar invite",
                ].map((tmpl) => (
                  <button
                    key={tmpl}
                    type="button"
                    onClick={() => setAiWorkflowPrompt(tmpl)}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-md transition-colors"
                  >
                    {tmpl}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsAiWorkflowModalOpen(false);
                  setAiWorkflowError(null);
                }}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!aiWorkflowPrompt.trim() || isGeneratingAiWorkflow}
                onClick={handleGenerateWorkflowWithAi}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8 gap-1.5 shadow-xs"
              >
                {isGeneratingAiWorkflow ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Generating Graph...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Generate on Canvas
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
