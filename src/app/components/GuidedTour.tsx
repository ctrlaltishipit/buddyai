/**
 * GuidedTour — a step-by-step walkthrough that spotlights real parts of the
 * page and explains them one at a time.
 *
 * Anchor a step to any element with `data-tour="<id>"`. If several elements
 * carry the same id (say the sidebar and the mobile tab bar), the first one
 * that is actually visible wins, and a step whose target is not on screen at
 * all is skipped rather than pointing at nothing.
 *
 * Controls: Next / Back / Skip tour, arrow keys, Enter, Esc. The dimmed
 * backdrop swallows clicks so nothing underneath fires by accident, and the
 * page still scrolls with the spotlight following its target.
 *
 * Phones get a bottom (or top) sheet instead of a floating card, placed on
 * whichever half of the screen the target is not in.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

export interface TourStep {
  /** Matches data-tour="…". Omit for a centred card with no spotlight. */
  target?: string;
  title: string;
  body: string;
  /** Label on the primary button for this step (default "Next" / "Done"). */
  cta?: string;
}

interface Props {
  steps: TourStep[];
  open: boolean;
  /** Dark card on the marketing pages, light card inside the app. */
  tone?: "dark" | "light";
  /** completed=true when the last step was reached, false when skipped. */
  onClose: (completed: boolean) => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8; // spotlight breathing room around the target
const CARD_W = 344;
const GAP = 14;
const MOBILE = 640;
const HEADER = 88; // sticky nav allowance when scrolling a tall target to the top

const CSS = `
.gt-root { position: fixed; inset: 0; z-index: 70; }
.gt-backdrop { position: absolute; inset: 0; background: rgba(10,9,8,.66); }
.gt-spot {
  position: absolute; border-radius: 16px; pointer-events: none;
  box-shadow: 0 0 0 100vmax rgba(10,9,8,.66), 0 0 0 1.5px rgba(255,210,63,.55), 0 0 42px rgba(255,122,26,.28);
  transition: top .38s cubic-bezier(.2,.7,.2,1), left .38s cubic-bezier(.2,.7,.2,1), width .38s cubic-bezier(.2,.7,.2,1), height .38s cubic-bezier(.2,.7,.2,1);
}
.gt-card {
  position: absolute; width: ${CARD_W}px; max-width: calc(100vw - 32px);
  border-radius: 20px; padding: 20px 20px 16px; outline: none;
  animation: gt-in .32s cubic-bezier(.2,.7,.2,1) both;
  box-shadow: 0 24px 60px rgba(0,0,0,.45);
}
.gt-card.dark { background: #16130F; color: #F7F3EA; border: 1px solid rgba(255,255,255,.1); }
.gt-card.light { background: #fff; color: #141210; border: 1px solid #ECE6DC; box-shadow: 0 24px 60px rgba(20,18,16,.22); }
.gt-card.centered { left: 50%; top: 50%; transform: translate(-50%, -50%); }
.gt-step { font-size: 11.5px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; margin: 0 0 10px; }
.gt-card.dark .gt-step { color: #FFD23F; }
.gt-card.light .gt-step { color: #B8420A; }
.gt-title { font-family: var(--font-display); font-weight: 700; font-size: 20px; line-height: 1.2; letter-spacing: -0.01em; margin: 0 0 8px; }
.gt-body { margin: 0; font-size: 14.5px; line-height: 1.6; }
.gt-card.dark .gt-body { color: #B9B1A3; }
.gt-card.light .gt-body { color: #6B645A; }
.gt-dots { display: flex; gap: 5px; margin: 16px 0 14px; }
.gt-dot { width: 6px; height: 6px; border-radius: 99px; background: currentColor; opacity: .18; transition: opacity .2s, width .2s; }
.gt-dot.on { opacity: 1; width: 18px; background: linear-gradient(90deg, #FFD23F, #FF7A1A); }
.gt-row { display: flex; align-items: center; gap: 8px; }
.gt-skip {
  margin-right: auto; background: none; border: 0; padding: 8px 0; cursor: pointer;
  font: 600 13.5px var(--font-sans); min-height: 40px;
}
.gt-card.dark .gt-skip { color: #7D766B; } .gt-card.dark .gt-skip:hover { color: #F7F3EA; }
.gt-card.light .gt-skip { color: #A39C90; } .gt-card.light .gt-skip:hover { color: #141210; }
.gt-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  border: 0; border-radius: 999px; cursor: pointer; font: 700 14px var(--font-sans);
  min-height: 40px; padding: 0 16px; transition: transform .15s, background .15s, color .15s;
}
.gt-btn:hover { transform: translateY(-1px); }
.gt-btn.back { background: transparent; padding: 0 12px; }
.gt-card.dark .gt-btn.back { color: #B9B1A3; box-shadow: inset 0 0 0 1px rgba(255,255,255,.16); }
.gt-card.light .gt-btn.back { color: #3D3730; box-shadow: inset 0 0 0 1px #ECE6DC; }
.gt-btn.next { color: #1A1206; background: linear-gradient(100deg, #FFD23F, #FF7A1A 55%, #F24E1E); box-shadow: 0 8px 22px rgba(255,122,26,.32); }
.gt-close {
  position: absolute; top: 10px; right: 10px; width: 36px; height: 36px; border-radius: 999px;
  display: grid; place-items: center; border: 0; background: transparent; cursor: pointer;
}
.gt-card.dark .gt-close { color: #7D766B; } .gt-card.dark .gt-close:hover { color: #F7F3EA; background: rgba(255,255,255,.07); }
.gt-card.light .gt-close { color: #A39C90; } .gt-card.light .gt-close:hover { color: #141210; background: #F6F1E9; }
@keyframes gt-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.gt-card.centered { animation-name: gt-in-c; }
@keyframes gt-in-c { from { opacity: 0; transform: translate(-50%, -46%); } to { opacity: 1; transform: translate(-50%, -50%); } }
@media (max-width: ${MOBILE}px) {
  .gt-card { left: 12px !important; right: 12px; width: auto; max-width: none; padding: 18px 18px 14px; }
  .gt-card.sheet-bottom { top: auto !important; bottom: calc(12px + env(safe-area-inset-bottom)); }
  .gt-card.sheet-top { top: calc(12px + env(safe-area-inset-top)) !important; bottom: auto; }
  .gt-card.centered { left: 12px !important; right: 12px; top: 50% !important; transform: translateY(-50%); }
  @keyframes gt-in-c { from { opacity: 0; transform: translateY(-46%); } to { opacity: 1; transform: translateY(-50%); } }
  .gt-title { font-size: 19px; }
}
@media (prefers-reduced-motion: reduce) {
  .gt-spot, .gt-card, .gt-dot { transition: none !important; animation: none !important; }
}
`;

/** First element with this data-tour id that is laid out and on screen. */
function findTarget(id: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`);
  for (const el of Array.from(nodes)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") return el;
  }
  return null;
}

function measure(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  // A section taller than the viewport is spotlit from its top edge down.
  const maxH = Math.max(160, vh - HEADER - 120);
  return {
    top: r.top - PAD,
    left: r.left - PAD,
    width: r.width + PAD * 2,
    height: Math.min(r.height, maxH) + PAD * 2,
  };
}

/** Anything inside a sticky/fixed bar is already on screen; scrolling would only move the page away. */
function isPinned(el: HTMLElement): boolean {
  for (let n: HTMLElement | null = el; n && n !== document.body; n = n.parentElement) {
    const pos = getComputedStyle(n).position;
    if (pos === "fixed" || pos === "sticky") return true;
  }
  return false;
}

function scrollTo(el: HTMLElement, reduced: boolean) {
  if (isPinned(el)) return;
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const tall = r.height > vh * 0.6;
  const y = window.scrollY + r.top - (tall ? HEADER : Math.max(HEADER, (vh - r.height) / 2));
  window.scrollTo({ top: Math.max(0, y), behavior: reduced ? "auto" : "smooth" });
}

export function GuidedTour({ steps, open, tone = "dark", onClose }: Props) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [vw, setVw] = useState(() => (typeof window === "undefined" ? 1024 : window.innerWidth));
  const cardRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const reduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const step = steps[i];
  const last = i === steps.length - 1;

  // Skip forward/backward over steps whose target is not on this screen.
  const resolve = useCallback(
    (from: number, dir: 1 | -1): number => {
      let n = from;
      while (n >= 0 && n < steps.length) {
        const t = steps[n].target;
        if (!t || findTarget(t)) return n;
        n += dir;
      }
      return -1;
    },
    [steps],
  );

  const finish = useCallback(
    (completed: boolean) => {
      onClose(completed);
      restoreFocus.current?.focus?.();
    },
    [onClose],
  );

  const go = useCallback(
    (dir: 1 | -1) => {
      const n = resolve(i + dir, dir);
      if (n === -1) {
        if (dir === 1) finish(true);
        return;
      }
      setI(n);
    },
    [i, resolve, finish],
  );

  // Reset to the first available step whenever the tour opens.
  useEffect(() => {
    if (!open) return;
    restoreFocus.current = document.activeElement as HTMLElement | null;
    const first = resolve(0, 1);
    setI(first === -1 ? 0 : first);
  }, [open, resolve]);

  // Locate + scroll to the current target, then keep the spotlight glued to it.
  useLayoutEffect(() => {
    if (!open || !step) return;
    const el = step.target ? findTarget(step.target) : null;
    targetRef.current = el;
    if (!el) {
      setRect(null);
      return;
    }
    scrollTo(el, reduced);
    let frame = 0;
    const update = () => {
      frame = 0;
      if (targetRef.current) setRect(measure(targetRef.current));
      setVw(window.innerWidth);
    };
    const onMove = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    const settle = window.setTimeout(update, reduced ? 50 : 450);
    window.addEventListener("scroll", onMove, { passive: true });
    window.addEventListener("resize", onMove, { passive: true });
    return () => {
      window.clearTimeout(settle);
      window.removeEventListener("scroll", onMove);
      window.removeEventListener("resize", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [open, step, reduced]);

  // Keyboard + focus.
  useEffect(() => {
    if (!open) return;
    cardRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        if ((e.target as HTMLElement)?.tagName === "BUTTON" && e.key === "Enter") return;
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, i, go, finish]);

  if (!open || !step || typeof document === "undefined") return null;

  // ----- card placement -----
  const vh = window.innerHeight;
  const mobile = vw <= MOBILE;
  let cardStyle: React.CSSProperties = {};
  let cardClass = "gt-card " + tone;

  if (!rect) {
    cardClass += " centered";
  } else if (mobile) {
    const cy = rect.top + rect.height / 2;
    cardClass += cy > vh * 0.55 ? " sheet-top" : " sheet-bottom";
  } else {
    const cx = rect.left + rect.width / 2;
    const left = Math.round(Math.min(Math.max(16, cx - CARD_W / 2), vw - CARD_W - 16));
    const below = vh - (rect.top + rect.height) >= 240;
    cardStyle = below
      ? { left, top: Math.round(rect.top + rect.height + GAP) }
      : rect.top >= 240
        ? { left, bottom: Math.round(vh - rect.top + GAP) }
        : { left, bottom: 20 };
  }

  const hasBack = resolve(i - 1, -1) !== -1;
  const shown = steps.filter((s) => !s.target || findTarget(s.target));
  const pos = Math.max(0, shown.indexOf(step));
  const titleId = "gt-title";

  return createPortal(
    <div className="gt-root" role="presentation">
      <style>{CSS}</style>
      <div className="gt-backdrop" onClick={() => finish(false)} style={{ background: rect ? "transparent" : undefined }} />
      {rect && (
        <div
          className="gt-spot"
          aria-hidden="true"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      )}
      <div
        ref={cardRef}
        className={cardClass}
        style={cardStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <button type="button" className="gt-close" onClick={() => finish(false)} aria-label="Skip the tour">
          <X size={16} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <p className="gt-step">
          {pos + 1} of {shown.length}
        </p>
        <h2 id={titleId} className="gt-title">
          {step.title}
        </h2>
        <p className="gt-body">{step.body}</p>
        <div className="gt-dots" aria-hidden="true">
          {shown.map((s, n) => (
            <span key={s.title} className={"gt-dot" + (n === pos ? " on" : "")} />
          ))}
        </div>
        <div className="gt-row">
          <button type="button" className="gt-skip" onClick={() => finish(false)}>
            Skip tour
          </button>
          {hasBack && (
            <button type="button" className="gt-btn back" onClick={() => go(-1)} aria-label="Back">
              <ArrowLeft size={15} strokeWidth={2.2} aria-hidden="true" />
            </button>
          )}
          <button type="button" className="gt-btn next" onClick={() => go(1)}>
            {step.cta ?? (last ? "Done" : "Next")}
            {!last && <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default GuidedTour;
