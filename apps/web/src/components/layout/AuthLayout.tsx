import React from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/Logo";

interface AuthLayoutProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthLayout({
  icon,
  title,
  subtitle,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen w-full flex flex-col justify-center items-center bg-gradient-to-b from-[#BFE3F7] via-[#DFF0FA] to-[#FFFFFF] px-4 py-12 overflow-x-hidden select-none">
      {/* MailPilot Logo Fixed at Top-Left */}
      <Link
        to="/"
        className="fixed top-6 left-6 z-30 flex items-center transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 rounded-xl"
        aria-label="MailPilot Home"
      >
        <Logo size={36} />
      </Link>

      {/* Decorative Concentric Arcs behind the card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[620px] h-[620px] rounded-full border border-white/60"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[860px] h-[860px] rounded-full border border-white/35"
      />

      {/* Soft Cloud Layer at the Bottom */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 right-0 w-full overflow-hidden leading-none z-0"
      >
        <svg
          viewBox="0 0 1440 280"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-32 sm:h-44 md:h-56 object-cover object-bottom"
          preserveAspectRatio="none"
        >
          {/* Back cloud layer */}
          <path
            d="M0 160 C120 140 220 170 340 150 C460 130 540 160 660 140 C780 120 880 150 1000 130 C1120 110 1260 150 1440 130 L1440 280 L0 280 Z"
            fill="#FFFFFF"
            fillOpacity="0.45"
          />
          {/* Middle cloud puffs */}
          <path
            d="M-40 180 C80 150 180 190 300 165 C420 140 520 170 640 150 C760 130 860 165 980 145 C1100 125 1220 165 1480 145 L1480 280 L-40 280 Z"
            fill="#FFFFFF"
            fillOpacity="0.75"
          />
          {/* Front solid cloud layer */}
          <path
            d="M0 200 C140 170 240 210 380 185 C520 160 620 195 760 175 C900 155 1020 190 1160 170 C1300 150 1380 185 1440 175 L1440 280 L0 280 Z"
            fill="#FFFFFF"
          />
        </svg>
      </div>

      {/* Centered Glassmorphic Card */}
      <div className="relative z-10 w-full max-w-[400px] animate-in fade-in slide-in-from-bottom-2 duration-200 motion-reduce:animate-none">
        <div className="rounded-[24px] border border-white/80 bg-white/85 p-7 sm:p-8 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-md">
          {/* Icon Tile */}
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200/60 bg-gradient-to-b from-white to-sky-50/70 shadow-xs text-slate-800">
            {icon}
          </div>

          {/* Heading & Subtext */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 leading-tight">
              {title}
            </h1>
            <p className="mt-1 text-sm text-slate-500 leading-normal">
              {subtitle}
            </p>
          </div>

          {/* Form Content */}
          {children}

          {/* Footer Link */}
          {footer && (
            <div className="mt-5 text-center text-xs text-slate-500">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Standard 4-color Google "G" icon
 */
export function GoogleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

