/**
 * HOME (light) — the signed-in landing screen.
 *
 * Greeting + this week's lean, three stat cards, two action cards and the
 * three most recent entries. Everything numeric comes from the API:
 *   summary = GET /insights/summary   (refetches on entriesVersion)
 *   recent  = GET /entries?limit=3    (refetches on entriesVersion)
 *
 * Visual spec: web/design/buddy-redesign.reference.html → "SCREEN: HOME".
 */
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router";
import { MessageCircle, PenLine } from "lucide-react";
import { BuddyBlob } from "../components/BuddyBlob";
import { MoodCheckIn } from "../components/MoodCheckIn";
import { EmotionPill } from "../components/EmotionPill";
import { entriesApi, insightsApi } from "../lib/api";
import { dateLine, firstName, formatEntryStamp, greetingFor } from "../lib/constants";
import { moodColor, moodDeep } from "../lib/mood-colors";
import { useStore } from "../lib/store";
import type { EmotionScore, JournalEntry } from "../lib/types";
import { useAsync } from "../lib/useAsync";

// ---------- small local helpers ----------

/** Confirmed emotions, falling back to every emotion when none are confirmed. */
function visibleEmotions(entry: JournalEntry): EmotionScore[] {
  const confirmed = entry.emotions.filter((e) => e.confirmed);
  const list = confirmed.length ? confirmed : entry.emotions;
  // De-dupe by name, keep the entry's order (backend orders by score).
  const seen = new Set<string>();
  return list.filter((e) => {
    const key = e.emotion.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 4px rail: gradient of the first two emotion colors, solid if one, neutral if none. */
function railBackground(emotions: EmotionScore[]): string {
  const [a, b] = emotions;
  if (a && b) return `linear-gradient(${moodColor(a.emotion)}, ${moodColor(b.emotion)})`;
  if (a) return moodColor(a.emotion);
  return moodColor("neutral");
}

/** Loading placeholder block — bg #F1ECE4, radius 12. */
function Skel({ w, h, style, className }: { w?: number | string; h?: number | string; style?: CSSProperties; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{ width: w ?? "100%", height: h ?? 16, maxWidth: "100%", background: "#F1ECE4", borderRadius: 12, ...style }}
    />
  );
}

/** Inline error line with a retry link (used for both async sections). */
function AsyncError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <p className="form-error m-0 flex flex-wrap items-center gap-x-3 gap-y-1" role="status" aria-live="polite">
      <span>{message}</span>
      <button type="button" className="btn-link inline-flex items-center min-h-[44px]" onClick={onRetry}>
        Try again
      </button>
    </p>
  );
}

function StatCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="card-light" style={{ padding: 20 }}>
      <div className="text-[12.5px] font-semibold text-app-faint" style={{ marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const statValue: CSSProperties = { fontSize: 30, fontWeight: 700, lineHeight: 1.2 };

// ---------- screen ----------

export function Home() {
  const { state } = useStore();
  const { user, settings, entriesVersion } = state;

  const summary = useAsync(insightsApi.summary, [entriesVersion]);
  const recent = useAsync(() => entriesApi.list({ limit: 3 }), [entriesVersion]);

  const name = firstName(settings?.display_name, user?.email);
  const s = summary.data;
  const leaning = s?.leaning ?? null;
  const entries = recent.data?.items ?? [];

  // Lean sentence — three shapes depending on what the week looks like.
  let lean: ReactNode = null;
  if (s) {
    if (leaning) {
      lean = (
        <>
          The shape of this week leans toward{" "}
          <b style={{ fontWeight: 700, color: moodDeep(leaning) }}>{leaning}</b>. That's a noticing, not a verdict.
        </>
      );
    } else if (s.total_entries === 0) {
      lean = "Nothing here yet, and that's okay. When you're ready, write a few lines about what's on your mind.";
    } else {
      lean = "No strong lean this week, and that's a valid shape too.";
    }
  }

  return (
    <div className="container-md page anim-fade-up">
      {/* Header row */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="eyebrow text-app-faint" style={{ letterSpacing: ".24em", marginBottom: 8 }}>
            {greetingFor()}
          </p>
          <h1 className="h-display" style={{ fontSize: 36, overflowWrap: "anywhere" }}>
            Hello, {name}.
          </h1>
        </div>
        <span className="text-[13.5px] text-app-faint">{dateLine()}</span>
      </div>

      {/* Lean sentence (on a summary error the stats card below carries the message + retry) */}
      {summary.error && !s ? null : (
        <div style={{ marginTop: 14, maxWidth: 560 }} aria-live="polite">
          {summary.loading && !s ? (
            <div className="flex flex-col gap-2" style={{ paddingTop: 4 }}>
              <Skel h={16} w="100%" />
              <Skel h={16} w="62%" />
            </div>
          ) : (
            <p className="m-0 text-[16.5px] text-app-sub" style={{ lineHeight: 1.6 }}>
              {lean}
            </p>
          )}
        </div>
      )}

      {/* Stats */}
      <section className="grid-3" style={{ marginTop: 28 }} aria-label="This week at a glance" aria-busy={summary.loading} data-tour="home-stats">
        {summary.loading && !s ? (
          <>
            {["Entries this week", "Last 7 days", "Leaning"].map((label) => (
              <StatCard key={label} label={label}>
                <Skel h={36} w={label === "Leaning" ? 120 : 64} />
              </StatCard>
            ))}
          </>
        ) : summary.error && !s ? (
          <div className="card-light" style={{ padding: 20, gridColumn: "1 / -1" }}>
            <AsyncError message={summary.error} onRetry={() => void summary.reload()} />
          </div>
        ) : (
          <>
            <StatCard label="Entries this week">
              <div className="font-display" style={statValue}>
                {s?.entries_this_week ?? 0}
              </div>
            </StatCard>
            <StatCard label="Last 7 days">
              <div className="font-display" style={statValue}>
                {s?.active_days_last_7 ?? 0}{" "}
                <span className="font-sans text-app-sub" style={{ fontSize: 15, fontWeight: 600 }}>
                  {(s?.active_days_last_7 ?? 0) === 1 ? "day" : "days"}
                </span>
              </div>
            </StatCard>
            <StatCard label="Leaning">
              {leaning ? (
                <EmotionPill emotion={leaning} size="md" style={{ marginTop: 4 }} />
              ) : (
                <div className="font-display text-app-faint" style={{ ...statValue, fontSize: 18 }}>
                  None yet
                </div>
              )}
            </StatCard>
          </>
        )}
      </section>

      {/* The lowest-effort way onto the map, above the actions that need writing. */}
      <section style={{ marginTop: 16 }} aria-label="Quick check-in" data-tour="home-checkin">
        <MoodCheckIn />
      </section>

      {/* Actions */}
      <section className="grid-2" style={{ marginTop: 16 }} aria-label="Quick actions">
        <Link
          to="/app/journal"
          className="card-light hoverable flex items-start gap-4"
          style={{ padding: 22, textDecoration: "none", color: "inherit" }}
        >
          <div
            className="grid place-items-center shrink-0"
            style={{
              width: 44,
              height: 44,
              borderRadius: 13,
              background: "color-mix(in oklab, var(--color-acc) 12%, #fff)",
              color: "var(--color-acc-ink)",
            }}
            aria-hidden="true"
          >
            <PenLine size={20} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <h3 className="font-display m-0" style={{ fontSize: 17.5, fontWeight: 600, marginBottom: 3 }}>
              Write something
            </h3>
            <p className="m-0 text-[14px] text-app-sub">A line, a paragraph, whatever's here.</p>
          </div>
        </Link>
        <Link
          to="/app/reflector"
          className="card-light hoverable flex items-start gap-4"
          style={{ padding: 22, textDecoration: "none", color: "inherit" }}
        >
          <div
            className="grid place-items-center shrink-0"
            style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(255,210,63,.14)", color: "#B07A12" }}
            aria-hidden="true"
          >
            <MessageCircle size={20} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <h3 className="font-display m-0" style={{ fontSize: 17.5, fontWeight: 600, marginBottom: 3 }}>
              Talk to the Reflector
            </h3>
            <p className="m-0 text-[14px] text-app-sub">Someone who only listens and asks.</p>
          </div>
        </Link>
      </section>

      {/* Recent */}
      <section style={{ marginTop: 40 }} aria-labelledby="home-recent-heading" aria-busy={recent.loading}>
        <div className="flex items-center justify-between gap-3" style={{ marginBottom: 16 }}>
          <h2 id="home-recent-heading" className="font-display m-0" style={{ fontSize: 20, fontWeight: 600 }}>
            Recent
          </h2>
          <Link to="/app/map" className="btn-link inline-flex items-center min-h-[44px]" style={{ padding: "4px 0" }}>
            See the map
          </Link>
        </div>

        {recent.loading && !recent.data ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card-light flex gap-4" style={{ borderRadius: 16, padding: "18px 20px" }}>
                <Skel w={4} h="auto" style={{ borderRadius: 4, alignSelf: "stretch", minHeight: 56 }} />
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <Skel h={12} w={110} />
                  <Skel h={14} w="100%" />
                  <Skel h={14} w="78%" />
                  <div className="flex gap-1.5" style={{ marginTop: 4 }}>
                    <Skel h={24} w={80} style={{ borderRadius: 999 }} />
                    <Skel h={24} w={72} style={{ borderRadius: 999 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : recent.error && !recent.data ? (
          <div className="card-light" style={{ borderRadius: 16, padding: "18px 20px" }}>
            <AsyncError message={recent.error} onRetry={() => void recent.reload()} />
          </div>
        ) : entries.length === 0 ? (
          <div
            className="card-light flex flex-col items-center text-center"
            style={{ padding: "32px 24px", background: "linear-gradient(135deg, rgba(232,89,12,.05), rgba(255,210,63,.06)), #fff" }}
          >
            <BuddyBlob size={64} follow={false} aria-label="" />
            <p className="font-display m-0" style={{ fontSize: 17.5, fontWeight: 600, marginTop: 14 }}>
              Your first entry is waiting.
            </p>
            <p className="m-0 text-[14px] text-app-sub" style={{ marginTop: 4, maxWidth: 380 }}>
              A line, a paragraph, whatever's here.
            </p>
            <Link to="/app/journal" className="btn btn-acc" style={{ marginTop: 18 }}>
              Write something
            </Link>
          </div>
        ) : (
          <ul className="list-none m-0 p-0 flex flex-col gap-3">
            {entries.map((entry) => {
              const emotions = visibleEmotions(entry);
              return (
                <li key={entry.id} className="card-light flex gap-4" style={{ borderRadius: 16, padding: "18px 20px" }}>
                  <div
                    className="shrink-0"
                    style={{ width: 4, borderRadius: 4, background: railBackground(emotions), alignSelf: "stretch" }}
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-app-faint" style={{ marginBottom: 6 }}>
                      <time dateTime={entry.created_at}>{formatEntryStamp(entry.created_at)}</time>
                    </div>
                    <p
                      className="m-0 text-[14.5px] text-app-ink line-clamp-4"
                      style={{ lineHeight: 1.6, overflowWrap: "anywhere", whiteSpace: "pre-line" }}
                    >
                      {entry.text}
                    </p>
                    {emotions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5" style={{ marginTop: 10 }}>
                        {emotions.map((e) => (
                          <EmotionPill key={e.emotion} emotion={e.emotion} />
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export default Home;
