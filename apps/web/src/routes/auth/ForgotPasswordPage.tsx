import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { KeyRound, Mail, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { AuthLayout } from "@/components/layout/AuthLayout";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setGeneralError(null);
    setSuccessMsg(null);

    const emailTrimmed = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailTrimmed) {
      setEmailError("Please enter your email address.");
      return;
    } else if (!emailRegex.test(emailTrimmed)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(emailTrimmed, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }

      setSuccessMsg("Recovery link sent. Please check your inbox.");
    } catch {
      setGeneralError("Could not send recovery link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={<KeyRound className="h-5 w-5 text-slate-700" />}
      title="Reset your password"
      subtitle="Enter your email and we'll send you a recovery link."
      footer={
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 font-medium text-slate-900 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to sign in</span>
        </Link>
      }
    >
      <form onSubmit={handleReset} className="space-y-4" noValidate>
        {generalError && (
          <div className="rounded-xl bg-rose-50 border border-rose-200/80 p-3 text-xs text-rose-700">
            {generalError}
          </div>
        )}

        {successMsg && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200/80 p-3 text-xs text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <div>
          <label htmlFor="reset-email" className="sr-only">
            Email address
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="reset-email"
              type="email"
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              placeholder="Email address"
              className={`w-full h-11 pl-10 pr-3.5 text-sm rounded-xl bg-[#F3F4F6] text-slate-900 placeholder-slate-400 border border-transparent transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                emailError ? "border-rose-300 ring-2 ring-rose-500/10 bg-rose-50/30" : ""
              }`}
            />
          </div>
          {emailError && (
            <p className="mt-1.5 text-xs text-rose-600 pl-1">{emailError}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-xl bg-gradient-to-b from-[#1F2937] to-[#111827] hover:from-[#111827] hover:to-[#0B0F17] text-white font-medium text-sm shadow-xs transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900/20"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-white/80" />
              <span>Sending recovery link...</span>
            </>
          ) : (
            <span>Send recovery link</span>
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
