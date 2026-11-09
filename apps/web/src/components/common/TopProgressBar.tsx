export function TopProgressBar() {
  return (
    <div
      role="progressbar"
      aria-label="Loading progress"
      className="fixed top-0 left-0 right-0 h-[2px] z-[9999] pointer-events-none overflow-hidden bg-indigo-100/40"
    >
      <div className="h-full w-full bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.8)] animate-top-progress" />
    </div>
  );
}
