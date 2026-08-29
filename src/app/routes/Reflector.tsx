/**
 * SCREEN: REFLECTOR (light) — /app/reflector
 *
 * A quiet, single-column chat with the Reflector: it listens and asks,
 * never tells. The conversation lives ONLY in component state — it is never
 * persisted anywhere (a product promise, restated in the footer).
 *
 * Send flow for a message `t`:
 *   1. POST /crisis-check → if flagged: open the global crisis modal, append the
 *      safety message, and STOP (the Reflector is never called).
 *   2. POST /reflector with the prior history + a one-time "leaning" from
 *      /insights/summary (failure ignored). If the reply asks for a crisis
 *      redirect, fetch resources via /crisis-check and open the modal.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { BuddyBlob } from "../components/BuddyBlob";
import { crisisApi, errorMessage, insightsApi, reflectorApi } from "../lib/api";
import { companionById } from "../lib/constants";
import { useStore } from "../lib/store";
import type { ReflectorMessage } from "../lib/types";

/** Starter prompts — copy verbatim from the design reference. */
const STARTERS = [
  "I keep replaying a meeting from Friday",
  "Today was actually kind of good",
  "I can't focus and I don't know why",
];

/** Shown instead of a reflection when /crisis-check flags the message. */
const CRISIS_REPLY =
  "What you just shared sounds really hard. Before we go further, I want to make sure you can reach someone who's trained to help right now.";

/** The backend accepts at most 40 history items per turn. */
const HISTORY_LIMIT = 40;

const ENTER_ANIM = "fade-up .3s ease both";
const IRIS = "#FF7A1A";

function nowIso() {
  return new Date().toISOString();
}

function prefersReducedMotion() {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    return false;
  }
}

export function Reflector() {
  const { state, openCrisis, showToast } = useStore();
  const settings = state.settings;
  const companion = companionById(settings?.companion);
  const region = settings?.region ?? "IN";

  const [messages, setMessages] = useState<ReflectorMessage[]>([]);
  const [input, setInput] = useState("");
  const [waiting, setWaiting] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const leaningRef = useRef<string | null>(null);
  const aliveRef = useRef(true);

  // One-time "leaning" (dominant emotion this week) to color the Reflector's
  // tone. Purely additive — any failure is ignored and leaning stays null.
  useEffect(() => {
    aliveRef.current = true;
    insightsApi
      .summary()
      .then((s) => {
        if (aliveRef.current) leaningRef.current = s.leaning ?? null;
      })
      .catch(() => {
        /* ignored by design */
      });
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Keep the newest message in view (scrolls only the list, never the page).
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [messages, waiting]);

  const append = useCallback((msg: ReflectorMessage) => {
    if (aliveRef.current) setMessages((prev) => [...prev, msg]);
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const t = raw.trim();
      if (!t || waiting) return;

      const history = messages.slice(-HISTORY_LIMIT);
      setMessages((prev) => [...prev, { role: "user", text: t, ts: nowIso() }]);
      setInput("");
      setWaiting(true);

      try {
        // (1) Safety first — before any reflection is generated.
        const check = await crisisApi.check(t, region);
        if (check.flagged) {
          openCrisis(check.resources, check.matched_phrase);
          append({ role: "reflector", text: CRISIS_REPLY, ts: nowIso() });
          return;
        }

        // (2) The reflection itself.
        const reply = await reflectorApi.turn(history, t, leaningRef.current);
        append({ role: "reflector", text: reply.text, ts: nowIso() });

        if (reply.redirect_to_crisis) {
          try {
            const c = await crisisApi.check(t, region);
            openCrisis(c.resources, c.matched_phrase);
          } catch {
            openCrisis([], null);
          }
        }
      } catch (err) {
        showToast(errorMessage(err, "The Reflector couldn't respond just now. Try again."));
      } finally {
        if (aliveRef.current) setWaiting(false);
      }
    },
    [messages, waiting, region, openCrisis, showToast, append],
  );

  // Enter sends via the form's implicit submission (a single text input + a
  // submit button). While the button is disabled the browser suppresses it.
  const canSend = !waiting && input.trim().length > 0;
  const chatEmpty = messages.length === 0;

  return (
    <div
      className="container-sm flex flex-col h-[100dvh] max-[860px]:h-[calc(100dvh-84px)] px-10 pt-11 pb-10 max-[720px]:px-[18px] max-[720px]:pt-7 max-[720px]:pb-5"
      style={{ boxSizing: "border-box" }}
    >
      {/* Header */}
      <header className="flex items-center gap-[14px] mb-2 shrink-0">
        <BuddyBlob size={44} colors={companion.colors} follow={false} glow={false} aria-label={companion.name} />
        <div className="min-w-0">
          <h1 className="h-display" style={{ fontSize: 28 }}>
            The Reflector
          </h1>
          <p className="m-0 mt-[2px] text-[13.5px] text-app-sub">Listens and asks. Never tells you what to do.</p>
        </div>
      </header>

      {/* Messages */}
      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Conversation with the Reflector"
        className="flex-1 min-h-0 flex flex-col gap-[14px] py-[22px] overflow-y-auto overflow-x-hidden"
      >
        {chatEmpty && (
          <>
            <p className="m-0 mt-2 mb-1 text-[16.5px] leading-[1.6] italic text-app-sub">
              Whatever's present for you today, it's okay to bring it.
            </p>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => {
                    void send(text);
                    inputRef.current?.focus();
                  }}
                  disabled={waiting}
                  className="rounded-full border border-app-line bg-white text-app-text font-medium text-[13.5px] cursor-pointer transition-[border-color,color] duration-150 hover:border-acc hover:text-acc disabled:opacity-[.55] disabled:cursor-not-allowed text-left"
                  style={{ padding: "9px 16px", minHeight: 44 }}
                >
                  {text}
                </button>
              ))}
            </div>
          </>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div
              key={`${m.ts}-${i}`}
              className="self-end text-white text-[14.5px] leading-[1.6]"
              style={{
                maxWidth: "78%",
                background: "var(--color-app-ink)",
                padding: "12px 17px",
                borderRadius: 18,
                borderBottomRightRadius: 6,
                overflowWrap: "anywhere",
                animation: ENTER_ANIM,
              }}
            >
              {m.text}
            </div>
          ) : (
            <div
              key={`${m.ts}-${i}`}
              className="self-start flex gap-[10px]"
              style={{ maxWidth: "82%", animation: ENTER_ANIM }}
            >
              <BuddyBlob
                size={26}
                colors={companion.colors}
                eyes={false}
                glow={false}
                follow={false}
                aria-label=""
                style={{ marginTop: 4 }}
              />
              <div
                className="bg-white text-app-text italic text-[14.5px] leading-[1.65]"
                style={{
                  border: "1px solid var(--color-app-line)",
                  borderLeft: `3px solid ${IRIS}`,
                  padding: "12px 17px",
                  borderRadius: 18,
                  borderTopLeftRadius: 6,
                  overflowWrap: "anywhere",
                  minWidth: 0,
                }}
              >
                {m.text}
              </div>
            </div>
          ),
        )}

        {waiting && (
          <div className="self-start flex items-center gap-[10px]" role="status" aria-label="The Reflector is listening">
            <BuddyBlob size={26} colors={companion.colors} eyes={false} glow={false} follow={false} aria-label="" />
            <div
              className="bg-white flex gap-[5px]"
              style={{ border: "1px solid var(--color-app-line)", padding: "14px 18px", borderRadius: 18 }}
              aria-hidden="true"
            >
              {[0, 0.15, 0.3].map((delay) => (
                <span
                  key={delay}
                  className="block rounded-full bg-app-faint"
                  style={{ width: 6, height: 6, animation: `dot-bounce 1.2s ease-in-out ${delay}s infinite` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        className="shrink-0 bg-white rounded-full border-[1.5px] border-app-line focus-within:border-acc flex items-center gap-[10px] transition-colors duration-150"
        style={{ padding: "6px 6px 6px 20px", boxShadow: "0 6px 22px rgba(20,18,16,.05)" }}
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Say what's here…"
          aria-label="Message the Reflector"
          autoComplete="off"
          enterKeyHint="send"
          maxLength={4000}
          className="flex-1 min-w-0 border-none bg-transparent text-[15px] font-normal text-app-ink"
          // The pill's focus-within accent border is the visible focus ring (as in the reference).
          style={{ minHeight: 44, outline: "none" }}
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!canSend}
          className="shrink-0 grid place-items-center rounded-full border-none text-[#1A1206] cursor-pointer transition-transform duration-150 hover:scale-[1.06] disabled:opacity-[.55] disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{
            width: 44,
            height: 44,
            background: "linear-gradient(120deg, var(--color-acc2), var(--color-acc))",
            boxShadow: "0 5px 16px color-mix(in oklab, var(--color-acc) 40%, transparent)",
          }}
        >
          {waiting ? <span className="spinner" aria-hidden="true" /> : <Send size={17} strokeWidth={1.9} aria-hidden="true" />}
        </button>
      </form>

      {/* Footer */}
      <p className="m-0 mt-3 shrink-0 text-center text-[11px] text-app-faint">
        The Reflector is not a therapist. If you're in crisis, please reach out to a hotline. This conversation stays
        in your browser and isn't saved.
      </p>
    </div>
  );
}

export default Reflector;
