/**
 * <EmotionChart /> — the Emotion Map itself: one smooth "thread" per emotion,
 * growing where the user wrote it. Pure SVG, no chart library.
 *
 *   <EmotionChart data={insightsMap} />
 *
 * Geometry mirrors the design reference (viewBox 840×300): gridlines between
 * y=34 and y=272, y ticks at x=30, x labels at y=292, plot area x∈[52, 800].
 * Colors come from lib/mood-colors — the only place emotion color lives.
 */
import { useId } from "react";
import type { InsightsMap } from "../lib/types";
import { moodColor, moodLabel } from "../lib/mood-colors";

export interface EmotionChartProps {
  data: InsightsMap;
  className?: string;
}

// ---------- Geometry (user units; matches the reference SVG) ----------

const VIEW_W = 840;
const VIEW_H = 300;
const PLOT_LEFT = 52;
const PLOT_RIGHT = 800;
const GRID_LEFT = 40;
const GRID_RIGHT = 820;
const Y_TOP = 34;
const Y_BASE = 272;
const Y_SPAN = Y_BASE - Y_TOP; // 238
const X_LABEL_Y = 292;
const Y_LABEL_X = 30;

const GRID_COLOR = "#F1ECE4";
const LABEL_COLOR = "#A39C90";
const FONT = "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif";

interface Pt {
  x: number;
  y: number;
}

function xAt(i: number, n: number): number {
  if (n <= 1) return (PLOT_LEFT + PLOT_RIGHT) / 2;
  return PLOT_LEFT + (i * (PLOT_RIGHT - PLOT_LEFT)) / (n - 1);
}

/** value → y. 0 sits on the baseline (272), y_max on the top gridline (34). */
function yAt(value: number, yMax: number): number {
  const safeMax = yMax > 0 ? yMax : 1;
  const t = Math.min(1, Math.max(0, value) / safeMax);
  return Y_BASE - t * Y_SPAN;
}

const f = (n: number) => (Math.round(n * 10) / 10).toString();

/** Tick label: integers as-is, otherwise one decimal. */
function formatTick(v: number): string {
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

// ---------- Smoothing: monotone cubic Hermite → cubic Bézier ----------
// (Fritsch–Carlson tangents, the same scheme as d3's curveMonotoneX.) Unlike
// plain Catmull-Rom it never overshoots, so a thread that touches zero never
// dips under its own baseline and the area fill stays honest.

function slope3(p0: Pt, p1: Pt, p2: Pt): number {
  const h0 = p1.x - p0.x;
  const h1 = p2.x - p1.x;
  const s0 = (p1.y - p0.y) / (h0 || (h1 < 0 ? -0 : 0));
  const s1 = (p2.y - p1.y) / (h1 || (h0 < 0 ? -0 : 0));
  const p = (s0 * h1 + s1 * h0) / (h0 + h1);
  const m = (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p));
  return Number.isFinite(m) ? m : 0;
}

function slope2(p0: Pt, p1: Pt, t: number): number {
  const h = p1.x - p0.x;
  return h ? (3 * (p1.y - p0.y)) / h - t : t;
}

/** "M … C …" path through `pts` (x strictly increasing). */
function smoothLine(pts: Pt[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${f(pts[0].x)},${f(pts[0].y)}`;
  const n = pts.length;
  const tangents: number[] = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) tangents[i] = slope3(pts[i - 1], pts[i], pts[i + 1]);
  tangents[0] = slope2(pts[0], pts[1], tangents[1]);
  tangents[n - 1] = slope2(pts[n - 2], pts[n - 1], tangents[n - 2]);

  let d = `M${f(pts[0].x)},${f(pts[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = (b.x - a.x) / 3;
    // Clamp control points into the plot band so nothing pokes past the axes.
    const c1y = Math.min(Y_BASE, Math.max(Y_TOP, a.y + dx * tangents[i]));
    const c2y = Math.min(Y_BASE, Math.max(Y_TOP, b.y - dx * tangents[i + 1]));
    d += ` C${f(a.x + dx)},${f(c1y)} ${f(b.x - dx)},${f(c2y)} ${f(b.x)},${f(b.y)}`;
  }
  return d;
}

function areaPath(line: string, pts: Pt[]): string {
  if (!line || pts.length === 0) return "";
  const first = pts[0];
  const last = pts[pts.length - 1];
  return `${line} L${f(last.x)},${f(Y_BASE)} L${f(first.x)},${f(Y_BASE)} Z`;
}

const safeId = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "");

// ---------- Component ----------

export function EmotionChart({ data, className }: EmotionChartProps) {
  const uid = safeId(useId());
  const titleId = `emotion-chart-title-${uid}`;

  const buckets = data.buckets ?? [];
  const series = data.series ?? [];
  const yMax = data.y_max > 0 ? data.y_max : 1;
  const n = buckets.length;
  const noEntries = data.entry_count === 0;
  const noThreads = series.length === 0;
  const empty = noEntries || noThreads;

  const ticks = [0, 1, 2, 3, 4].map((i) => ({
    value: (yMax * i) / 4,
    y: Y_BASE - (i * Y_SPAN) / 4,
  }));

  // Draw least-present first so the most-present thread ends up on top.
  const threads = series
    .map((s) => {
      const id = `grad-${safeId(s.emotion)}-${uid}`;
      const color = moodColor(s.emotion);
      let pts: Pt[] = buckets.map((_, i) => ({ x: xAt(i, n), y: yAt(s.values[i] ?? 0, yMax) }));
      // A single bucket reads as a level line across the range.
      if (pts.length === 1) pts = [{ x: PLOT_LEFT, y: pts[0].y }, { x: PLOT_RIGHT, y: pts[0].y }];
      const line = smoothLine(pts);
      return { emotion: s.emotion, id, color, line, area: areaPath(line, pts) };
    })
    .reverse();

  const names = series.map((s) => moodLabel(s.emotion));
  const listed =
    names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  const title = empty
    ? `Emotion map, ${data.range_label}: no feelings charted yet.`
    : `Emotion map, ${data.range_label}: ${listed}.`;

  const axisOpacity = empty ? 0.55 : 1;
  // Re-plays the entrance whenever the range (or the data behind it) changes.
  const animKey = `${data.range}:${data.start}:${data.entry_count}:${series.map((s) => s.emotion).join("|")}`;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className={className}
      style={{ width: "100%", display: "block", overflow: "visible" }}
      role="img"
      aria-labelledby={titleId}
    >
      <title id={titleId}>{title}</title>
      <defs>
        {threads.map((t) => (
          <linearGradient key={t.id} id={t.id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={t.color} stopOpacity={0} />
          </linearGradient>
        ))}
      </defs>

      {/* Gridlines */}
      <g stroke={GRID_COLOR} opacity={axisOpacity} aria-hidden="true">
        {ticks.map((t) => (
          <line key={t.y} x1={GRID_LEFT} y1={f(t.y)} x2={GRID_RIGHT} y2={f(t.y)} />
        ))}
      </g>

      {/* Y ticks */}
      <g fill={LABEL_COLOR} fontSize={11} fontFamily={FONT} opacity={axisOpacity} aria-hidden="true">
        {ticks.map((t) => (
          <text key={t.y} x={Y_LABEL_X} y={f(t.y + 4)} textAnchor="end">
            {formatTick(t.value)}
          </text>
        ))}
      </g>

      {/* Threads */}
      {!empty && (
        <g key={animKey} className="anim-fade-up">
          {threads.map((t) => (
            <g key={t.id}>
              <path d={t.area} fill={`url(#${t.id})`} />
              <path
                d={t.line}
                fill="none"
                stroke={t.color}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ))}
        </g>
      )}

      {/* Empty state */}
      {empty && (
        <text
          x={(PLOT_LEFT + PLOT_RIGHT) / 2}
          y={(Y_TOP + Y_BASE) / 2 + 5}
          textAnchor="middle"
          fontSize={14}
          fontFamily={FONT}
          fill={LABEL_COLOR}
        >
          {noEntries ? "Your map starts with your first entry." : "Confirm a feeling on an entry and it shows up here."}
        </text>
      )}

      {/* X labels */}
      <g
        fill={LABEL_COLOR}
        fontSize={11}
        fontFamily={FONT}
        textAnchor="middle"
        opacity={axisOpacity}
        aria-hidden="true"
      >
        {buckets.map((b, i) => (
          <text key={`${b.key}-${i}`} x={f(xAt(i, n))} y={X_LABEL_Y}>
            {b.label}
          </text>
        ))}
      </g>
    </svg>
  );
}

export default EmotionChart;
