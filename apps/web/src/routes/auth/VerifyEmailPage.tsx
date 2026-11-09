import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Mail, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { AuthLayout } from "@/components/layout/AuthLayout";

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setChecking(false);
      if (session) {
        setIsVerified(true);
      }
    });
  }, []);

  return (
    <AuthLayout
      icon={
        isVerified ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        ) : (
          <Mail className="h-5 w-5 text-slate-700" />
        )
      }
      title={isVerified ? "Email verified" : "Check your inbox"}
      subtitle={
        isVerified
          ? "Your email address is confirmed and your account is ready."
          : "Please click the confirmation link sent to your email address."
      }
      footer={
        <Link
          to="/login"
          className="font-medium text-slate-900 hover:text-indigo-600 transition-colors underline-offset-2 hover:underline"
        >
          Back to sign in
        </Link>
      }
    >
      <div className="space-y-4 pt-2">
        {checking ? (
          <div className="py-6 text-center space-y-3">
            <Loader2 className="h-7 w-7 animate-spin text-slate-700 mx-auto" />
            <p className="text-xs text-slate-500">Checking verification status...</p>
          </div>
        ) : isVerified ? (
          <button
            type="button"
            onClick={() => navigate("/", { replace: true })}
            className="w-full h-11 rounded-xl bg-gradient-to-b from-[#1F2937] to-[#111827] hover:from-[#111827] hover:to-[#0B0F17] text-white font-medium text-sm shadow-xs transition-all flex items-center justify-center gap-2"
          >
            <span>Enter MailPilot Dashboard</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <div className="space-y-3">
            <Link
              to="/login"
              className="w-full h-11 rounded-xl bg-gradient-to-b from-[#1F2937] to-[#111827] hover:from-[#111827] hover:to-[#0B0F17] text-white font-medium text-sm shadow-xs transition-all flex items-center justify-center"
            >
              Proceed to sign in
            </Link>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
