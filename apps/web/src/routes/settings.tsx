import { useState, useEffect } from "react";
import {
  Settings,
  Globe,
  Key,
  Users,
  CheckCircle2,
  Copy,
  Plus,
  RefreshCw,
  Server,
  Database,
  Cpu,
  Save,
  Check,
  Loader2,
  Send,
  ShieldCheck,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusBadge } from "@/components/common";
import { useHealth } from "@/hooks/use-health";
import { useAuthStore } from "@/features/auth/use-auth-store";
import { api } from "@/lib/api-client";
import type {
  DeliveryProvidersResponse,
  ProviderConnectionTestResponse,
  SendTestEmailResponse,
} from "@/types";

type SettingsTab = "general" | "providers" | "domains" | "api" | "team" | "system";

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const { data: health, refetch: refetchHealth, isFetching } = useHealth();
  const { user, profile, activeWorkspace, setActiveWorkspace, setProfile } = useAuthStore();

  const [isCopied, setIsCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [workspaceName, setWorkspaceName] = useState(activeWorkspace?.name || "My Workspace");
  const [userName, setUserName] = useState(profile?.name || user?.user_metadata?.full_name || "");
  const [fromName, setFromName] = useState("MailPilot Notifications");
  const [fromEmail, setFromEmail] = useState(user?.email || "hello@mailpilot.io");
  const [replyTo, setReplyTo] = useState(user?.email || "support@mailpilot.io");

  // Delivery Providers State
  const [providersData, setProvidersData] = useState<DeliveryProvidersResponse | null>(null);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [connectionTestResult, setConnectionTestResult] = useState<ProviderConnectionTestResponse | null>(null);
  const [settingDefaultProvider, setSettingDefaultProvider] = useState<string | null>(null);

  // Controlled test email state
  const [testEmailRecipient, setTestEmailRecipient] = useState(user?.email || "lodhiakash286@gmail.com");
  const [testEmailProvider, setTestEmailProvider] = useState<"BREVO" | "RESEND">("BREVO");
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<SendTestEmailResponse | null>(null);

  const loadDeliveryProviders = async () => {
    setIsLoadingProviders(true);
    try {
      const data = await api.getDeliveryProviders();
      setProvidersData(data);
      if (data.defaultProvider) {
        setTestEmailProvider(data.defaultProvider);
      }
    } catch (err) {
      console.error("Failed to load delivery providers:", err);
    } finally {
      setIsLoadingProviders(false);
    }
  };

  useEffect(() => {
    if (activeTab === "providers") {
      loadDeliveryProviders();
    }
  }, [activeTab]);

  const handleTestConnection = async (provider: "RESEND" | "BREVO") => {
    setTestingProvider(provider);
    setConnectionTestResult(null);
    try {
      const res = await api.testProviderConnection(provider);
      setConnectionTestResult(res);
    } catch (err: any) {
      setConnectionTestResult({
        success: false,
        ok: false,
        message: err.message || `Failed to connect to ${provider} API`,
      });
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSetDefaultProvider = async (provider: "RESEND" | "BREVO") => {
    setSettingDefaultProvider(provider);
    try {
      await api.setDefaultDeliveryProvider(provider);
      await loadDeliveryProviders();
    } catch (err: any) {
      alert(err.message || "Failed to set default provider");
    } finally {
      setSettingDefaultProvider(null);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailRecipient.trim()) return;
    setIsSendingTestEmail(true);
    setTestEmailResult(null);
    try {
      const res = await api.sendProviderTestEmail(testEmailProvider, testEmailRecipient.trim());
      setTestEmailResult(res);
    } catch (err: any) {
      setTestEmailResult({
        success: false,
        status: "FAILED",
        message: err.message || "Failed to deliver test email.",
        error: err.message,
      });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  useEffect(() => {
    if (activeWorkspace?.name) {
      setWorkspaceName(activeWorkspace.name);
    }
  }, [activeWorkspace?.name]);

  useEffect(() => {
    if (profile?.name) {
      setUserName(profile.name);
    }
  }, [profile?.name]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // 1. Update user profile name if changed
      if (userName.trim() && userName !== profile?.name) {
        const profileRes = await api.updateProfile({ name: userName.trim() });
        setProfile(profileRes.profile);
      }

      // 2. Update workspace name if changed
      if (
        activeWorkspace &&
        workspaceName.trim() &&
        workspaceName !== activeWorkspace.name
      ) {
        const wsRes = await api.updateWorkspace(activeWorkspace.id, workspaceName.trim());
        setActiveWorkspace(wsRes.workspace);
      }

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch (err: any) {
      alert(err.message || "Failed to update settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText("mp_live_948fbc23019ab76ce0024987efba1923");
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const displayName = profile?.name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const userInitials = displayName.substring(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure your workspace, sending domains, API keys, and team members."
      />

      {/* Settings Navigation Tabs */}
      <div className="flex border-b border-slate-200/80 gap-6 text-xs sm:text-sm font-medium overflow-x-auto">
        {[
          { id: "general", label: "General", icon: Settings },
          { id: "providers", label: "Email Providers", icon: Send },
          { id: "domains", label: "Sending Domains", icon: Globe },
          { id: "api", label: "API Keys & Webhooks", icon: Key },
          { id: "team", label: "Team Members", icon: Users },
          { id: "system", label: "System Health & Backend", icon: Server },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`flex items-center gap-2 pb-3 border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? "border-indigo-600 text-indigo-600 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: General Settings */}
      {activeTab === "general" && (
        <form onSubmit={handleSave} className="space-y-6 max-w-2xl text-xs">
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
            <h3 className="font-semibold text-sm text-slate-900 border-b border-slate-100 pb-3">
              Workspace & Profile Information
            </h3>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Workspace Name
              </label>
              <input
                type="text"
                required
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Workspace: <span className="font-mono text-slate-600">{activeWorkspace?.slug || "default"}</span> ({activeWorkspace?.role || "Owner"})
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Your Display Name
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Sarah Connor"
                className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Default Sender Name
                </label>
                <input
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Default Sender Email
                </label>
                <input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Reply-To Email Address
              </label>
              <input
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs h-9 px-4 font-medium disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Save Changes
                </>
              )}
            </Button>
            {isSaved && (
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Configuration updated.
              </span>
            )}
          </div>
        </form>
      )}

      {/* Tab: Email Providers (Brevo & Resend) */}
      {activeTab === "providers" && (
        <div className="space-y-6 max-w-4xl text-xs">
          {/* Header Card */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-semibold text-sm text-slate-900">
                  Email Delivery Providers
                </h3>
                <p className="text-slate-500 mt-0.5">
                  Configure delivery engines for campaigns, transactional messages, and visual automations.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadDeliveryProviders}
                disabled={isLoadingProviders}
                className="gap-1.5 text-xs border-slate-200"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isLoadingProviders ? "animate-spin text-indigo-600" : ""}`}
                />
                Refresh
              </Button>
            </div>

            {/* Providers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* BREVO CARD */}
              {(() => {
                const brevo = providersData?.providers.find((p) => p.type === "BREVO");
                const isDefault = brevo?.default || providersData?.defaultProvider === "BREVO";
                const isConfigured = brevo?.configured ?? false;

                return (
                  <div
                    className={`rounded-xl border p-5 space-y-3.5 transition-all ${
                      isDefault
                        ? "border-indigo-400 bg-indigo-50/20 shadow-xs ring-1 ring-indigo-200"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">Brevo</span>
                          <span className="text-[10px] text-slate-400 font-mono">v3 Transactional</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Formerly Sendinblue &bull; High deliverability SMTP / API
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {isDefault && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                            <Check className="h-2.5 w-2.5" /> Workspace Default
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            isConfigured
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {isConfigured ? "Configured" : "Missing API Key"}
                        </span>
                      </div>
                    </div>

                    {/* Features Badges */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                        <ShieldCheck className="h-3 w-3 text-emerald-600" />
                        Verified Personal Email OK (Gmail)
                      </span>
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        No Custom DNS Required
                      </span>
                    </div>

                    {/* Sender config preview */}
                    <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] border border-slate-100 space-y-1">
                      <div className="flex justify-between text-slate-600">
                        <span className="text-slate-400">Verified Sender:</span>
                        <span className="font-mono text-slate-800">
                          {brevo?.senderEmail || "lodhiakash286@gmail.com"}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span className="text-slate-400">Sender Display:</span>
                        <span className="text-slate-800">{brevo?.senderName || "MailPilot"}</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleTestConnection("BREVO")}
                        disabled={testingProvider === "BREVO"}
                        className="text-xs h-8 border-slate-200 gap-1.5 flex-1"
                      >
                        {testingProvider === "BREVO" ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Testing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-3 w-3" />
                            Test Connection
                          </>
                        )}
                      </Button>

                      {!isDefault && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSetDefaultProvider("BREVO")}
                          disabled={settingDefaultProvider === "BREVO" || !isConfigured}
                          className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white flex-1"
                        >
                          {settingDefaultProvider === "BREVO" ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Make Default"
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* RESEND CARD */}
              {(() => {
                const resend = providersData?.providers.find((p) => p.type === "RESEND");
                const isDefault = resend?.default || providersData?.defaultProvider === "RESEND";
                const isConfigured = resend?.configured ?? false;

                return (
                  <div
                    className={`rounded-xl border p-5 space-y-3.5 transition-all ${
                      isDefault
                        ? "border-indigo-400 bg-indigo-50/20 shadow-xs ring-1 ring-indigo-200"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">Resend</span>
                          <span className="text-[10px] text-slate-400 font-mono">Modern API</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Developer-first email delivery & analytics
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {isDefault && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                            <Check className="h-2.5 w-2.5" /> Workspace Default
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            isConfigured
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {isConfigured ? "Configured" : "Missing API Key"}
                        </span>
                      </div>
                    </div>

                    {/* Features Badges */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
                        <AlertTriangle className="h-3 w-3 text-amber-600" />
                        Custom Domain Required
                      </span>
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        Webmail (@gmail) Blocked
                      </span>
                    </div>

                    {/* Sender config preview */}
                    <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] border border-slate-100 space-y-1">
                      <div className="flex justify-between text-slate-600">
                        <span className="text-slate-400">Sandbox Sender:</span>
                        <span className="font-mono text-slate-800">
                          {resend?.senderEmail || "onboarding@resend.dev"}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span className="text-slate-400">Domain Auth:</span>
                        <span className="text-slate-800">DKIM & SPF Records</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleTestConnection("RESEND")}
                        disabled={testingProvider === "RESEND"}
                        className="text-xs h-8 border-slate-200 gap-1.5 flex-1"
                      >
                        {testingProvider === "RESEND" ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Testing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-3 w-3" />
                            Test Connection
                          </>
                        )}
                      </Button>

                      {!isDefault && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSetDefaultProvider("RESEND")}
                          disabled={settingDefaultProvider === "RESEND" || !isConfigured}
                          className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white flex-1"
                        >
                          {settingDefaultProvider === "RESEND" ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Make Default"
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Diagnostics Banner if connection test executed */}
            {connectionTestResult && (
              <div
                className={`rounded-lg p-3.5 border flex items-start gap-3 ${
                  connectionTestResult.success
                    ? "bg-emerald-50/60 border-emerald-200 text-emerald-900"
                    : "bg-rose-50/60 border-rose-200 text-rose-900"
                }`}
              >
                {connectionTestResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 text-xs">
                  <div className="font-semibold">
                    {connectionTestResult.success
                      ? `API Connection Successful (${connectionTestResult.details?.provider || "Provider"})`
                      : "API Connection Failed"}
                  </div>
                  <div>{connectionTestResult.message}</div>
                  {connectionTestResult.details && (
                    <div className="text-[11px] opacity-80 font-mono">
                      {connectionTestResult.details.accountEmail && (
                        <span>Account: {connectionTestResult.details.accountEmail} &bull; </span>
                      )}
                      {connectionTestResult.details.planType && (
                        <span>Plan: {connectionTestResult.details.planType} &bull; </span>
                      )}
                      {connectionTestResult.details.credits !== undefined && (
                        <span>Credits: {connectionTestResult.details.credits} &bull; </span>
                      )}
                      <span>Tested: {new Date(connectionTestResult.details.testedAt).toLocaleTimeString()}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Controlled Single-Recipient Test Send Card */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-semibold text-sm text-slate-900">
                Send Controlled Test Email
              </h3>
              <p className="text-slate-500 mt-0.5">
                Send a real test email through your delivery provider directly to any inbox to verify delivery and inbox placement.
              </p>
            </div>

            <form onSubmit={handleSendTestEmail} className="space-y-4 max-w-xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Select Provider
                  </label>
                  <select
                    value={testEmailProvider}
                    onChange={(e) => setTestEmailProvider(e.target.value as "BREVO" | "RESEND")}
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs bg-white text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="BREVO">Brevo (Verified Gmail OK)</option>
                    <option value="RESEND">Resend (Requires Domain)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Recipient Address
                  </label>
                  <input
                    type="email"
                    required
                    value={testEmailRecipient}
                    onChange={(e) => setTestEmailRecipient(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Button
                  type="submit"
                  disabled={isSendingTestEmail || !testEmailRecipient.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs h-9 px-4 font-medium disabled:opacity-50"
                >
                  {isSendingTestEmail ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Dispatching Test Email...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      Send Live Test Email
                    </>
                  )}
                </Button>
              </div>
            </form>

            {/* Test Email Result Box */}
            {testEmailResult && (
              <div
                className={`rounded-lg p-3.5 border flex items-start gap-3 mt-4 ${
                  testEmailResult.success
                    ? "bg-emerald-50/60 border-emerald-200 text-emerald-900"
                    : "bg-rose-50/60 border-rose-200 text-rose-900"
                }`}
              >
                {testEmailResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 text-xs">
                  <div className="font-semibold">
                    {testEmailResult.success
                      ? "Test Email Accepted & Dispatched"
                      : "Test Email Delivery Failed"}
                  </div>
                  <div>{testEmailResult.message || testEmailResult.error}</div>
                  {testEmailResult.providerMessageId && (
                    <div className="text-[11px] font-mono text-emerald-800">
                      Provider Message ID: <strong>{testEmailResult.providerMessageId}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Sending Domains */}
      {activeTab === "domains" && (
        <div className="space-y-6 max-w-4xl text-xs">
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-semibold text-sm text-slate-900">
                  Verified Sending Domains
                </h3>
                <p className="text-slate-500 mt-0.5">
                  Authorize MailPilot to send emails on behalf of your brand domain.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => alert("Domain verification modal ready for Phase 6 DNS.")}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Domain
              </Button>
            </div>

            {/* Active Domain Card */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Globe className="h-4 w-4 text-emerald-600" />
                  <span className="font-bold text-sm text-slate-900">
                    mail.mailpilot.io
                  </span>
                  <StatusBadge status="active" label="DNS Verified" />
                </div>
                <span className="text-[11px] text-slate-500">
                  Default Broadcast Domain
                </span>
              </div>

              {/* DNS Records Checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-800">DKIM Record</div>
                    <div className="text-[10px] text-slate-400">2048-bit RSA Valid</div>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-800">SPF Record</div>
                    <div className="text-[10px] text-slate-400">v=spf1 include:_mailpilot</div>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-800">DMARC Policy</div>
                    <div className="text-[10px] text-slate-400">p=quarantine configured</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: API Keys & Webhooks */}
      {activeTab === "api" && (
        <div className="space-y-6 max-w-3xl text-xs">
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
            <h3 className="font-semibold text-sm text-slate-900 border-b border-slate-100 pb-3">
              REST API Authentication
            </h3>
            <p className="text-slate-500">
              Use these credentials to trigger automated transactional sends or sync audiences via API.
            </p>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Live Secret Key
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  readOnly
                  value="mp_live_948fbc23019ab76ce0024987efba1923"
                  className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 font-mono px-3 text-xs text-slate-700 select-all"
                />
                <Button
                  variant="outline"
                  onClick={copyApiKey}
                  className="gap-1.5 text-xs h-9 px-3 border-slate-200"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {isCopied ? "Copied!" : "Copy"}
                </Button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Never commit your secret key into public client-side repositories.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Team Members */}
      {activeTab === "team" && (
        <div className="space-y-6 max-w-4xl text-xs">
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-semibold text-sm text-slate-900">
                  Workspace Members
                </h3>
                <p className="text-slate-500 mt-0.5">
                  Manage collaborators for workspace: <strong className="text-slate-800">{activeWorkspace?.name}</strong>
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => alert("Invite teammate dialog ready for workspace collaboration.")}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Invite Member
              </Button>
            </div>

            <div className="divide-y divide-slate-100">
              <div className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                    {userInitials}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{displayName}</div>
                    <div className="text-slate-500 text-[11px]">{user?.email || profile?.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status="active" label={activeWorkspace?.role === "owner" ? "Workspace Owner" : "Active Member"} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Real System & Backend Health Integration (Preserving Phase 1) */}
      {activeTab === "system" && (
        <div className="space-y-6 max-w-3xl text-xs">
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-semibold text-sm text-slate-900">
                  Infrastructure Health Diagnostic
                </h3>
                <p className="text-slate-500 mt-0.5">
                  Real-time connectivity verification with Express API Gateway, Supabase PostgreSQL, and Redis BullMQ.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchHealth()}
                className="gap-1.5 text-xs border-slate-200"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-indigo-600" : ""}`}
                />
                Refresh
              </Button>
            </div>

            <div className="space-y-3">
              {/* Express API */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-3">
                  <Server className="h-4 w-4 text-slate-600" />
                  <div>
                    <div className="font-semibold text-slate-900">Express API Gateway</div>
                    <div className="text-[11px] text-slate-500">Service: mailpilot-api (Port 4000)</div>
                  </div>
                </div>
                <StatusBadge
                  status={health?.status === "healthy" ? "healthy" : "unhealthy"}
                  label={health?.status === "healthy" ? "HTTP 200 Healthy" : "Offline"}
                />
              </div>

              {/* Supabase PostgreSQL */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-3">
                  <Database className="h-4 w-4 text-slate-600" />
                  <div>
                    <div className="font-semibold text-slate-900">Supabase PostgreSQL (Prisma)</div>
                    <div className="text-[11px] text-slate-500">
                      Supavisor Transaction Pooler (AWS ap-northeast-2)
                    </div>
                  </div>
                </div>
                <StatusBadge
                  status={health?.dependencies?.database === "connected" ? "connected" : "disconnected"}
                  label={
                    health?.dependencies?.database === "connected"
                      ? `Connected (${health.metrics?.databaseLatencyMs ?? 4}ms)`
                      : "Disconnected"
                  }
                />
              </div>

              {/* Redis & BullMQ Engine */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-3">
                  <Cpu className="h-4 w-4 text-slate-600" />
                  <div>
                    <div className="font-semibold text-slate-900">Redis & BullMQ Engine</div>
                    <div className="text-[11px] text-slate-500">
                      In-memory event queue & worker scheduler (Port 6379)
                    </div>
                  </div>
                </div>
                <StatusBadge
                  status={health?.dependencies?.redis === "connected" ? "connected" : "disconnected"}
                  label={
                    health?.dependencies?.redis === "connected"
                      ? `Connected (${health.metrics?.redisLatencyMs ?? 2}ms)`
                      : "Disconnected"
                  }
                />
              </div>
            </div>

            {health?.timestamp && (
              <div className="pt-2 text-[11px] text-slate-400 font-mono">
                Last ping: {new Date(health.timestamp).toLocaleString()} &bull; Uptime: {health.metrics?.uptimeSeconds ?? 0}s
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
