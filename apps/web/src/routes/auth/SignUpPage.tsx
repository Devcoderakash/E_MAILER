import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { UserPlus, User, Mail, Lock, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { AuthLayout, GoogleIcon } from "@/components/layout/AuthLayout";

export function SignUpPage() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  // Field errors
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const [signedUpEmail, setSignedUpEmail] = useState<string | null>(null);

  const validateForm = (): boolean => {
    let isValid = true;
    setNameError(null);
    setEmailError(null);
    setPasswordError(null);
    setGeneralError(null);

    if (!name.trim()) {
      setNameError("Please enter your name.");
      isValid = false;
    }

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
      setPasswordError("Please enter a password.");
      isValid = false;
    } else if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      isValid = false;
    }

    return isValid;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name.trim(),
            full_name: name.trim(),
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        throw error;
      }

      // If session exists immediately
      if (data.session) {
        navigate("/", { replace: true });
        return;
      }

      // Otherwise show email check prompt
      setSignedUpEmail(email.trim());
    } catch (err: any) {
      const msg = err.message?.toLowerCase() || "";
      if (msg.includes("already registered") || msg.includes("already exists")) {
        setEmailError("An account with this email already exists.");
      } else if (msg.includes("weak_password") || msg.includes("at least 8")) {
        setPasswordError("Password must be at least 8 characters.");
      } else {
        setGeneralError("Could not create account. Please check your details and try again.");
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
      setGeneralError("Could not connect with Google. Please use email and password.");
      setLoadingGoogle(false);
    }
  };

  if (signedUpEmail) {
    return (
      <AuthLayout
        icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
        title="Check your email"
        subtitle={`We sent a confirmation link to ${signedUpEmail}. Click the link to complete your sign up.`}
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
          <Link
            to="/login"
            className="w-full h-11 rounded-xl bg-gradient-to-b from-[#1F2937] to-[#111827] hover:from-[#111827] hover:to-[#0B0F17] text-white font-medium text-sm shadow-xs transition-all flex items-center justify-center"
          >
            Go to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={<UserPlus className="h-5 w-5 text-slate-700" />}
      title="Create an account"
      subtitle="Sign up to send campaigns and track results."
      footer={
        <>
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-slate-900 hover:text-indigo-600 transition-colors underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSignUp} className="space-y-4" noValidate>
        {/* General Error Message */}
        {generalError && (
          <div className="rounded-xl bg-rose-50 border border-rose-200/80 p-3 text-xs text-rose-700">
            {generalError}
          </div>
        )}

        {/* Full Name */}
        <div>
          <label htmlFor="signup-name" className="sr-only">
            Full name
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="signup-name"
              type="text"
              autoFocus
              autoComplete="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              placeholder="Full name"
              className={`w-full h-11 pl-10 pr-3.5 text-sm rounded-xl bg-[#F3F4F6] text-slate-900 placeholder-slate-400 border border-transparent transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                nameError ? "border-rose-300 ring-2 ring-rose-500/10 bg-rose-50/30" : ""
              }`}
            />
          </div>
          {nameError && (
            <p className="mt-1.5 text-xs text-rose-600 pl-1">{nameError}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="signup-email" className="sr-only">
            Email address
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="signup-email"
              type="email"
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

        {/* Password */}
        <div>
          <label htmlFor="signup-password" className="sr-only">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
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
          <div className="mt-1.5 flex items-center justify-between text-xs">
            {passwordError ? (
              <p className="text-rose-600 pl-1">{passwordError}</p>
            ) : (
              <p className="text-slate-400 pl-1">At least 8 characters</p>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || loadingGoogle}
          className="w-full h-11 rounded-xl bg-gradient-to-b from-[#1F2937] to-[#111827] hover:from-[#111827] hover:to-[#0B0F17] text-white font-medium text-sm shadow-xs transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900/20"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-white/80" />
              <span>Creating account...</span>
            </>
          ) : (
            <span>Create account</span>
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

        {/* Google Sign In */}
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
