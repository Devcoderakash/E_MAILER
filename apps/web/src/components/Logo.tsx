export interface LogoProps {
  variant?: "full" | "icon";
  size?: number;
  theme?: "light" | "dark";
  className?: string;
}

export default function Logo({
  variant = "full",
  size = 32,
  theme = "light",
  className = "",
}: LogoProps) {
  const dark = theme === "dark";
  const body = dark ? "#FFFFFF" : "#4F46E5";
  const fold = dark ? "#C7D2FE" : "#818CF8";
  const flap = dark ? "#4F46E5" : "#FFFFFF";
  const icon = (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="MailPilot"
      className="shrink-0"
    >
      <path
        d="M14 4H38L60 26V50A10 10 0 0 1 50 60H14A10 10 0 0 1 14 4Z"
        fill={body}
      />
      <path d="M38 4V16A10 10 0 0 0 48 26H60Z" fill={fold} />
      <path
        d="M15 34L32 46L49 34"
        fill="none"
        stroke={flap}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (variant === "icon") return <span className={className}>{icon}</span>;

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {icon}
      <span
        className="font-bold tracking-tight leading-none"
        style={{ fontSize: size * 0.6 }}
      >
        <span className={dark ? "text-white" : "text-gray-900"}>Mail</span>
        <span className={dark ? "text-indigo-300" : "text-indigo-600"}>Pilot</span>
      </span>
    </span>
  );
}

export { Logo };
