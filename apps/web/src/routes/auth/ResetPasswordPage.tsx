import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Lock, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { AuthLayout } from "@/components/layout/AuthLayout";

export function ResetPasswordPage() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setGeneralError(null);

    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch {
      setGeneralError("Could not update password. The reset link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout
        icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
        title="Password updated"
        subtitle="Your password has been reset successfully. Redirecting to sign in..."
        footer={
          <Link
            to="/login"
            className="font-medium text-slate-900 hover:text-indigo-600 transition-colors underline-offset-2 hover:underline"
          >
            Sign in now
          </Link>
        }
      >
        <div className="pt-2">
          <Link
            to="/login"
            className="w-full h-11 rounded-xl bg-gradient-to-b from-[#1F2937] to-[#111827] hover:from-[#111827] hover:to-[#0B0F17] text-white font-medium text-sm shadow-xs transition-all flex items-center justify-center"
          >
            Sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={<Lock className="h-5 w-5 text-slate-700" />}
      title="Create new password"
      subtitle="Enter a new password for your MailPilot account."
      footer={
        <Link
          to="/login"
          className="font-medium text-slate-900 hover:text-indigo-600 transition-colors underline-offset-2 hover:underline"
        >
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleUpdatePassword} className="space-y-4" noValidate>
        {generalError && (
          <div className="rounded-xl bg-rose-50 border border-rose-200/80 p-3 text-xs text-rose-700">
            {generalError}
          </div>
        )}

        <div>
          <label htmlFor="new-password" className="sr-only">
            New password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="new-password"
              type={showPassword ? "text" : "password"}
              autoFocus
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              placeholder="New password (min 8 chars)"
              className={`w-full h-11 pl-10 pr-10 text-sm rounded-xl bg-[#F3F4F6] text-slate-900 placeholder-slate-400 border border-transparent transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                passwordError ? "border-rose-300 ring-2 ring-rose-500/10 bg-rose-50/30" : ""
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirm-password" className="sr-only">
            Confirm new password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              placeholder="Confirm new password"
              className={`w-full h-11 pl-10 pr-10 text-sm rounded-xl bg-[#F3F4F6] text-slate-900 placeholder-slate-400 border border-transparent transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                passwordError ? "border-rose-300 ring-2 ring-rose-500/10 bg-rose-50/30" : ""
              }`}
            />
          </div>
          {passwordError && (
            <p className="mt-1.5 text-xs text-rose-600 pl-1">{passwordError}</p>
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
              <span>Updating password...</span>
            </>
          ) : (
            <span>Update password</span>
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
