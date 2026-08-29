/**
 * <BuddyBlob /> — the buddy.ai mascot: a morphing, softly-lit gradient orb
 * with two eyes that blink and (subtly) follow the pointer.
 *
 *   <BuddyBlob size={300} />                                  // hero
 *   <BuddyBlob size={96} colors={["#FF7A1A","#C2410C","#F24E1E"]} speed={1.25} />
 *   <BuddyBlob size={26} eyes={false} />                      // logo mark
 *
 * Pure CSS/DOM — no WebGL — so dozens of instances are cheap.
 */
import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import "./buddy-blob.css";

export type BlobColors = [string, string, string];

export const DEFAULT_BLOB_COLORS: BlobColors = ["#FFD23F", "#FF7A1A", "#F24E1E"];

export interface BuddyBlobProps {
  /** Pixel size (width = height). Default 120. */
  size?: number;
  /** Three gradient stops: highlight, mid, shadow. */
  colors?: BlobColors | string[];
  /** Show the eyes. Default true. */
  eyes?: boolean;
  /** Morph speed multiplier (1 = 9s cycle). Default 1. */
  speed?: number;
  /** Gentle vertical float. Default false. */
  float?: boolean;
  /** Eyes track the pointer. Default true (ignored for size < 40 or reduced motion). */
  follow?: boolean;
  /** Ground glow beneath the body. Default true (auto-off for size < 40). */
  glow?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Accessible name. Pass "" for a purely decorative blob (renders aria-hidden, no role). */
  "aria-label"?: string;
}

export function BuddyBlob({
  size = 120,
  colors = DEFAULT_BLOB_COLORS,
  eyes = true,
  speed = 1,
  float = false,
  follow = true,
  glow,
  className,
  style,
  "aria-label": ariaLabel,
}: BuddyBlobProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const eyesRef = useRef<HTMLDivElement>(null);
  const [c1, c2, c3] = [colors[0] ?? DEFAULT_BLOB_COLORS[0], colors[1] ?? DEFAULT_BLOB_COLORS[1], colors[2] ?? DEFAULT_BLOB_COLORS[2]];
  const showGlow = glow ?? size >= 40;
  const canFollow = follow && eyes && size >= 40;

  // Stable random blink offset per instance so a row of blobs doesn't blink in sync.
  const blinkDelay = useMemo(() => `${(Math.random() * 3.5).toFixed(2)}s`, []);

  // Pointer-following eyes (rAF-throttled, no React re-renders).
  useEffect(() => {
    if (!canFollow) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let px = 0;
    let py = 0;
    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const root = rootRef.current;
        const el = eyesRef.current;
        if (!root || !el) return;
        const r = root.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        // Normalize to -1..1 over ~a viewport's worth of distance, then clamp.
        const nx = Math.max(-1, Math.min(1, (px - cx) / 520));
        const ny = Math.max(-1, Math.min(1, (py - cy) / 420));
        const max = size * 0.055;
        el.style.transform = `translate(${(nx * max).toFixed(2)}px, ${(ny * max - size * 0.02).toFixed(2)}px)`;
      });
    };
    const onLeave = () => {
      const el = eyesRef.current;
      if (el) el.style.transform = `translate(0px, ${(-size * 0.02).toFixed(2)}px)`;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [canFollow, size]);

  const vars = {
    "--s": `${size}px`,
    "--c1": c1,
    "--c2": c2,
    "--c3": c3,
    "--dur": `${(9 / Math.max(0.2, speed)).toFixed(2)}s`,
    "--blink-delay": blinkDelay,
    ...style,
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className={`bb${className ? ` ${className}` : ""}`}
      style={vars}
      data-float={float ? "true" : "false"}
      // An empty label means "decorative": hide it instead of announcing an unnamed image.
      {...(ariaLabel === "" ? { "aria-hidden": true } : { role: "img", "aria-label": ariaLabel ?? "Buddy" })}
    >
      {showGlow && <div className="bb-glow" />}
      <div className="bb-body">
        <div className="bb-sheen" />
        <div className="bb-rim" />
      </div>
      {eyes && (
        <div ref={eyesRef} className="bb-eyes" aria-hidden="true">
          <span className="bb-eye" />
          <span className="bb-eye" />
        </div>
      )}
    </div>
  );
}

export default BuddyBlob;
