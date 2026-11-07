import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Send, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center gap-2.5 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
            <Send className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">
            MailPilot
          </span>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Email Verification
        </h2>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-center space-y-4">
          {checking ? (
            <div className="py-6 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
              <p className="text-xs text-slate-500">Checking verification status...</p>
            </div>
          ) : isVerified ? (
            <div className="space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Email Verified Successfully!
              </h3>
              <p className="text-xs text-slate-600">
                Your email address is confirmed and your account is fully active.
              </p>
              <Button
                onClick={() => navigate("/", { replace: true })}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm h-10 gap-1.5"
              >
                Enter MailPilot Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <Send className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Awaiting Verification
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Please check your email and click the confirmation link sent by MailPilot. Once confirmed, you can sign in below.
              </p>
              <Link to="/login">
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm h-10">
                  Proceed to Sign In
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

