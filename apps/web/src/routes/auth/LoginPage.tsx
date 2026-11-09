import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { LogIn, Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthLayout, GoogleIcon } from "@/components/layout/AuthLayout";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  // Field-specific validation errors
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const destination = (location.state as any)?.from?.pathname || "/";

  const validateForm = (): boolean => {
    let isValid = true;
    setEmailError(null);
    setPasswordError(null);
    setGeneralError(null);

    const emailTrimmed = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailTrimmed) {
      setEmailError("Please enter your email address.");
      isValid = false;
    } else if (!emailRegex.test(emailTrimmed)) {
      setEmailError("Please enter a valid email address.");
      isValid = false;
    }

    if (!password) {
      setPasswordError("Please enter your password.");
      isValid = false;
    }

    return isValid;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        navigate(destination, { replace: true });
      }
    } catch (err: any) {
      const msg = err.message?.toLowerCase() || "";
      if (
        msg.includes("invalid login credentials") ||
        msg.includes("invalid_grant") ||
        msg.includes("invalid credentials")
      ) {
        setPasswordError("Email or password is incorrect.");
      } else if (msg.includes("email not confirmed")) {
        setGeneralError("Please verify your email address before signing in.");
      } else {
        setGeneralError("Could not sign in. Please verify your details and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoadingGoogle(true);
      setGeneralError(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;
    } catch {
      setGeneralError("Could not connect to Google. Please use email and password.");
      setLoadingGoogle(false);
    }
  };

  return (
    <AuthLayout
      icon={<LogIn className="h-5 w-5 text-slate-700" />}
      title="Welcome back"
      subtitle="Sign in to send campaigns and track results."
      footer={
        <>
          New here?{" "}
          <Link
            to="/signup"
            className="font-medium text-slate-900 hover:text-indigo-600 transition-colors underline-offset-2 hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleLogin} className="space-y-4" noValidate>
        {/* General Error Message */}
        {generalError && (
          <div className="rounded-xl bg-rose-50 border border-rose-200/80 p-3 text-xs text-rose-700">
            {generalError}
          </div>
        )}

        {/* Email Input */}
        <div>
          <label htmlFor="login-email" className="sr-only">
            Email address
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="login-email"
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

        {/* Password Input */}
        <div>
          <label htmlFor="login-password" className="sr-only">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              placeholder="Password"
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
          {passwordError && (
            <p className="mt-1.5 text-xs text-rose-600 pl-1">{passwordError}</p>
          )}

          {/* Forgot Password Link */}
          <div className="mt-2 flex justify-end">
            <Link
              to="/forgot-password"
              className="text-xs text-slate-500 hover:text-slate-900 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {/* Primary Sign In Button */}
        <button
          type="submit"
          disabled={loading || loadingGoogle}
          className="w-full h-11 rounded-xl bg-gradient-to-b from-[#1F2937] to-[#111827] hover:from-[#111827] hover:to-[#0B0F17] text-white font-medium text-sm shadow-xs transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900/20"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-white/80" />
              <span>Signing in...</span>
            </>
          ) : (
            <span>Sign in</span>
          )}
        </button>

        {/* Dotted Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-dashed border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white/95 px-3 text-slate-400">
              or continue with
            </span>
          </div>
        </div>

        {/* Google Sign In Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading || loadingGoogle}
          className="w-full h-11 rounded-xl bg-white hover:bg-slate-50/80 border border-slate-200 text-slate-700 font-medium text-sm shadow-xs transition-colors flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-slate-400/20"
        >
          {loadingGoogle ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
          ) : (
            <GoogleIcon className="h-4 w-4" />
          )}
          <span>Continue with Google</span>
        </button>
      </form>
    </AuthLayout>
  );
}
