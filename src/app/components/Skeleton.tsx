/**
 * Loading placeholder block, shared by every screen so skeletons pulse and
 * round the same way everywhere.
 *
 *   <Skeleton h={16} w="62%" />                 // light app (app-line-2)
 *   <Skeleton h={52} r={14} tone="dark" />      // dark surfaces (signup)
 */
import type { CSSProperties } from "react";

export interface SkeletonProps {
  h?: number | string;
  w?: number | string;
  /** Border radius in px. */
  r?: number;
  tone?: "light" | "dark";
  className?: string;
  style?: CSSProperties;
}

const TONE_BG = {
  light: "var(--color-app-line-2)",
  dark: "rgba(255,255,255,.05)",
} as const;

export function Skeleton({ h = 16, w = "100%", r = 10, tone = "light", className, style }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse${className ? ` ${className}` : ""}`}
      style={{ height: h, width: w, maxWidth: "100%", borderRadius: r, background: TONE_BG[tone], ...style }}
    />
  );
}

export default Skeleton;
