"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * The audience clock — when the readership is awake, against when it actually reads.
 *
 * The publishing decision is a timezone problem disguised as a scheduling one.
 * The audience spans ~14 hours of longitude (Singapore through Los Angeles), so
 * there is no hour that is morning for everyone; picking a slot means choosing
 * who gets it fresh and who finds it eight hours cold. A single "best time to
 * post" number cannot express that trade-off, so this draws it instead.
 *
 * Three layers, deliberately separated:
 *
 *   1. Day/night bands — derived from where readers ARE (their IANA zones,
 *      weighted by how many of them there are). Independent of our behaviour.
 *   2. Volume bars — when reading actually happened. Partly a function of when
 *      we published, so it must never be read as demand on its own.
 *   3. The awake curve — layer 1 as a line, so it can be compared against
 *      layer 2 directly. Where the curve is high and the bars are low is an
 *      unserved window; that gap is the entire point of the chart.
 *
 * Offsets resolve through `Intl.DateTimeFormat`, which carries the full tz
 * database and current DST rules — hand-rolled offset arithmetic gets the
 * March/November edges wrong every year.
 */

export interface AudienceZone {
  tz: string;
  people: number;
  views: number;
}
export interface AudienceHour {
  utcHour: number;
  views: number;
  people: number;
}

/** Local hour (0–23) in `tz` when it is `utcHour` UTC on `ref`'s date. */
function localHourIn(tz: string, utcHour: number, ref: Date): number | null {
  try {
    const d = new Date(
      Date.UTC(
        ref.getUTCFullYear(),
        ref.getUTCMonth(),
        ref.getUTCDate(),
        utcHour,
      ),
    );
    const h = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    }).format(d);
    // Some engines format midnight as "24"; fold it back.
    return Number(h) % 24;
  } catch {
    // An unknown/retired zone name must not take the whole chart down.
    return null;
  }
}

/** Awake = 07:00–22:59 local. Coarse on purpose: this is a reading window, not a sleep study. */
const AWAKE_FROM = 7;
const AWAKE_TO = 23;
const isAwake = (h: number) => h >= AWAKE_FROM && h < AWAKE_TO;

const PAD_L = 44;
const PAD_R = 14;
const PAD_T = 16;
const PAD_B = 30;
const W = 960;
const H = 260;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;
const BAND = PLOT_W / 24;

export function AudienceClock({
  hours,
  zones,
  error,
}: {
  hours: AudienceHour[];
  zones: AudienceZone[];
  error: string | null;
}) {
  // Everything below depends on the viewer's own clock and zone, which the
  // server cannot know. Rendering it during SSR would produce exactly the
  // hydration mismatch this codebase already shipped once (React #418 on
  // /articles), so the timezone-aware layers wait for mount.
  const [mounted, setMounted] = useState(false);
  const [useLocal, setUseLocal] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => setMounted(true), []);

  const viewerTz = mounted
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : "UTC";
  const now = useMemo(() => new Date(), []);

  /** Audience-weighted share awake at each UTC hour, 0–1. */
  const awake = useMemo(() => {
    const total = zones.reduce((s, z) => s + z.people, 0);
    if (!mounted || total === 0) return null;
    return Array.from({ length: 24 }, (_, utcHour) => {
      let up = 0;
      for (const z of zones) {
        const lh = localHourIn(z.tz, utcHour, now);
        if (lh !== null && isAwake(lh)) up += z.people;
      }
      return up / total;
    });
  }, [zones, mounted, now]);

  /** Offset (hours) between the viewer's zone and UTC, for the axis toggle. */
  const viewerOffset = useMemo(() => {
    if (!mounted) return 0;
    const lh = localHourIn(viewerTz, 0, now);
    return lh === null ? 0 : lh;
  }, [viewerTz, mounted, now]);

  const maxViews = Math.max(1, ...hours.map((h) => h.views));

  /** Label for a UTC hour on whichever axis is selected. */
  const axisLabel = (utcHour: number) => {
    const h = useLocal ? (utcHour + viewerOffset) % 24 : utcHour;
    return String(h).padStart(2, "0");
  };

  const best = useMemo(() => {
    if (!awake) return null;
    let bi = 0;
    for (let i = 1; i < 24; i++) if (awake[i] > awake[bi]) bi = i;
    return bi;
  }, [awake]);
  const busiest = useMemo(() => {
    let bi = 0;
    hours.forEach((h, i) => {
      if (h.views > hours[bi].views) bi = i;
    });
    return bi;
  }, [hours]);

  if (error) {
    return (
      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-3 text-[13px] text-[var(--color-ink-3)]">
        Audience clock unavailable — {error}
      </div>
    );
  }

  const totalPeople = zones.reduce((s, z) => s + z.people, 0);

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-line)] p-3">
        <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
          {mounted ? (
            <>
              your zone · {viewerTz} ·{" "}
              {new Intl.DateTimeFormat("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: viewerTz,
              }).format(now)}
            </>
          ) : (
            <>resolving zone…</>
          )}
        </div>
        <button
          type="button"
          onClick={() => setUseLocal((v) => !v)}
          className="rounded-md border border-[var(--color-line)] px-2 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-ink-2)] hover:text-[var(--color-ink-1,inherit)]"
        >
          axis: {useLocal ? "your local time" : "UTC"}
        </button>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
          aria-label="Audience awake share and reading volume by hour">
          <defs>
            <linearGradient id="ac-vol" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.85" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.25" />
            </linearGradient>
          </defs>

          {/* Layer 1 — day/night. Opacity IS the data: darker = more of the
              audience asleep at that UTC hour. */}
          {Array.from({ length: 24 }, (_, i) => {
            const a = awake ? awake[i] : 0;
            return (
              <rect
                key={`band-${i}`}
                x={PAD_L + i * BAND}
                y={PAD_T}
                width={BAND}
                height={PLOT_H}
                fill="var(--color-warn)"
                opacity={awake ? 0.04 + a * 0.16 : 0.03}
              />
            );
          })}

          {/* Horizontal guides */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line
              key={`g-${t}`}
              x1={PAD_L}
              x2={W - PAD_R}
              y1={PAD_T + PLOT_H * (1 - t)}
              y2={PAD_T + PLOT_H * (1 - t)}
              stroke="var(--color-line)"
              strokeWidth="1"
              opacity="0.5"
            />
          ))}

          {/* Layer 2 — observed reading volume */}
          {hours.map((h, i) => {
            const bh = (h.views / maxViews) * PLOT_H;
            return (
              <rect
                key={`bar-${i}`}
                x={PAD_L + i * BAND + BAND * 0.22}
                y={PAD_T + PLOT_H - bh}
                width={BAND * 0.56}
                height={bh}
                fill="url(#ac-vol)"
                rx="2"
              />
            );
          })}

          {/* Layer 3 — audience-awake curve */}
          {awake && (
            <polyline
              fill="none"
              stroke="var(--color-good)"
              strokeWidth="2"
              strokeLinejoin="round"
              points={awake
                .map(
                  (a, i) =>
                    `${PAD_L + i * BAND + BAND / 2},${PAD_T + PLOT_H * (1 - a)}`,
                )
                .join(" ")}
            />
          )}

          {/* Crosshair */}
          {hover !== null && (
            <line
              x1={PAD_L + hover * BAND + BAND / 2}
              x2={PAD_L + hover * BAND + BAND / 2}
              y1={PAD_T}
              y2={PAD_T + PLOT_H}
              stroke="var(--color-ink-3)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}

          {/* Axes */}
          {[0, 0.5, 1].map((t) => (
            <text
              key={`yl-${t}`}
              x={PAD_L - 8}
              y={PAD_T + PLOT_H * (1 - t) + 4}
              textAnchor="end"
              className="fill-[var(--color-ink-3)]"
              style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}
            >
              {Math.round(t * 100)}%
            </text>
          ))}
          {hours.map((h, i) =>
            i % 3 === 0 ? (
              <text
                key={`xl-${i}`}
                x={PAD_L + i * BAND + BAND / 2}
                y={H - 10}
                textAnchor="middle"
                className="fill-[var(--color-ink-3)]"
                style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}
              >
                {axisLabel(h.utcHour)}
              </text>
            ) : null,
          )}

          {/* Hit targets last so they sit on top */}
          {hours.map((_, i) => (
            <rect
              key={`hit-${i}`}
              x={PAD_L + i * BAND}
              y={PAD_T}
              width={BAND}
              height={PLOT_H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>

        {/* Hover readout — the same instant across every major reader zone. */}
        {mounted && hover !== null && (
          <div className="pointer-events-none absolute right-3 top-3 w-64 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] p-3 shadow-lg">
            <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
              {String(hover).padStart(2, "0")}:00 UTC
            </div>
            <div className="mt-1 text-[13px]">
              <b>{Math.round((awake?.[hover] ?? 0) * 100)}%</b> of readers awake
              {" · "}
              <span className="text-[var(--color-ink-3)]">
                {hours[hover]?.views ?? 0} views
              </span>
            </div>
            <div className="mt-2 flex flex-col gap-1">
              {zones.slice(0, 6).map((z) => {
                const lh = localHourIn(z.tz, hover, now);
                return (
                  <div
                    key={z.tz}
                    className="flex items-center justify-between gap-2 text-[12px]"
                  >
                    <span className="truncate text-[var(--color-ink-2)]">
                      {z.tz.split("/").pop()?.replace(/_/g, " ")}
                    </span>
                    <span
                      className={
                        lh !== null && isAwake(lh)
                          ? "font-mono tabular-nums text-[var(--color-good)]"
                          : "font-mono tabular-nums text-[var(--color-ink-3)]"
                      }
                    >
                      {lh === null ? "—" : String(lh).padStart(2, "0")}:00
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <p className="border-t border-[var(--color-line)] p-3 text-[12.5px] text-[var(--color-ink-3)]">
        {mounted && best !== null ? (
          <>
            Readership peaks awake at{" "}
            <b className="text-[var(--color-ink-2)]">
              {String(best).padStart(2, "0")}:00 UTC
            </b>{" "}
            ({Math.round((awake?.[best] ?? 0) * 100)}% of {totalPeople} readers),
            but most reading happens at{" "}
            <b className="text-[var(--color-ink-2)]">
              {String(busiest).padStart(2, "0")}:00 UTC
            </b>
            . Bars are when people read — which partly reflects when we posted.
            The green curve is when they are simply awake, and owes us nothing.
            Publish into the gap.
            {" "}
            <span className="text-[var(--color-ink-3)]">
              A reader is someone with 2+ pageviews in 90 days; single-hit
              crawlers are excluded, and they were ~46% of the raw count.
            </span>
            {totalPeople < 100 && (
              <>
                {" "}
                <b className="text-[var(--color-warn)]">
                  Small sample ({totalPeople}) — treat the shape as directional,
                  not decisive.
                </b>
              </>
            )}
          </>
        ) : (
          <>Resolving reader timezones…</>
        )}
      </p>
    </div>
  );
}
