import { useState } from "react";
import {
  Monitor,
  Smartphone,
  X,
  Mail,
  Users,
  Eye,
} from "lucide-react";
import { interpolateVariables } from "./compiler";
import { SampleMergeVariables } from "./types";

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  html: string;
  subject?: string;
  preheader?: string;
  templateName: string;
}

const DEFAULT_SAMPLE_VARS: SampleMergeVariables = {
  first_name: "Jane",
  last_name: "Doe",
  email: "jane.doe@acme.com",
  company: "Acme Corporation",
};

export function PreviewModal({
  isOpen,
  onClose,
  html,
  subject,
  preheader,
  templateName,
}: PreviewModalProps) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [useSampleData, setUseSampleData] = useState(true);
  const [sampleVars] = useState<SampleMergeVariables>(DEFAULT_SAMPLE_VARS);

  if (!isOpen) return null;

  // Rendered HTML with or without variable interpolation
  const displayedHtml = useSampleData
    ? interpolateVariables(html, sampleVars)
    : html;

  const displayedSubject = useSampleData
    ? interpolateVariables(subject || "No Subject Line", sampleVars)
    : subject || "No Subject Line";

  const displayedPreheader = useSampleData
    ? interpolateVariables(preheader || "", sampleVars)
    : preheader || "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="flex flex-col w-full max-w-4xl h-[90vh] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Preview: {templateName}
            </h3>
          </div>

          {/* Controls: Device & Sample Variable Toggles */}
          <div className="flex items-center gap-2">
            {/* Desktop / Mobile toggle */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setDevice("desktop")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-colors ${
                  device === "desktop"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Monitor className="h-3.5 w-3.5" />
                Desktop
              </button>
              <button
                type="button"
                onClick={() => setDevice("mobile")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-colors ${
                  device === "mobile"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                Mobile
              </button>
            </div>

            {/* Merge data toggle */}
            <button
              type="button"
              onClick={() => setUseSampleData(!useSampleData)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                useSampleData
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
              title="Toggle dynamic merge variable test preview"
            >
              <Users className="h-3.5 w-3.5" />
              <span>{useSampleData ? "Sample Data" : "Raw Tags"}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded ml-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Realistic Email Client Header Simulation */}
        <div className="border-b border-slate-200 px-6 py-3 bg-white text-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-indigo-600" />
              <span>
                From: <span className="font-semibold text-slate-800">MailPilot Team &lt;noreply@mailpilot.io&gt;</span>
              </span>
            </div>
            <span className="text-[11px] text-slate-400">Just now</span>
          </div>

          <div className="text-sm font-semibold text-slate-900 line-clamp-1">
            Subject: {displayedSubject}
          </div>

          {displayedPreheader && (
            <div className="text-xs text-slate-500 line-clamp-1">
              Preheader: {displayedPreheader}
            </div>
          )}
        </div>

        {/* Viewport Frame */}
        <div className="flex-1 bg-slate-100 overflow-y-auto p-4 sm:p-6 flex items-start justify-center">
          {device === "desktop" ? (
            <div className="w-full max-w-[660px] bg-white rounded-xl shadow-md border border-slate-200/90 overflow-hidden">
              <iframe
                title="Email Desktop Preview"
                srcDoc={displayedHtml}
                className="w-full min-h-[540px] border-none"
              />
            </div>
          ) : (
            /* Mobile 375px Device Frame */
            <div className="w-[375px] bg-slate-900 rounded-[36px] p-3 shadow-2xl border-4 border-slate-800">
              {/* Speaker / Camera notch */}
              <div className="h-4 w-32 bg-slate-800 rounded-full mx-auto mb-2" />
              <div className="bg-white rounded-[26px] overflow-hidden">
                <iframe
                  title="Email Mobile Preview"
                  srcDoc={displayedHtml}
                  className="w-full h-[540px] border-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
