"use client";

// 30-day downloads sparkline — minimalist line chart, no axes, no labels.
// Used inside package cards to show trend at a glance. Tooltip on hover
// shows the day + downloads count.

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";

interface SparklineProps {
  data: ReadonlyArray<{ day: string; downloads: number }>;
  color?: string;
  height?: number;
}

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

interface PayloadEntry {
  payload?: { day?: string; downloads?: number };
  value?: number;
}

function SparklineTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: PayloadEntry[];
}) {
  if (!active || !payload?.[0]) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover px-2 py-1 text-xs shadow-sm">
      <div className="font-mono text-muted-foreground">{p?.day}</div>
      <div className="font-semibold">{fmt(p?.downloads ?? 0)} downloads</div>
    </div>
  );
}

export function Sparkline({
  data,
  color = "hsl(var(--primary))",
  height = 40,
}: SparklineProps) {
  if (data.length === 0) {
    return (
      <div
        data-slot="sparkline-empty"
        className="text-[10px] uppercase tracking-wider text-muted-foreground"
        style={{ height }}
      >
        no data
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data as Array<{ day: string; downloads: number }>}>
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={[0, "auto"]} />
        <Tooltip
          cursor={{ stroke: color, strokeWidth: 1, strokeOpacity: 0.3 }}
          content={<SparklineTooltip />}
        />
        <Area
          type="monotone"
          dataKey="downloads"
          stroke={color}
          strokeWidth={1.5}
          fill="url(#spark-fill)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
