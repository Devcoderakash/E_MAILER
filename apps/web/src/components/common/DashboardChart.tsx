import { useState, useId } from "react";
import { cn } from "@/lib/utils";
import { BarChart3, Info } from "lucide-react";

interface DataPoint {
  date: string;
  sent: number;
  openRate: number;
  clickRate: number;
}

const sample7D: DataPoint[] = [
  { date: "May 1", sent: 1200, openRate: 42.1, clickRate: 14.2 },
  { date: "May 2", sent: 1900, openRate: 45.3, clickRate: 15.0 },
  { date: "May 3", sent: 800, openRate: 38.0, clickRate: 11.2 },
  { date: "May 4", sent: 2400, openRate: 48.7, clickRate: 16.8 },
  { date: "May 5", sent: 3100, openRate: 51.2, clickRate: 18.1 },
  { date: "May 6", sent: 2700, openRate: 46.5, clickRate: 15.6 },
  { date: "May 7", sent: 3400, openRate: 53.4, clickRate: 19.3 },
];

const sample30D: DataPoint[] = [
  { date: "W1", sent: 8500, openRate: 41.2, clickRate: 13.5 },
  { date: "W2", sent: 12400, openRate: 44.8, clickRate: 14.9 },
  { date: "W3", sent: 15600, openRate: 49.3, clickRate: 17.2 },
  { date: "W4", sent: 19200, openRate: 52.1, clickRate: 18.5 },
];

const sample90D: DataPoint[] = [
  { date: "Month 1", sent: 38000, openRate: 39.5, clickRate: 12.8 },
  { date: "Month 2", sent: 54000, openRate: 46.2, clickRate: 15.7 },
  { date: "Month 3", sent: 72000, openRate: 50.8, clickRate: 17.9 },
];

interface DashboardChartProps {
  className?: string;
}

export function DashboardChart({ className }: DashboardChartProps) {
  const [timeframe, setTimeframe] = useState<"7D" | "30D" | "90D">("7D");
  const [metric, setMetric] = useState<"sent" | "openRate" | "clickRate">("sent");
  const [isDemoView, setIsDemoView] = useState(true);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const gradientId = useId();

  const dataset =
    timeframe === "7D" ? sample7D : timeframe === "30D" ? sample30D : sample90D;

  const data = isDemoView
    ? dataset
    : dataset.map((d) => ({ ...d, sent: 0, openRate: 0, clickRate: 0 }));

  // Dimensions & bounds
  const width = 640;
  const height = 240;
  const paddingX = 40;
  const paddingY = 30;

  const values = data.map((d) => d[metric]);
  const maxValue = Math.max(...values, metric === "sent" ? 1000 : 50);
  const minValue = 0;

  const getX = (idx: number) => {
    if (data.length <= 1) return paddingX;
    return paddingX + (idx / (data.length - 1)) * (width - paddingX * 2);
  };

  const getY = (val: number) => {
    const range = maxValue - minValue || 1;
    const normalized = (val - minValue) / range;
    return height - paddingY - normalized * (height - paddingY * 2);
  };

  // Build SVG Path
  const points = data.map((d, i) => `${getX(i)},${getY(d[metric])}`);
  const linePath = points.length > 0 ? `M ${points.join(" L ")}` : "";

  const areaPath =
    points.length > 0
      ? `M ${getX(0)},${height - paddingY} L ${points.join(" L ")} L ${getX(
          data.length - 1
        )},${height - paddingY} Z`
      : "";

  const metricLabel =
    metric === "sent"
      ? "Emails Sent"
      : metric === "openRate"
      ? "Open Rate (%)"
      : "Click Rate (%)";

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]",
        className
      )}
    >
      {/* Header with Title, Controls, and Demo Switch */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
              Campaign Delivery & Engagement
            </h3>
            {isDemoView ? (
              <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 border border-indigo-200/60">
                <Info className="h-3 w-3" /> Preview
              </span>
            ) : (
              <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200">
                Live (0)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Volume and interaction metrics across recent deliveries.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Metric Selector */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50/80 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setMetric("sent")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                metric === "sent"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              Sent
            </button>
            <button
              type="button"
              onClick={() => setMetric("openRate")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                metric === "openRate"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              Opens
            </button>
            <button
              type="button"
              onClick={() => setMetric("clickRate")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                metric === "clickRate"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              Clicks
            </button>
          </div>

          {/* Timeframe selector */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50/80 p-0.5 text-xs">
            {(["7D", "30D", "90D"] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  timeframe === tf
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Toggle between preview and empty state */}
          <button
            type="button"
            onClick={() => setIsDemoView(!isDemoView)}
            className="text-[11px] text-slate-500 hover:text-indigo-600 underline underline-offset-2 ml-1"
            title="Toggle between sample preview and zero state"
          >
            {isDemoView ? "Show Empty" : "Show Preview"}
          </button>
        </div>
      </div>

      {/* SVG Chart Canvas */}
      <div className="relative mt-4 w-full aspect-[21/9] min-h-[220px]">
        {/* Subtle grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none py-6 px-10">
          <div className="border-b border-slate-100 w-full" />
          <div className="border-b border-slate-100 w-full" />
          <div className="border-b border-slate-100 w-full" />
        </div>

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Base Area Fill */}
          <path d={areaPath} fill={`url(#${gradientId})`} />

          {/* Line Stroke */}
          <path
            d={linePath}
            fill="none"
            stroke="#4f46e5"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points */}
          {data.map((d, i) => {
            const cx = getX(i);
            const cy = getY(d[metric]);
            const isHovered = hoverIndex === i;

            return (
              <g key={i} className="cursor-pointer">
                {/* Invisible hover target */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="18"
                  fill="transparent"
                  onMouseEnter={() => setHoverIndex(i)}
                  onMouseLeave={() => setHoverIndex(null)}
                />
                {/* Visible dot */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? "5.5" : "3.5"}
                  fill="#ffffff"
                  stroke="#4f46e5"
                  strokeWidth={isHovered ? "3" : "2"}
                  className="transition-all duration-150"
                />
              </g>
            );
          })}
        </svg>

        {/* Dynamic Tooltip on Hover */}
        {hoverIndex !== null && data[hoverIndex] && (
          <div
            className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-3 py-2 text-white shadow-lg text-xs"
            style={{
              left: `${(getX(hoverIndex) / width) * 100}%`,
              top: `${(getY(data[hoverIndex][metric]) / height) * 100 - 8}%`,
            }}
          >
            <div className="font-semibold text-slate-200">
              {data[hoverIndex].date}
            </div>
            <div className="mt-0.5 text-indigo-300">
              {metricLabel}:{" "}
              <span className="font-bold text-white">
                {metric === "sent"
                  ? data[hoverIndex].sent.toLocaleString()
                  : `${data[hoverIndex][metric]}%`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* X-Axis Labels */}
      <div className="flex justify-between px-10 text-[11px] font-medium text-slate-400 mt-1">
        {data.map((d, i) => (
          <span key={i} className="text-center">
            {d.date}
          </span>
        ))}
      </div>

      {/* Empty State Banner if 0 */}
      {!isDemoView && (
        <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200/60 text-center">
          <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5 text-slate-400" />
            No broadcast data recorded for this timeframe yet. Send your first campaign to generate analytics.
          </p>
        </div>
      )}
    </div>
  );
}

