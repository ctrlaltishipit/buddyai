/**
 * buddy.ai wordmark: mini morphing blob + "buddy.ai".
 *   <Logo tone="dark" />   — on dark surfaces: ".ai" is gradient text
 *   <Logo tone="light" />  — in the app: ".ai" is the accent color
 */
import { Link } from "react-router";
import { BuddyBlob } from "./BuddyBlob";

export interface LogoProps {
  tone?: "dark" | "light";
  /** Font size of the wordmark in px. Default 19. */
  size?: number;
  /** Wrap in a router <Link>. */
  to?: string;
  className?: string;
}

export function Logo({ tone = "dark", size = 19, to, className }: LogoProps) {
  const mark = Math.round(size * 1.37); // 26px at 19px
  const inner = (
    <span
      className={`inline-flex items-center gap-[10px] ${className ?? ""}`}
      style={{ lineHeight: 1 }}
    >
      <BuddyBlob size={mark} eyes={false} glow={false} follow={false} aria-label="" />
      <span
        className="font-display font-bold"
        style={{ fontSize: size, letterSpacing: -0.5, color: tone === "dark" ? "#F7F3EA" : "#141210" }}
      >
        buddy
        {tone === "dark" ? (
          <span className="text-gradient">.ai</span>
        ) : (
          <span style={{ color: "var(--color-acc-ink)" }}>.ai</span>
        )}
      </span>
    </span>
  );
  if (to) {
    return (
      <Link to={to} aria-label="buddy.ai home" style={{ textDecoration: "none" }}>
        {inner}
      </Link>
    );
  }
  return inner;
}

export default Logo;
