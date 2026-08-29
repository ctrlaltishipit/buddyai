/**
 * Mood pill — a tinted chip with a colored dot and the emotion label.
 * Colors come from lib/mood-colors (the only place emotion color lives).
 *
 *   <EmotionPill emotion="anxiety" />                // light app, small
 *   <EmotionPill emotion="joy" size="md" />          // "leaning" chip
 *   <EmotionPill emotion="joy" tone="dark" />        // landing (white/6% pill)
 */
import type { CSSProperties, ReactNode } from "react";
import { moodColor, moodDeep, moodLabel, moodTint } from "../lib/mood-colors";

export interface EmotionPillProps {
  emotion: string;
  label?: ReactNode;
  size?: "sm" | "md";
  tone?: "light" | "dark";
  /** Render as a <button> (e.g. toggleable suggestion). */
  onClick?: () => void;
  /** For toggles: filled = solid emotion color with white text. */
  filled?: boolean;
  className?: string;
  style?: CSSProperties;
  /** For toggles: exposes the on/off state to assistive tech. */
  "aria-pressed"?: boolean;
  "aria-label"?: string;
}

export function EmotionPill({
  emotion,
  label,
  size = "sm",
  tone = "light",
  onClick,
  filled = false,
  className,
  style,
  "aria-pressed": ariaPressed,
  "aria-label": ariaLabel,
}: EmotionPillProps) {
  const color = moodColor(emotion);
  const base: CSSProperties =
    tone === "dark"
      ? { background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.09)", color: "#F7F3EA" }
      : filled
        ? { background: color, color: "#fff" }
        : { background: moodTint(emotion), color: moodDeep(emotion) };
  const sizing: CSSProperties =
    size === "md"
      ? { fontSize: 14, fontWeight: 700, padding: "6px 13px", gap: 8 }
      : { fontSize: 12, fontWeight: 600, padding: "4px 11px", gap: 6 };
  const dot = size === "md" ? 9 : 8;
  const inner = (
    <>
      <span
        className="dot"
        style={{ width: dot, height: dot, background: filled && tone !== "dark" ? "#fff" : color }}
      />
      {label ?? moodLabel(emotion)}
    </>
  );
  const cls = `pill ${className ?? ""}`;
  const styles: CSSProperties = { border: "none", transition: "all .15s ease", ...base, ...sizing, ...style };
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={ariaPressed}
        aria-label={ariaLabel}
        className={cls}
        style={{ cursor: "pointer", ...styles }}
      >
        {inner}
      </button>
    );
  }
  return (
    <span aria-label={ariaLabel} className={cls} style={styles}>
      {inner}
    </span>
  );
}

export default EmotionPill;
