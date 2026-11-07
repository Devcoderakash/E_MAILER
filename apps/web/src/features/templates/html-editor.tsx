import { useState, useMemo } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Sparkles,
  FileCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface HtmlEditorProps {
  html: string;
  onChange: (html: string) => void;
  onInsertVariable?: (variableTag: string) => void;
}

export function HtmlEditor({
  html,
  onChange,
  onInsertVariable,
}: HtmlEditorProps) {
  const [copied, setCopied] = useState(false);

  // Basic HTML validation check
  const validation = useMemo(() => {
    const errors: string[] = [];

    if (!html.trim()) {
      errors.push("HTML content cannot be empty.");
      return { isValid: false, errors };
    }

    // Check basic balanced tags
    const hasHtmlOpen = /<html[^>]*>/i.test(html);
    const hasHtmlClose = /<\/html>/i.test(html);
    if (hasHtmlOpen !== hasHtmlClose) {
      errors.push("Mismatched <html> tags.");
    }

    const hasBodyOpen = /<body[^>]*>/i.test(html);
    const hasBodyClose = /<\/body>/i.test(html);
    if (hasBodyOpen !== hasBodyClose) {
      errors.push("Mismatched <body> tags.");
    }

    // Check table tags
    const tableOpenCount = (html.match(/<table\b/gi) || []).length;
    const tableCloseCount = (html.match(/<\/table>/gi) || []).length;
    if (tableOpenCount !== tableCloseCount) {
      errors.push(
        `Table tag mismatch: ${tableOpenCount} <table> vs ${tableCloseCount} </table>`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [html]);

  // Line count for code gutter
  const lineCount = useMemo(() => {
    return Math.max(1, html.split("\n").length);
  }, [html]);

  const handleCopy = () => {
    navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple HTML prettifier / indentation
  const handleFormat = () => {
    try {
      let formatted = "";
      const reg = /(>)(<)(\/*)/g;
      const clean = html.replace(reg, "$1\r\n$2$3");
      let pad = 0;

      clean.split("\r\n").forEach((node) => {
        let indent = 0;
        if (node.match(/.+<\/\w[^>]*>$/)) {
          indent = 0;
        } else if (node.match(/^<\/\w/)) {
          if (pad !== 0) {
            pad -= 1;
          }
        } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
          indent = 1;
        } else {
          indent = 0;
        }

        let padding = "";
        for (let i = 0; i < pad; i++) {
          padding += "  ";
        }

        formatted += padding + node + "\r\n";
        pad += indent;
      });

      onChange(formatted.trim());
    } catch {
      // Keep as-is if parsing fails
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[600px] rounded-xl border border-slate-200/90 bg-slate-900 text-slate-100 overflow-hidden shadow-xs">
      {/* Editor Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium text-slate-300">
            <FileCode className="h-4 w-4 text-indigo-400" />
            <span>HTML Source Mode</span>
          </div>

          {/* Validation Pill */}
          {validation.isValid ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/80 border border-emerald-800 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Valid HTML
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-950/80 border border-amber-800 px-2.5 py-0.5 text-[10px] font-semibold text-amber-400">
              <AlertCircle className="h-3 w-3" /> {validation.errors[0]}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Insert Variables */}
          <div className="hidden sm:flex items-center gap-1">
            <span className="text-[10px] text-slate-400 mr-1">Insert:</span>
            {[
              "{{first_name}}",
              "{{last_name}}",
              "{{email}}",
              "{{company}}",
            ].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onInsertVariable?.(v)}
                className="rounded bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 text-[10px] font-mono transition-colors border border-slate-700"
              >
                {v}
              </button>
            ))}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleFormat}
            className="h-7 text-xs text-slate-300 hover:text-white hover:bg-slate-800 gap-1"
          >
            <Sparkles className="h-3 w-3 text-indigo-400" />
            Prettify
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 text-xs text-slate-300 hover:text-white hover:bg-slate-800 gap-1"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      {/* Code Textarea & Gutter */}
      <div className="flex-1 flex overflow-hidden font-mono text-xs leading-relaxed">
        {/* Line Numbers Gutter */}
        <div className="w-12 bg-slate-950/80 border-r border-slate-800 text-slate-600 select-none py-3 text-right pr-3 shrink-0 overflow-hidden font-mono">
          {Array.from({ length: Math.min(500, lineCount) }).map((_, i) => (
            <div key={i} className="leading-6">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          value={html}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="flex-1 w-full bg-slate-900 text-slate-200 p-3 leading-6 border-none resize-none focus:outline-none focus:ring-0 font-mono text-xs selection:bg-indigo-600 selection:text-white overflow-auto"
        />
      </div>

      {/* Validation alert banner if invalid */}
      {!validation.isValid && (
        <div className="p-2.5 bg-amber-950/90 border-t border-amber-800/80 text-[11px] text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{validation.errors.join(" • ")}</span>
          </div>
          <span className="text-[10px] text-amber-400">
            Fix issues to ensure reliable inbox rendering.
          </span>
        </div>
      )}
    </div>
  );
}
