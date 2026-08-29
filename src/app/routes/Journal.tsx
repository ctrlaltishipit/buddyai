/**
 * Journal (light) — write, let buddy notice, confirm, save.
 *
 *   writing ─▶ checking (crisis) ─▶ analyzing (consent-gated) ─▶ confirming ─▶ saving ─▶ writing
 *
 * Crisis-flagged text opens the global CrisisModal and is never analyzed or
 * saved. Every list/number below comes from the API; nothing is hardcoded.
 */
import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Mic, Trash2 } from "lucide-react";
import clsx from "clsx";
import { EmotionPill } from "../components/EmotionPill";
import { analyzeApi, crisisApi, entriesApi, errorMessage, insightsApi } from "../lib/api";
import { TEMPLATES, formatEntryStamp, templateById } from "../lib/constants";
import { moodColor, moodDeep, moodLabel } from "../lib/mood-colors";
import { useStore } from "../lib/store";
import { useAsync } from "../lib/useAsync";
import type { AnalyzeResponse, EmotionName, EmotionScore, JournalEntry, TemplateId } from "../lib/types";

type Stage = "writing" | "checking" | "analyzing" | "confirming" | "saving";

/** Feelings a person can add by hand — everything except "neutral". */
const ADDABLE: EmotionName[] = [
  "joy",
  "sadness",
  "anxiety",
  "frustration",
  "gratitude",
  "love",
  "hope",
  "tiredness",
  "shame",
];

/** Templates that pre-fill the editor with a scaffold (copy from the reference). */
const SCAFFOLD: Partial<Record<TemplateId, string>> = {
  gratitude: "1. \n2. \n3. ",
  checkin: "Body:\nMind:\nHeart:",
};

/** The backend accepts at most 8 emotions per entry and 10k characters. */
const MAX_EMOTIONS = 8;
const MAX_CHARS = 10_000;
const QUOTE_CHARS = 220;
const EARLIER_LIMIT = 5;
const MANUAL_SCORE = 0.6;

const SAVE_LABEL: Record<Stage, string> = {
  writing: "Save",
  checking: "Checking…",
  analyzing: "Listening…",
  confirming: "Save",
  saving: "Save",
};

/** Suggestion toggles match the reference: 8px 15px, 13px, 7px gap. */
const TOGGLE_STYLE: CSSProperties = { padding: "8px 15px", fontSize: 13, gap: 7, minHeight: 36 };

/** Word count that ignores scaffold labels ("1.", "Body:") so an untouched template reads as 0. */
function countWords(text: string): number {
  const stripped = text.replace(/^(\d+\.|Body:|Mind:|Heart:)\s*/gm, "").trim();
  return stripped ? stripped.split(/\s+/).length : 0;
}

/** "A", "A and B", "A, B and C" — each name bold in its deep mood color. */
function joinMoods(names: string[]): ReactNode {
  return names.map((name, i) => {
    const sep = i === 0 ? "" : i === names.length - 1 ? " and " : ", ";
    return (
      <span key={name}>
        {sep}
        <b style={{ fontWeight: 700, color: moodDeep(name) }}>{moodLabel(name)}</b>
      </span>
    );
  });
}

/** Vertical rail color for an entry row: a gradient of its confirmed feelings. */
function railFor(emotions: EmotionScore[]): string {
  const colors = emotions.map((e) => moodColor(e.emotion));
  if (colors.length === 0) return "var(--color-app-line)";
  if (colors.length === 1) return colors[0];
  return `linear-gradient(${colors.join(",")})`;
}

export function Journal() {
  const { state, openCrisis, showToast, bumpEntries } = useStore();
  const settings = state.settings;
  const reduceMotion = useReducedMotion();

  // ---------- Editor state ----------
  const [template, setTemplate] = useState<TemplateId>("freeform");
  const [text, setText] = useState("");
  const [stage, setStage] = useState<Stage>("writing");
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  /** Suggested (AI) emotions currently ticked. */
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  /** Emotions the person added by hand ("Add another"). */
  const [manual, setManual] = useState<EmotionName[]>([]);
  /** Set by "Back to writing"; the textarea focuses itself when it remounts (after the stage transition). */
  const wantsFocus = useRef(false);
  const textareaRef = (el: HTMLTextAreaElement | null) => {
    if (el && wantsFocus.current) {
      wantsFocus.current = false;
      el.focus();
    }
  };

  const tpl = templateById(template);
  const scaffold = SCAFFOLD[template] ?? "";
  const trimmed = text.trim();
  const isBlank = trimmed.length === 0 || trimmed === scaffold.trim();
  const busy = stage === "checking" || stage === "analyzing" || stage === "saving";
  const words = useMemo(() => countWords(text), [text]);

  const suggested = useMemo(() => analysis?.emotions ?? [], [analysis]);
  const suggestedNames = useMemo(() => new Set(suggested.map((e) => e.emotion)), [suggested]);
  const available = ADDABLE.filter((n) => !suggestedNames.has(n) && !manual.includes(n));
  const confirmedCount = picked.size + manual.length;
  const atCap = confirmedCount >= MAX_EMOTIONS;
  const quote = trimmed.length > QUOTE_CHARS ? `${trimmed.slice(0, QUOTE_CHARS).trimEnd()}…` : trimmed;

  const pickTemplate = (id: TemplateId) => {
    if (id === template || busy) return;
    const prevScaffold = SCAFFOLD[template] ?? "";
    const untouched = trimmed.length === 0 || trimmed === prevScaffold.trim();
    setTemplate(id);
    // Only the scaffold templates pre-fill; an untouched scaffold is swapped, never someone's words.
    if (stage === "writing" && untouched) setText(SCAFFOLD[id] ?? "");
  };

  const resetSuggestions = () => {
    setAnalysis(null);
    setPicked(new Set());
    setManual([]);
  };

  // ---------- Save: crisis check → (analysis) → confirm ----------
  const handleSave = async () => {
    if (isBlank || busy) return;
    setStage("checking");
    try {
      const check = await crisisApi.check(trimmed, settings?.region ?? "IN");
      if (check.flagged) {
        // Crisis text is never analyzed or saved. Keep what they wrote.
        openCrisis(check.resources, check.matched_phrase);
        setStage("writing");
        return;
      }
      if (!settings?.consent_nlp) {
        resetSuggestions();
        setStage("confirming");
        return;
      }
      setStage("analyzing");
      const result = await analyzeApi.analyze(trimmed);
      if (result.is_crisis_flagged) {
        openCrisis(check.resources, check.matched_phrase);
        setStage("writing");
        return;
      }
      setAnalysis(result);
      setPicked(new Set(result.emotions.map((e) => e.emotion)));
      setManual([]);
      setStage("confirming");
    } catch (err) {
      showToast(errorMessage(err));
      setStage("writing");
    }
  };

  const toggleSuggested = (name: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const addManual = (name: EmotionName) => {
    if (atCap) return;
    setManual((prev) => (prev.includes(name) ? prev : [...prev, name]));
  };

  const removeManual = (name: EmotionName) => {
    setManual((prev) => prev.filter((n) => n !== name));
  };

  const backToWriting = () => {
    wantsFocus.current = true;
    setStage("writing");
    resetSuggestions();
  };

  // ---------- Confirm: create the entry ----------
  const handleConfirm = async () => {
    if (stage === "saving") return;
    let emotions: EmotionScore[] = [
      ...suggested.map<EmotionScore>((e) => ({ ...e, confirmed: picked.has(e.emotion), source: "ai" })),
      ...manual.map<EmotionScore>((m) => ({ emotion: m, score: MANUAL_SCORE, confirmed: true, source: "user" })),
    ];
    // Backend cap: drop un-ticked suggestions first, then trim.
    if (emotions.length > MAX_EMOTIONS) emotions = emotions.filter((e) => e.confirmed);
    if (emotions.length > MAX_EMOTIONS) emotions = emotions.slice(0, MAX_EMOTIONS);

    setStage("saving");
    try {
      await entriesApi.create({ text: trimmed, template, emotions });
      bumpEntries();
      let streak: number | null = null;
      try {
        streak = (await insightsApi.summary()).streak_days;
      } catch {
        /* the entry is saved; the streak line is a bonus */
      }
      showToast(streak === null ? "Saved. Nice noticing." : `Saved. Nice noticing. Day ${streak + 1} starts tomorrow.`);
      setText(scaffold);
      resetSuggestions();
      setStage("writing");
    } catch (err) {
      showToast(errorMessage(err));
      setStage("confirming");
    }
  };

  const onEditorKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSave();
    }
  };

  // ---------- Earlier entries ----------
  const earlier = useAsync(() => entriesApi.list({ limit: EARLIER_LIMIT }), [state.entriesVersion]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await entriesApi.remove(id);
      earlier.setData((prev) =>
        prev ? { ...prev, items: prev.items.filter((e) => e.id !== id), total: Math.max(0, prev.total - 1) } : prev,
      );
      bumpEntries();
      showToast("Entry deleted.");
    } catch (err) {
      showToast(errorMessage(err));
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  const stageStatus =
    stage === "checking" ? "Checking your entry…" : stage === "analyzing" ? "Listening for feelings…" : stage === "saving" ? "Saving your entry…" : "";

  const enter = reduceMotion ? {} : { opacity: 0, y: 8 };
  const exit = reduceMotion ? {} : { opacity: 0, y: -6 };

  return (
    <div className="container-sm page">
      <h1 className="h-display" style={{ fontSize: 32, marginBottom: 6 }}>
        {tpl.prompt}
      </h1>
      <p className="m-0 text-[15px] text-app-sub" style={{ marginBottom: 22 }}>
        No one else will read this.
      </p>

      {/* Template chips */}
      <div className="flex flex-wrap gap-2" style={{ marginBottom: 20 }} role="group" aria-label="Journal template">
        {TEMPLATES.map((t) => {
          const active = t.id === template;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={active}
              disabled={busy}
              onClick={() => pickTemplate(t.id)}
              className="relative after:absolute after:-inset-1 after:content-['']"
              style={{
                padding: "8px 16px",
                minHeight: 36,
                borderRadius: 999,
                border: "none",
                background: active ? "#141210" : "#FFF",
                color: active ? "#FFF" : "var(--color-app-sub)",
                boxShadow: active ? "none" : "inset 0 0 0 1px var(--color-app-line)",
                font: "600 13px var(--font-sans)",
                cursor: busy ? "default" : "pointer",
                transition: "all .15s ease",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {stageStatus}
      </p>

      <AnimatePresence mode="wait" initial={false}>
        {stage === "confirming" || stage === "saving" ? (
          <motion.section
            key="confirming"
            initial={enter}
            animate={{ opacity: 1, y: 0 }}
            exit={exit}
            transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
            aria-label="Confirm feelings"
          >
            <blockquote
              className="m-0"
              style={{
                background: "color-mix(in oklab, var(--color-acc) 5%, #fff)",
                border: "1px solid var(--color-app-line)",
                borderRadius: 16,
                padding: "18px 20px",
                marginBottom: 16,
                fontSize: 14.5,
                fontStyle: "italic",
                lineHeight: 1.65,
                color: "var(--color-app-text)",
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
              }}
            >
              {quote}
            </blockquote>

            <div className="card-light" style={{ padding: 24 }}>
              <p className="m-0" style={{ marginBottom: 16, fontSize: 15, lineHeight: 1.6 }}>
                {suggested.length > 0 ? (
                  <>
                    I'm noticing a little {joinMoods(suggested.map((e) => e.emotion))} in what you wrote. Does that fit, or
                    should I let it go?
                  </>
                ) : (
                  <>I couldn't quite read a feeling in this. Pick any that fit, or save it as-is.</>
                )}
              </p>

              {(suggested.length > 0 || manual.length > 0) && (
                <div className="flex flex-wrap gap-2" style={{ marginBottom: 20 }} role="group" aria-label="Feelings to keep">
                  {suggested.map((e) => {
                    const on = picked.has(e.emotion);
                    return (
                      <EmotionPill
                        key={e.emotion}
                        emotion={e.emotion}
                        filled={on}
                        onClick={() => toggleSuggested(e.emotion)}
                        aria-pressed={on}
                        aria-label={moodLabel(e.emotion)}
                        label={`${moodLabel(e.emotion)} ${on ? "✓" : "×"}`}
                        className="relative after:absolute after:-inset-1 after:content-['']"
                        style={TOGGLE_STYLE}
                      />
                    );
                  })}
                  {manual.map((m) => (
                    <EmotionPill
                      key={`manual-${m}`}
                      emotion={m}
                      filled
                      onClick={() => removeManual(m)}
                      aria-pressed
                      aria-label={moodLabel(m)}
                      label={`${moodLabel(m)} ✓`}
                      className="relative after:absolute after:-inset-1 after:content-['']"
                      style={TOGGLE_STYLE}
                    />
                  ))}
                </div>
              )}

              {available.length > 0 && (
                <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: 20 }}>
                  <span className="text-[12.5px] text-app-faint" style={{ marginRight: 2 }}>
                    Add another:
                  </span>
                  {available.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="chip-light relative after:absolute after:-inset-1.5 after:content-['']"
                      disabled={atCap}
                      title={atCap ? "Up to eight feelings per entry" : undefined}
                      onClick={() => addManual(n)}
                      style={{ padding: "6px 12px", fontSize: 12.5, minHeight: 32, opacity: atCap ? 0.5 : 1, cursor: atCap ? "not-allowed" : "pointer" }}
                    >
                      {moodLabel(n)}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <button
                  type="button"
                  className="btn btn-acc"
                  style={{ padding: "12px 26px" }}
                  disabled={stage === "saving"}
                  aria-busy={stage === "saving"}
                  onClick={handleConfirm}
                >
                  {stage === "saving" && <span className="spinner" aria-hidden="true" style={{ width: 14, height: 14 }} />}
                  {stage === "saving" ? "Saving…" : "Save this entry"}
                </button>
                <button type="button" className="btn-link" style={{ minHeight: 44 }} disabled={stage === "saving"} onClick={backToWriting}>
                  Back to writing
                </button>
              </div>
            </div>
          </motion.section>
        ) : (
          <motion.section
            key="writing"
            initial={enter}
            animate={{ opacity: 1, y: 0 }}
            exit={exit}
            transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
            aria-label="Write"
          >
            <div className="editor-light">
              <textarea
                ref={textareaRef}
                rows={10}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onEditorKey}
                placeholder={tpl.placeholder}
                aria-label="Journal entry"
                maxLength={MAX_CHARS}
                readOnly={busy}
                spellCheck
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3" style={{ marginTop: 18 }}>
              <button
                type="button"
                className="btn btn-soft"
                disabled
                aria-disabled="true"
                title="Voice notes are on the way"
                style={{ padding: "11px 20px", fontSize: 14, gap: 8, minHeight: 44, color: "var(--color-app-faint)", opacity: 1, cursor: "not-allowed" }}
              >
                <Mic size={15} aria-hidden="true" /> Voice · soon
              </button>

              <div className="flex items-center gap-3.5">
                {words > 0 && (
                  <span className="text-[12px] text-app-faint whitespace-nowrap">
                    {words} {words === 1 ? "word" : "words"}
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn-acc"
                  style={{ padding: "12px 30px" }}
                  disabled={isBlank || busy}
                  aria-busy={busy}
                  onClick={handleSave}
                >
                  {busy && <span className="spinner" aria-hidden="true" style={{ width: 14, height: 14 }} />}
                  {SAVE_LABEL[stage]}
                </button>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Earlier entries */}
      <section style={{ marginTop: 40 }} aria-labelledby="journal-earlier">
        <div className="flex items-center justify-between gap-3" style={{ marginBottom: 16 }}>
          <h2 id="journal-earlier" className="font-display m-0" style={{ fontSize: 20, fontWeight: 600 }}>
            Earlier
          </h2>
          {earlier.data && earlier.data.total > EARLIER_LIMIT && (
            <span className="text-[12.5px] text-app-faint">
              Last {EARLIER_LIMIT} of {earlier.data.total}
            </span>
          )}
        </div>

        {earlier.error && (
          <p className="form-error m-0 flex flex-wrap items-center gap-x-3" style={{ marginBottom: 12 }} role="alert">
            <span>{earlier.error}</span>
            <button type="button" className="btn-link" onClick={() => void earlier.reload()}>
              Try again
            </button>
          </p>
        )}

        {earlier.loading && !earlier.data ? (
          <ul className="m-0 p-0 list-none flex flex-col gap-3" aria-busy="true" aria-label="Loading entries">
            {[0, 1, 2].map((i) => (
              <li key={i} className="card-light animate-pulse" style={{ padding: "14px 16px", borderRadius: 16, display: "flex", gap: 14 }}>
                <div className="bg-app-line-2" style={{ width: 4, borderRadius: 4, flexShrink: 0 }} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <div className="bg-app-line-2 rounded" style={{ width: 110, height: 12, marginBottom: 10 }} />
                  <div className="bg-app-line-2 rounded" style={{ width: "92%", height: 14, marginBottom: 6 }} />
                  <div className="bg-app-line-2 rounded" style={{ width: "64%", height: 14 }} />
                </div>
              </li>
            ))}
          </ul>
        ) : earlier.data && earlier.data.items.length === 0 ? (
          <div className="card-light text-center" style={{ padding: "28px 20px" }}>
            <p className="m-0 text-[15px] text-app-sub">Nothing saved yet.</p>
          </div>
        ) : earlier.data ? (
          <ul className="m-0 p-0 list-none flex flex-col gap-3">
            {earlier.data.items.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                confirming={confirmId === entry.id}
                deleting={deletingId === entry.id}
                onAskDelete={() => setConfirmId(entry.id)}
                onKeep={() => setConfirmId(null)}
                onDelete={() => void handleDelete(entry.id)}
              />
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

// ---------- Earlier entry row ----------

interface EntryRowProps {
  entry: JournalEntry;
  confirming: boolean;
  deleting: boolean;
  onAskDelete: () => void;
  onKeep: () => void;
  onDelete: () => void;
}

function EntryRow({ entry, confirming, deleting, onAskDelete, onKeep, onDelete }: EntryRowProps) {
  const confirmed = entry.emotions.filter((e) => e.confirmed);
  const onConfirmKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onKeep();
    }
  };

  return (
    <li className="card-light" style={{ padding: "14px 16px", borderRadius: 16, display: "flex", gap: 14 }}>
      <div aria-hidden="true" style={{ width: 4, borderRadius: 4, flexShrink: 0, background: railFor(confirmed) }} />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-app-faint" style={{ marginBottom: 4 }}>
          {formatEntryStamp(entry.created_at)}
        </div>
        <p
          className="m-0 text-app-ink"
          style={{
            fontSize: 14.5,
            lineHeight: 1.6,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            whiteSpace: "pre-line",
            overflowWrap: "anywhere",
          }}
        >
          {entry.text}
        </p>
        {confirmed.length > 0 && (
          <div className="flex flex-wrap gap-1.5" style={{ marginTop: 8 }}>
            {confirmed.map((e) => (
              <EmotionPill key={e.emotion} emotion={e.emotion} />
            ))}
          </div>
        )}
        {confirming && (
          <div
            className="flex flex-wrap items-center gap-2"
            style={{ marginTop: 12 }}
            role="group"
            aria-label="Confirm delete"
            onKeyDown={onConfirmKey}
          >
            <span className="text-[13px] font-semibold text-app-text" style={{ marginRight: 4 }}>
              Delete this entry?
            </span>
            <button
              type="button"
              className="btn btn-soft danger relative after:absolute after:-inset-0.5 after:content-['']"
              style={{ padding: "8px 16px", fontSize: 13, minHeight: 40 }}
              disabled={deleting}
              aria-busy={deleting}
              onClick={onDelete}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
            <button
              type="button"
              className="btn btn-soft relative after:absolute after:-inset-0.5 after:content-['']"
              style={{ padding: "8px 16px", fontSize: 13, minHeight: 40 }}
              disabled={deleting}
              onClick={onKeep}
              autoFocus
            >
              Keep
            </button>
          </div>
        )}
      </div>
      {!confirming && (
        <button
          type="button"
          aria-label="Delete entry"
          onClick={onAskDelete}
          className={clsx(
            "shrink-0 self-start grid place-items-center rounded-full border-0 bg-transparent cursor-pointer text-app-faint transition-colors",
            "hover:text-care hover:bg-care-soft",
          )}
          style={{ width: 44, height: 44, margin: "-6px -8px -6px 0" }}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

export default Journal;
