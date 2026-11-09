import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings,
  Users,
  Server,
  Save,
  Check,
  Loader2,
  Mail,
  Calendar,
  Sparkles,
  RefreshCw,
  ShieldCheck,
  ExternalLink,
  Eye,
  EyeOff,
  Send,
  AlertCircle,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusBadge } from "@/components/common";
import { useHealth } from "@/hooks/use-health";
import { useAuthStore } from "@/features/auth/use-auth-store";
import { api } from "@/lib/api-client";

type SettingsTab = "general" | "google" | "team" | "system";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const searchParams = new URLSearchParams(window.location.search);
  const initialTab = (searchParams.get("tab") as SettingsTab) || "general";
  
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const { data: health, refetch: refetchHealth, isFetching } = useHealth();
  const { user, profile, activeWorkspace, setActiveWorkspace, setProfile } = useAuthStore();

  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // General profile form states
  const [workspaceName, setWorkspaceName] = useState(activeWorkspace?.name || "My Workspace");
  const [userName, setUserName] = useState(profile?.name || user?.user_metadata?.full_name || "");

  // Gmail SMTP form states
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpSenderName, setSmtpSenderName] = useState("MailPilot");
  const [smtpReplyTo, setSmtpReplyTo] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [smtpFeedback, setSmtpFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Test email dispatch modal
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState(user?.email || "");
  const [testEmailFeedback, setTestEmailFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Queries
  const { data: smtpSettings, isLoading: isLoadingSmtp } = useQuery({
    queryKey: ["smtp-settings", activeWorkspace?.id],
    queryFn: () => api.getSmtpSettings(),
    enabled: Boolean(activeWorkspace?.id),
  });

  const { data: calendarStatus, refetch: refetchCalendar, isLoading: isLoadingCalendar } = useQuery({
    queryKey: ["calendar-status", activeWorkspace?.id],
    queryFn: () => api.getCalendarStatus(),
    enabled: Boolean(activeWorkspace?.id),
  });

  const { data: aiStatus } = useQuery({
    queryKey: ["ai-status"],
    queryFn: () => api.getAIStatus(),
  });

  // Populate SMTP state from fetched settings
  useEffect(() => {
    if (smtpSettings) {
      if (smtpSettings.user) setSmtpUser(smtpSettings.user);
      if (smtpSettings.senderName) setSmtpSenderName(smtpSettings.senderName);
      if (smtpSettings.replyTo) setSmtpReplyTo(smtpSettings.replyTo);
    }
  }, [smtpSettings]);

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

  // Handle URL notifications (from Google Calendar callback)
  useEffect(() => {
    if (searchParams.get("calendar") === "connected") {
      setSmtpFeedback({
        type: "success",
        message: "Google Calendar connected successfully! Campaign schedules will now synchronize automatically.",
      });
      refetchCalendar();
    } else if (searchParams.get("calendar_error")) {
      setSmtpFeedback({
        type: "error",
        message: `Google Calendar authentication failed: ${searchParams.get("calendar_error")}`,
      });
    }
  }, []);

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (userName.trim() && userName !== profile?.name) {
        const profileRes = await api.updateProfile({ name: userName.trim() });
        setProfile(profileRes.profile);
      }

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

  // Mutations for SMTP
  const saveSmtpMutation = useMutation({
    mutationFn: () =>
      api.saveSmtpSettings({
        user: smtpUser.trim(),
        appPassword: smtpPassword.trim() || undefined,
        senderName: smtpSenderName.trim(),
        replyTo: smtpReplyTo.trim() || null,
      }),
    onSuccess: () => {
      setSmtpFeedback({ type: "success", message: "Gmail SMTP settings saved successfully." });
      setSmtpPassword("");
      queryClient.invalidateQueries({ queryKey: ["smtp-settings"] });
    },
    onError: (err: any) => {
      setSmtpFeedback({ type: "error", message: err.message || "Failed to save SMTP settings." });
    },
  });

  const testSmtpMutation = useMutation({
    mutationFn: () =>
      api.testSmtpConnection(
        smtpUser && smtpPassword
          ? { user: smtpUser.trim(), appPassword: smtpPassword.trim() }
          : undefined
      ),
    onSuccess: (res) => {
      if (res.healthy) {
        setSmtpFeedback({ type: "success", message: "SMTP connection verified successfully! Ready to send." });
        queryClient.invalidateQueries({ queryKey: ["smtp-settings"] });
      } else {
        setSmtpFeedback({ type: "error", message: res.error || "SMTP verification failed. Check credentials." });
      }
    },
    onError: (err: any) => {
      setSmtpFeedback({ type: "error", message: err.message || "Failed to test connection." });
    },
  });

  const sendTestEmailMutation = useMutation({
    mutationFn: () =>
      api.sendSmtpTestEmail({
        to: testEmailTo.trim(),
        user: smtpUser.trim() || undefined,
        appPassword: smtpPassword.trim() || undefined,
        senderName: smtpSenderName.trim() || undefined,
      }),
    onSuccess: (res) => {
      if (res.success) {
        setTestEmailFeedback({
          type: "success",
          message: `Test email sent successfully! Message ID: ${res.messageId || "Accepted"}`,
        });
      } else {
        setTestEmailFeedback({ type: "error", message: res.error || "Email delivery failed." });
      }
    },
    onError: (err: any) => {
      setTestEmailFeedback({ type: "error", message: err.message || "Failed to send test email." });
    },
  });

  const deleteSmtpMutation = useMutation({
    mutationFn: () => api.deleteSmtpSettings(),
    onSuccess: () => {
      setSmtpFeedback({ type: "success", message: "Workspace SMTP configuration reset to system default." });
      setSmtpPassword("");
      queryClient.invalidateQueries({ queryKey: ["smtp-settings"] });
    },
  });

  // Calendar connect
  const handleConnectCalendar = async () => {
    try {
      const { url } = await api.getCalendarAuthUrl();
      if (url) {
        window.location.href = url;
      }
    } catch (err: any) {
      setSmtpFeedback({
        type: "error",
        message: err.message || "Could not generate Google Calendar authorization URL.",
      });
    }
  };

  const disconnectCalendarMutation = useMutation({
    mutationFn: () => api.disconnectCalendar(),
    onSuccess: () => {
      setSmtpFeedback({ type: "success", message: "Google Calendar disconnected." });
      queryClient.invalidateQueries({ queryKey: ["calendar-status"] });
    },
    onError: (err: any) => {
      setSmtpFeedback({ type: "error", message: err.message || "Failed to disconnect calendar." });
    },
  });

  const displayName = profile?.name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const userInitials = displayName.substring(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure your workspace profile, Google ecosystem integrations, team access, and backend diagnostics."
      />

      {/* Settings Navigation Tabs */}
      <div className="flex border-b border-slate-200/80 gap-3 sm:gap-6 text-xs sm:text-sm font-medium overflow-x-auto no-scrollbar pb-1">
        {[
          { id: "general", label: "General & Profile", icon: Settings },
          { id: "google", label: "Google Integrations", icon: ShieldCheck },
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
              className={`flex items-center gap-2 pb-2.5 sm:pb-3 border-b-2 whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? "border-indigo-600 text-indigo-600 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: General & Profile */}
      {activeTab === "general" && (
        <form onSubmit={handleSaveGeneral} className="space-y-6 max-w-3xl text-xs">
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-semibold text-sm text-slate-900">Workspace Details</h3>
              <p className="text-slate-500 mt-0.5">Identify your team and organization.</p>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1.5">Workspace Name</label>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-indigo-600"
                required
              />
            </div>

            <div className="border-b border-slate-100 pt-3 pb-3">
              <h3 className="font-semibold text-sm text-slate-900">Your Personal Profile</h3>
              <p className="text-slate-500 mt-0.5">Manage how your name appears in your workspace.</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                {userInitials}
              </div>
              <div className="flex-1 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-slate-700 font-medium mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Your Full Name"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button type="submit" disabled={isSaving} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : isSaved ? <Check className="h-4 w-4 text-emerald-300" /> : <Save className="h-4 w-4" />}
                {isSaving ? "Saving..." : isSaved ? "Saved Successfully" : "Save Changes"}
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* Tab 2: Google Ecosystem Integrations */}
      {activeTab === "google" && (
        <div className="space-y-6 max-w-4xl text-xs">
          {/* Banner notification */}
          {smtpFeedback && (
            <div
              className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                smtpFeedback.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              <div className="flex items-center gap-2">
                {smtpFeedback.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                )}
                <span>{smtpFeedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setSmtpFeedback(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                ×
              </button>
            </div>
          )}

          {/* Section 1: Gmail SMTP Gateway */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold shadow-xs">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                    Gmail SMTP Delivery Gateway
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      smtp.gmail.com:587
                    </span>
                  </h3>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Broadcast campaigns and automations are sent via Nodemailer with STARTTLS.
                  </p>
                </div>
              </div>

              <div>
                {isLoadingSmtp ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                ) : smtpSettings?.isVerified ? (
                  <StatusBadge status="active" label="Verified & Operational" />
                ) : smtpSettings?.configured ? (
                  <StatusBadge status="warning" label="Configured (Unverified)" />
                ) : (
                  <StatusBadge status="inactive" label="Not Configured" />
                )}
              </div>
            </div>

            {/* Quick sending quotas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Personal Account Quota</span>
                <span className="font-semibold text-slate-800 text-sm">500 emails / day</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Google Workspace Quota</span>
                <span className="font-semibold text-slate-800 text-sm">2,000 emails / day</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Queue Rate Limiter</span>
                <span className="font-semibold text-slate-800 text-sm">2 msg / sec (Burst Guard)</span>
              </div>
            </div>

            {/* Setup Form */}
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-medium mb-1.5">
                    Gmail Address / Google Workspace Email
                  </label>
                  <input
                    type="email"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="you@gmail.com or company@domain.com"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1.5 flex items-center justify-between">
                    <span>16-Character Google App Password</span>
                    {smtpSettings?.source === "workspace" && (
                      <span className="text-slate-400 text-[10px] font-mono">
                        Saved: {smtpSettings.maskedPassword}
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={smtpPassword}
                      onChange={(e) => setSmtpPassword(e.target.value)}
                      placeholder={smtpSettings?.configured ? "Enter new password to change..." : "abcd efgh ijkl mnop"}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs pr-9 font-mono focus:outline-indigo-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1.5">
                    Default Sender Display Name
                  </label>
                  <input
                    type="text"
                    value={smtpSenderName}
                    onChange={(e) => setSmtpSenderName(e.target.value)}
                    placeholder="MailPilot Team"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1.5">
                    Reply-To Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={smtpReplyTo}
                    onChange={(e) => setSmtpReplyTo(e.target.value)}
                    placeholder="support@domain.com"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-indigo-600"
                  />
                </div>
              </div>

              {/* Step-by-Step Instructions */}
              <div className="rounded-lg bg-indigo-50/60 border border-indigo-100 p-3.5 space-y-2">
                <span className="font-semibold text-indigo-900 block text-[11px]">
                  How to generate your 16-Character Google App Password:
                </span>
                <ol className="list-decimal list-inside text-indigo-800 text-[11px] space-y-1">
                  <li>Ensure 2-Step Verification is turned ON for your Google account.</li>
                  <li>
                    Visit{" "}
                    <a
                      href="https://myaccount.google.com/apppasswords"
                      target="_blank"
                      rel="noreferrer"
                      className="underline font-medium inline-flex items-center gap-0.5"
                    >
                      Google App Passwords <ExternalLink className="h-3 w-3 inline" />
                    </a>
                  </li>
                  <li>Create an App Password with the app name <strong>"MailPilot"</strong>.</li>
                  <li>Copy the 16 characters and paste them into the password field above.</li>
                </ol>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => testSmtpMutation.mutate()}
                    disabled={testSmtpMutation.isPending}
                    className="gap-1.5 h-8 text-xs border-slate-300"
                  >
                    {testSmtpMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                    )}
                    Test Connection
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTestModal(true)}
                    className="gap-1.5 h-8 text-xs border-slate-300"
                  >
                    <Send className="h-3.5 w-3.5 text-indigo-500" />
                    Send Test Email
                  </Button>

                  {smtpSettings?.source === "workspace" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Reset custom workspace credentials and revert to default?")) {
                          deleteSmtpMutation.mutate();
                        }
                      }}
                      disabled={deleteSmtpMutation.isPending}
                      className="gap-1.5 h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Reset to Default
                    </Button>
                  )}
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => saveSmtpMutation.mutate()}
                  disabled={saveSmtpMutation.isPending || (!smtpUser && !smtpPassword)}
                  className="gap-1.5 h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                >
                  {saveSmtpMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save Configuration
                </Button>
              </div>
            </div>
          </div>

          {/* Section 2: Google Calendar Integration */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold shadow-xs">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-slate-900">
                    Google Calendar Synchronization
                  </h3>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Synchronize planned campaign dispatch dates directly into your Google Calendar.
                  </p>
                </div>
              </div>

              <div>
                {isLoadingCalendar ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                ) : calendarStatus?.connected ? (
                  <StatusBadge status="active" label={`Connected: ${calendarStatus.googleEmail || "Active"}`} />
                ) : (
                  <StatusBadge status="warning" label="OAuth Setup Pending" />
                )}
              </div>
            </div>

            <p className="text-slate-600 text-xs">
              When a campaign is scheduled in the Schedule Center, MailPilot automatically creates a Google Calendar event showing recipient estimates, send time, and direct campaign links. When rescheduled or cancelled, your calendar updates in real time.
            </p>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500">
                OAuth 2.0 Scope: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px]">https://www.googleapis.com/auth/calendar.events</code>
              </span>

              {calendarStatus?.connected ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm("Disconnect Google Calendar from this workspace?")) {
                      disconnectCalendarMutation.mutate();
                    }
                  }}
                  disabled={disconnectCalendarMutation.isPending}
                  className="gap-1.5 h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                >
                  {disconnectCalendarMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Disconnect Calendar
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConnectCalendar}
                  className="gap-1.5 h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Connect Google Calendar
                </Button>
              )}
            </div>
          </div>

          {/* Section 3: Google Gemini AI Copilot */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold shadow-xs">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-slate-900">
                    Google Gemini AI Copilot
                  </h3>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Official Google GenAI SDK (Model: {aiStatus?.model || "gemini-2.0-flash"})
                  </p>
                </div>
              </div>

              <div>
                <StatusBadge
                  status={aiStatus?.configured ? "active" : "warning"}
                  label={aiStatus?.configured ? "Active & Configured" : "Awaiting API Key"}
                />
              </div>
            </div>

            <p className="text-slate-600 text-xs">
              Powers AI subject line generation, automated copy drafts, deliverability & spam-risk audits, and natural-language workflow generation in the visual builder.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
              <div className="p-3 rounded-lg bg-purple-50/50 border border-purple-100 space-y-1">
                <span className="font-semibold text-purple-900 block">AI Campaign Assistant</span>
                <p className="text-purple-800">
                  Generate email drafts, high-converting subject line variants, and preheaders directly from campaign objectives.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-purple-50/50 border border-purple-100 space-y-1">
                <span className="font-semibold text-purple-900 block">Natural Language Automation Generator</span>
                <p className="text-purple-800">
                  Type a prompt like <em>"Send a welcome email, wait 2 days, and if VIP send discount"</em> to assemble visual React Flow graphs instantly.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500">
                To configure or update key, set <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px]">GEMINI_API_KEY</code> in environment.
              </span>
              <a
                href="https://aistudio.google.com/"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 font-medium underline inline-flex items-center gap-1 text-[11px]"
              >
                Google AI Studio <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Team Members */}
      {activeTab === "team" && (
        <div className="space-y-6 max-w-4xl text-xs">
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-semibold text-sm text-slate-900">Workspace Members</h3>
                <p className="text-slate-500 mt-0.5">Manage users who have access to this workspace.</p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              <div className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                    {userInitials}
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">{displayName} (You)</div>
                    <div className="text-slate-500 text-[11px]">{user?.email}</div>
                  </div>
                </div>
                <StatusBadge status="active" label="Owner" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: System Health & Diagnostics */}
      {activeTab === "system" && (
        <div className="space-y-6 max-w-4xl text-xs">
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-semibold text-sm text-slate-900">Backend Infrastructure Diagnostics</h3>
                <p className="text-slate-500 mt-0.5">Real-time status of PostgreSQL, Redis queues, and API services.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchHealth()}
                disabled={isFetching}
                className="gap-1.5 h-8 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Supabase PostgreSQL</span>
                  <StatusBadge
                    status={health?.dependencies?.database === "connected" ? "active" : "failed"}
                    label={health?.dependencies?.database || "Unknown"}
                  />
                </div>
                <div className="text-[11px] text-slate-500">
                  Latency: {health?.metrics?.databaseLatencyMs ? `${health.metrics.databaseLatencyMs}ms` : "N/A"}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Redis & BullMQ Engine</span>
                  <StatusBadge
                    status={health?.dependencies?.redis === "connected" ? "active" : "failed"}
                    label={health?.dependencies?.redis || "Unknown"}
                  />
                </div>
                <div className="text-[11px] text-slate-500">
                  Latency: {health?.metrics?.redisLatencyMs ? `${health.metrics.redisLatencyMs}ms` : "N/A"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Send Test Email */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                <Send className="h-4 w-4 text-indigo-600" />
                Send Real Test Email
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowTestModal(false);
                  setTestEmailFeedback(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <p className="text-slate-600 text-xs">
              Dispatch a test email via your configured Gmail SMTP connection to verify end-to-end receipt in your inbox.
            </p>

            {testEmailFeedback && (
              <div
                className={`p-3 rounded-lg text-xs ${
                  testEmailFeedback.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {testEmailFeedback.message}
              </div>
            )}

            <div>
              <label className="block text-slate-700 font-medium mb-1.5 text-xs">
                Recipient Email Address
              </label>
              <input
                type="email"
                value={testEmailTo}
                onChange={(e) => setTestEmailTo(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-indigo-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowTestModal(false);
                  setTestEmailFeedback(null);
                }}
                className="text-xs h-8"
              >
                Close
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => sendTestEmailMutation.mutate()}
                disabled={sendTestEmailMutation.isPending || !testEmailTo}
                className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
              >
                {sendTestEmailMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Dispatch Test
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
