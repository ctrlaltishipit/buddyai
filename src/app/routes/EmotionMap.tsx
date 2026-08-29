/**
 * /app/map — "The shape of your feelings."
 * Light-surface screen: range picker, the Emotion Map chart, a legend, three
 * insight cards, the emotion mix + noticings, and a gentle footer.
 * Everything on screen comes from GET /insights/map (see lib/api.ts).
 */
import { useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { insightsApi } from "../lib/api";
import { useStore } from "../lib/store";
import { useAsync } from "../lib/useAsync";
import { moodColor, moodLabel } from "../lib/mood-colors";
import type { InsightsMap, MapRange } from "../lib/types";
import { EmotionChart } from "../components/EmotionChart";
import { EmotionPill } from "../components/EmotionPill";

const RANGES: Array<{ id: MapRange; label: string }> = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

const LINE_2 = "#F1ECE4";
const FAINT = "var(--color-app-faint)";
const SUB = "var(--color-app-sub)";
const TEXT = "var(--color-app-text)";
const INK = "var(--color-app-ink)";

const cardTitle: CSSProperties = {
  margin: "0 0 14px",
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: 16,
  color: INK,
};

// ---------- Skeleton ----------

function Bone({
  h,
  w = "100%",
  r = 10,
  style,
}: {
  h: number;
  w?: number | string;
  r?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      className="animate-pulse"
      style={{ height: h, width: w, borderRadius: r, background: LINE_2, ...style }}
    />
  );
}

function MapSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading your map…</span>
      <div className="card-light" style={{ borderRadius: 20, padding: 24 }}>
        <Bone h={300} r={14} />
      </div>
      <div className="flex flex-wrap gap-2" style={{ marginTop: 18 }}>
        <Bone h={30} w={78} r={999} />
        <Bone h={30} w={94} r={999} />
        <Bone h={30} w={96} r={999} />
      </div>
      <div className="grid-3" style={{ marginTop: 20 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="card-light" style={{ padding: 20 }}>
            <Bone h={12} w={96} r={6} />
            <Bone h={22} w={120} r={8} style={{ marginTop: 12 }} />
            <Bone h={12} w="80%" r={6} style={{ marginTop: 10 }} />
          </div>
        ))}
      </div>
      <div className="grid-2" style={{ marginTop: 16, alignItems: "start" }}>
        <div className="card-light" style={{ padding: 22 }}>
          <Bone h={16} w={110} r={6} />
          <Bone h={12} r={999} style={{ marginTop: 16 }} />
          <Bone h={14} r={6} style={{ marginTop: 16 }} />
          <Bone h={14} r={6} style={{ marginTop: 12 }} />
          <Bone h={14} r={6} style={{ marginTop: 12 }} />
        </div>
        <div className="card-light" style={{ padding: 22 }}>
          <Bone h={16} w={96} r={6} />
          <Bone h={12} w="70%" r={6} style={{ marginTop: 10 }} />
          <Bone h={40} r={8} style={{ marginTop: 16 }} />
          <Bone h={40} r={8} style={{ marginTop: 10 }} />
        </div>
      </div>
    </div>
  );
}

// ---------- Pieces ----------

function InsightCards({ data }: { data: InsightsMap }) {
  if (!data.cards || data.cards.length === 0) return null;
  return (
    <div className="grid-3" style={{ marginTop: 20 }}>
      {data.cards.map((card, i) => (
        <div key={`${card.label}-${i}`} className="card-light" style={{ padding: 20 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: ".08em",
              color: FAINT,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            {card.label}
          </div>
          <div className="flex items-center" style={{ gap: 9 }}>
            <span
              aria-hidden="true"
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: card.emotion ? moodColor(card.emotion) : "#ECE6DC",
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: 20,
                color: INK,
                minWidth: 0,
                overflowWrap: "anywhere",
              }}
            >
              {card.value}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: SUB, marginTop: 5, lineHeight: 1.5 }}>{card.sub}</div>
        </div>
      ))}
    </div>
  );
}

function EmotionMix({ data }: { data: InsightsMap }) {
  const mix = (data.mix ?? []).filter((m) => m.pct > 0);
  return (
    <div className="card-light" style={{ padding: 22 }}>
      <h2 style={cardTitle}>Emotion mix</h2>
      <div
        aria-hidden="true"
        style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", gap: 2, marginBottom: 14 }}
      >
        {mix.length === 0 ? (
          <div style={{ flex: "1 1 0%", background: LINE_2 }} />
        ) : (
          mix.map((m) => (
            <div
              key={m.emotion}
              style={{ flex: `${m.pct} 1 0%`, background: moodColor(m.emotion), transition: "flex-grow .4s ease" }}
            />
          ))
        )}
      </div>
      {mix.length === 0 ? (
        <p style={{ margin: 0, padding: "7px 0", fontSize: 13.5, color: SUB, lineHeight: 1.5 }}>
          Nothing confirmed yet. Confirm a feeling when you save an entry and it lands here.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {mix.map((m) => (
            <li
              key={m.emotion}
              className="flex items-center justify-between"
              style={{ padding: "7px 0", borderBottom: `1px solid ${LINE_2}` }}
            >
              <span className="inline-flex items-center" style={{ gap: 8, fontSize: 13.5, fontWeight: 600, color: TEXT }}>
                <span className="dot" aria-hidden="true" style={{ background: moodColor(m.emotion) }} />
                {moodLabel(m.emotion)}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>
                {m.pct}%
              </span>
            </li>
          ))}
        </ul>
      )}
      <div style={{ fontSize: 11.5, color: FAINT, marginTop: 10 }}>
        Share of confirmed feelings, {data.range_label}.
      </div>
    </div>
  );
}

function Noticings({ data }: { data: InsightsMap }) {
  const items = data.noticings ?? [];
  return (
    <div className="card-light" style={{ padding: 22 }}>
      <h2 style={{ ...cardTitle, margin: "0 0 4px" }}>Noticings</h2>
      <div style={{ fontSize: 11.5, color: FAINT, marginBottom: 12 }}>
        Patterns buddy spotted. Take or leave them.
      </div>
      {items.length === 0 ? (
        <p style={{ margin: 0, padding: "9px 0", fontSize: 13.5, lineHeight: 1.6, color: TEXT }}>
          Nothing to notice yet. A few more entries and patterns start to show.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((n, i) => (
            <li
              key={`${i}-${n.slice(0, 24)}`}
              className="flex"
              style={{
                gap: 10,
                padding: "9px 0",
                borderBottom: `1px solid ${LINE_2}`,
                fontSize: 13.5,
                lineHeight: 1.6,
                color: TEXT,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  flexShrink: 0,
                  width: 22,
                  height: 22,
                  borderRadius: 8,
                  background: "color-mix(in oklab, var(--color-acc) 11%, #fff)",
                  color: "var(--color-acc-ink)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 12,
                  marginTop: 1,
                }}
              >
                ✦
              </span>
              <span style={{ minWidth: 0 }}>{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MapBody({ data }: { data: InsightsMap }) {
  const empty = data.entry_count === 0;
  return (
    <div className="anim-fade-up" style={{ animationDuration: ".5s" }}>
      <div className="card-light" style={{ borderRadius: 20, padding: 24 }}>
        {/* On phones the chart keeps its proportions and scrolls inside the card. */}
        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
          <EmotionChart data={data} className="min-w-[640px] md:min-w-0" />
        </div>
        {empty && (
          <div className="flex justify-center" style={{ marginTop: 4 }}>
            <Link
              to="/app/journal"
              className="btn-link"
              style={{ display: "inline-flex", alignItems: "center", minHeight: 44, padding: "4px 12px", textDecoration: "none" }}
            >
              Write something
            </Link>
          </div>
        )}
      </div>

      {data.series.length > 0 && (
        <ul className="flex flex-wrap gap-2" style={{ listStyle: "none", margin: "18px 0 0", padding: 0 }} aria-label="Emotions on the map">
          {data.series.map((s) => (
            <li key={s.emotion}>
              <EmotionPill emotion={s.emotion} size="md" style={{ fontSize: 13, fontWeight: 600, padding: "6px 14px", gap: 8 }} />
            </li>
          ))}
        </ul>
      )}

      <InsightCards data={data} />

      <div className="grid-2" style={{ marginTop: 16, alignItems: "start" }}>
        <EmotionMix data={data} />
        <Noticings data={data} />
      </div>
    </div>
  );
}

// ---------- Screen ----------

export function EmotionMap() {
  const { state } = useStore();
  const [range, setRange] = useState<MapRange>("week");
  const map = useAsync<InsightsMap>(() => insightsApi.map(range), [range, state.entriesVersion]);

  const showSkeleton = map.loading && !map.data;
  const showError = !!map.error && !map.data;

  return (
    <div className="container-md page" style={{ color: INK }}>
      <header
        className="flex flex-wrap items-end justify-between"
        style={{ gap: 16, marginBottom: 26 }}
      >
        <div style={{ minWidth: 0 }}>
          <h1 className="h-display" style={{ fontSize: 32, margin: "0 0 6px" }}>
            The shape of your feelings.
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: SUB }}>Each thread is one emotion, growing where you wrote it.</p>
        </div>
        <div className="seg" role="group" aria-label="Time range">
          {RANGES.map((r) => {
            const active = r.id === range;
            return (
              <button
                key={r.id}
                type="button"
                data-active={active ? "true" : "false"}
                aria-pressed={active}
                onClick={() => setRange(r.id)}
                style={{ position: "relative" }}
              >
                {r.label}
                {/* Invisible vertical hit-area extension → ≥44px tap target without changing the look. */}
                <span aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: -6, bottom: -6 }} />
              </button>
            );
          })}
        </div>
      </header>

      {showSkeleton && <MapSkeleton />}

      {showError && (
        <div className="card-light" style={{ borderRadius: 20, padding: 24 }} role="alert">
          <p className="form-error" style={{ marginTop: 0 }}>
            {map.error}
          </p>
          <button
            type="button"
            className="btn-link"
            onClick={() => void map.reload()}
            style={{ display: "inline-flex", alignItems: "center", minHeight: 44 }}
          >
            Try again
          </button>
        </div>
      )}

      {map.data && (
        <div
          aria-busy={map.loading}
          style={{ opacity: map.loading ? 0.6 : 1, transition: "opacity .2s ease" }}
        >
          {map.error && (
            <p className="form-error" role="alert" style={{ marginTop: 0, marginBottom: 12 }}>
              {map.error}{" "}
              <button type="button" className="btn-link" onClick={() => void map.reload()}>
                Try again
              </button>
            </p>
          )}
          <MapBody data={map.data} />
        </div>
      )}

      <p style={{ margin: "28px 0 0", fontSize: 12.5, color: FAINT, maxWidth: 560, lineHeight: 1.6 }}>
        This shape is a noticing, not a diagnosis. Some weeks are heavier than others. Your feelings about that are
        valid too.
      </p>
    </div>
  );
}

export default EmotionMap;
