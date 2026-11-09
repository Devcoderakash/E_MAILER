import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Sparkles,
  X,
  Loader2,
  Check,
  AlertTriangle,
  Lightbulb,
  ShieldCheck,
  Wand2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import type { AIStatusResponse } from "@/types";

interface AICopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSubject?: string;
  currentPreheader?: string;
  currentHtmlContent?: string;
  onApplySubject: (subject: string) => void;
  onApplyPreheader: (preheader: string) => void;
  onApplyHtmlContent: (html: string) => void;
  onApplyAll?: (data: { subject?: string; preheader?: string; htmlContent?: string }) => void;
}

export function AICopilotModal({
  isOpen,
  onClose,
  currentSubject = "",
  currentPreheader = "",
  currentHtmlContent = "",
  onApplySubject,
  onApplyPreheader,
  onApplyHtmlContent,
  onApplyAll,
}: AICopilotModalProps) {
  const [activeTab, setActiveTab] = useState<
    "subjects" | "draft" | "preheaders" | "improve"
  >("subjects");

  const [appliedField, setAppliedField] = useState<string | null>(null);

  const markApplied = (field: string) => {
    setAppliedField(field);
    setTimeout(() => setAppliedField(null), 2500);
  };

  // Check AI Provider Status
  const { data: aiStatus, isLoading: isLoadingStatus } = useQuery<AIStatusResponse>({
    queryKey: ["ai-status"],
    queryFn: () => api.getAIStatus(),
    enabled: isOpen,
  });

  // 1. Subject Lines Generator State & Mutation
  const [purpose, setPurpose] = useState(currentSubject || "");
  const [subjectAudience, setSubjectAudience] = useState("");
  const [subjectTone, setSubjectTone] = useState("Professional and engaging");

  const subjectMutation = useMutation({
    mutationFn: () =>
      api.generateSubjectLines({
        purpose: purpose.trim() || "Promotional newsletter for SaaS subscribers",
        audience: subjectAudience.trim() || undefined,
        tone: subjectTone,
        count: 5,
      }),
  });

  // 2. Email Draft Generator State & Mutation
  const [draftGoal, setDraftGoal] = useState(purpose || "Product update announcement");
  const [draftDetails, setDraftDetails] = useState("");
  const [draftTone, setDraftTone] = useState("Friendly and inspiring");
  const [draftCta, setDraftCta] = useState("Get Started");

  const draftMutation = useMutation({
    mutationFn: () =>
      api.generateEmailDraft({
        goal: draftGoal.trim(),
        productDetails: draftDetails.trim() || undefined,
        tone: draftTone,
        cta: draftCta.trim() || undefined,
      }),
  });

  // 3. Preheader Generator State & Mutation
  const [preheaderSubject, setPreheaderSubject] = useState(currentSubject);

  const preheaderMutation = useMutation({
    mutationFn: () =>
      api.generatePreheader({
        subject: preheaderSubject.trim() || "Important Announcement",
        emailContent: currentHtmlContent || undefined,
        count: 4,
      }),
  });

  // 4. Campaign Improver & Spam Risk State & Mutation
  const improveMutation = useMutation({
    mutationFn: () =>
      api.improveCampaign({
        subject: currentSubject || undefined,
        preheader: currentPreheader || undefined,
        htmlContent: currentHtmlContent || undefined,
      }),
  });

  if (!isOpen) return null;

  const isConfigured = aiStatus?.configured ?? true;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full h-full sm:h-auto sm:max-h-[88vh] sm:max-w-2xl bg-white sm:rounded-2xl rounded-none border-0 sm:border border-slate-200 shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 via-white to-violet-50/50 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-200">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 truncate">
                <span>AI Campaign Copilot</span>
                <span className="text-[10px] font-medium bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200/50">
                  {aiStatus?.provider || "Google Gemini"}
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 truncate">
                Generate copy, craft high-converting subjects, and audit deliverability
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 shrink-0"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Configuration Notice if not configured */}
        {!isLoadingStatus && !isConfigured && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2.5 sm:py-3 flex items-start gap-2.5 text-xs text-amber-800 shrink-0">
            <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">AI Copilot Setup Required</div>
              <div className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                {aiStatus?.notice ||
                  "Please set AI_API_KEY in your server environment or enable Mock mode (AI_PROVIDER=mock) in .env to generate live completions."}
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-4 sm:px-6 bg-slate-50/60 shrink-0 text-xs overflow-x-auto no-scrollbar">
          {[
            { id: "subjects", label: "Subject Lines" },
            { id: "draft", label: "Email Draft" },
            { id: "preheaders", label: "Preheaders" },
            { id: "improve", label: "Improver & Spam Risk" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2.5 px-3 font-medium transition-colors border-b-2 -mb-px whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? "border-indigo-600 text-indigo-600 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {/* ==================================================== */}
          {/* TAB 1: SUBJECT LINES GENERATOR                       */}
          {/* ==================================================== */}
          {activeTab === "subjects" && (
            <div className="space-y-4">
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Campaign Purpose or Product Launch <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Announce 20% discount on annual subscriptions"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Target Audience (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. SaaS Founders, Developers"
                      value={subjectAudience}
                      onChange={(e) => setSubjectAudience(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Tone of Voice
                    </label>
                    <select
                      value={subjectTone}
                      onChange={(e) => setSubjectTone(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white"
                    >
                      <option value="Professional and engaging">Professional and engaging</option>
                      <option value="Bold and high-energy">Bold and high-energy</option>
                      <option value="Curious and intriguing">Curious and intriguing</option>
                      <option value="Warm and friendly">Warm and friendly</option>
                      <option value="Urgent and time-sensitive">Urgent and time-sensitive</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    size="sm"
                    disabled={!purpose.trim() || subjectMutation.isPending}
                    onClick={() => subjectMutation.mutate()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5"
                  >
                    {subjectMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                    Generate Subject Lines
                  </Button>
                </div>
              </div>

              {/* Error state */}
              {subjectMutation.isError && (
                <div className="p-3 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs">
                  {(subjectMutation.error as any)?.message || "Failed to generate subject lines."}
                </div>
              )}

              {/* Results List */}
              {subjectMutation.data && (
                <div className="space-y-2 pt-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    High-Converting Subject Suggestions:
                  </div>
                  <div className="space-y-2">
                    {subjectMutation.data.suggestions.map((subj, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all bg-white"
                      >
                        <span className="font-medium text-slate-900 pr-3">{subj}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            onApplySubject(subj);
                            markApplied(`subj_${idx}`);
                          }}
                          className="h-7 text-[11px] border-indigo-200 text-indigo-700 hover:bg-indigo-100/60 shrink-0 gap-1"
                        >
                          {appliedField === `subj_${idx}` ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600" />
                              Applied!
                            </>
                          ) : (
                            "Apply to Campaign"
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 2: EMAIL DRAFT GENERATOR                         */}
          {/* ==================================================== */}
          {activeTab === "draft" && (
            <div className="space-y-4">
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Campaign Goal <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Introduce visual workflow automations to new customers"
                    value={draftGoal}
                    onChange={(e) => setDraftGoal(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Key Features / Highlights
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. 99.8% deliverability, visual node branching, 10-minute setup"
                    value={draftDetails}
                    onChange={(e) => setDraftDetails(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Call to Action (CTA)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Start Free Trial"
                      value={draftCta}
                      onChange={(e) => setDraftCta(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Tone
                    </label>
                    <select
                      value={draftTone}
                      onChange={(e) => setDraftTone(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white"
                    >
                      <option value="Friendly and inspiring">Friendly and inspiring</option>
                      <option value="Direct and benefit-focused">Direct and benefit-focused</option>
                      <option value="Authoritative and analytical">Authoritative and analytical</option>
                      <option value="Excited and promotional">Excited and promotional</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    size="sm"
                    disabled={!draftGoal.trim() || draftMutation.isPending}
                    onClick={() => draftMutation.mutate()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5"
                  >
                    {draftMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                    Generate Full Draft
                  </Button>
                </div>
              </div>

              {/* Draft Results Card */}
              {draftMutation.data && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Generated Campaign Draft
                    </span>
                    <Button
                      size="sm"
                      onClick={() => {
                        const d = draftMutation.data.draft;
                        onApplySubject(d.subject);
                        onApplyPreheader(d.preheader);
                        onApplyHtmlContent(d.bodyHtml);
                        if (onApplyAll) {
                          onApplyAll({
                            subject: d.subject,
                            preheader: d.preheader,
                            htmlContent: d.bodyHtml,
                          });
                        }
                        markApplied("all_draft");
                      }}
                      className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
                    >
                      {appliedField === "all_draft" ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-300" />
                          Applied to Campaign!
                        </>
                      ) : (
                        "Apply Full Draft to Campaign"
                      )}
                    </Button>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
                    <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">
                          Subject Line
                        </div>
                        <div className="font-semibold text-slate-900 text-sm">
                          {draftMutation.data.draft.subject}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          onApplySubject(draftMutation.data.draft.subject);
                          markApplied("draft_subj");
                        }}
                        className="h-6 text-[10px] text-indigo-600"
                      >
                        {appliedField === "draft_subj" ? "Applied" : "Apply Subject"}
                      </Button>
                    </div>

                    <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">
                          Preheader
                        </div>
                        <div className="text-slate-600 text-xs">
                          {draftMutation.data.draft.preheader}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          onApplyPreheader(draftMutation.data.draft.preheader);
                          markApplied("draft_pre");
                        }}
                        className="h-6 text-[10px] text-indigo-600"
                      >
                        {appliedField === "draft_pre" ? "Applied" : "Apply Preheader"}
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[10px] uppercase font-bold text-slate-400">
                        Email Body Preview
                      </div>
                      <h3 className="font-bold text-slate-900 text-base">
                        {draftMutation.data.draft.heading}
                      </h3>
                      <div
                        className="prose prose-sm text-slate-600 leading-relaxed text-xs p-3 rounded-lg bg-slate-50 border border-slate-100"
                        dangerouslySetInnerHTML={{
                          __html: draftMutation.data.draft.bodyHtml,
                        }}
                      />
                      <div className="pt-2">
                        <span className="inline-block px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium text-xs shadow-xs">
                          {draftMutation.data.draft.ctaText} &rarr;
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 3: PREHEADERS GENERATOR                          */}
          {/* ==================================================== */}
          {activeTab === "preheaders" && (
            <div className="space-y-4">
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Subject Line Reference
                  </label>
                  <input
                    type="text"
                    placeholder="Enter or paste subject line..."
                    value={preheaderSubject}
                    onChange={(e) => setPreheaderSubject(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white"
                  />
                </div>

                <div className="pt-1 flex justify-end">
                  <Button
                    size="sm"
                    disabled={!preheaderSubject.trim() || preheaderMutation.isPending}
                    onClick={() => preheaderMutation.mutate()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5"
                  >
                    {preheaderMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                    Generate Preheaders
                  </Button>
                </div>
              </div>

              {/* Preheaders Results List */}
              {preheaderMutation.data && (
                <div className="space-y-2 pt-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Preview Text Suggestions:
                  </div>
                  <div className="space-y-2">
                    {preheaderMutation.data.suggestions.map((pre, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all bg-white"
                      >
                        <span className="text-slate-700 pr-3">{pre}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            onApplyPreheader(pre);
                            markApplied(`pre_${idx}`);
                          }}
                          className="h-7 text-[11px] border-indigo-200 text-indigo-700 hover:bg-indigo-100/60 shrink-0 gap-1"
                        >
                          {appliedField === `pre_${idx}` ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600" />
                              Applied!
                            </>
                          ) : (
                            "Apply"
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 4: CAMPAIGN IMPROVER & SPAM RISK                 */}
          {/* ==================================================== */}
          {activeTab === "improve" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-900 text-xs">
                      Live Campaign Content Audit
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Evaluates current subject line, preheader, and email HTML for clarity and spam risk.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={improveMutation.isPending}
                    onClick={() => improveMutation.mutate()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5"
                  >
                    {improveMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    Run Deliverability Audit
                  </Button>
                </div>
              </div>

              {/* Analysis Results Display */}
              {improveMutation.data && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-slate-200 p-3 bg-white">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">
                        Readability
                      </div>
                      <div className="text-xl font-bold text-slate-900 mt-1">
                        {improveMutation.data.analysis.readabilityScore}/100
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-3 bg-white">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">
                        Clarity Grade
                      </div>
                      <div className="text-xl font-bold text-indigo-600 mt-1">
                        {improveMutation.data.analysis.clarityGrade}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-3 bg-white">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">
                        CTA Strength
                      </div>
                      <div className="text-xl font-bold text-slate-900 mt-1">
                        {improveMutation.data.analysis.ctaStrength}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-3 bg-white">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">
                        Spam Risk
                      </div>
                      <div
                        className={`text-xl font-bold mt-1 ${
                          improveMutation.data.analysis.spamRisk.toLowerCase() === "low"
                            ? "text-emerald-600"
                            : improveMutation.data.analysis.spamRisk.toLowerCase() === "medium"
                            ? "text-amber-600"
                            : "text-rose-600"
                        }`}
                      >
                        {improveMutation.data.analysis.spamRisk}
                      </div>
                    </div>
                  </div>

                  {/* Spam Warnings if any */}
                  {improveMutation.data.analysis.spamWarnings &&
                    improveMutation.data.analysis.spamWarnings.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
                        <div className="font-semibold flex items-center gap-1.5 text-rose-900">
                          <AlertTriangle className="h-4 w-4 text-rose-600" />
                          Spam Trigger Warnings:
                        </div>
                        <ul className="list-disc pl-5 space-y-0.5">
                          {improveMutation.data.analysis.spamWarnings.map((w, idx) => (
                            <li key={idx}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {/* Recommendations */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                      Actionable Optimization Suggestions:
                    </div>
                    <div className="space-y-2">
                      {improveMutation.data.analysis.suggestions.map((sug, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100"
                        >
                          <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{sug}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Info className="h-3.5 w-3.5 text-slate-400" />
            <span>AI suggestions populate your campaign fields without overwriting unsaved work.</span>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
