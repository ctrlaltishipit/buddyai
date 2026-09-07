/**
 * SCREEN: APP SHELL (light) — 264px sidebar + content, collapsing to a bottom
 * tab bar on small screens (see .app-shell / .app-sidebar / .app-tabbar in
 * globals.css). The signed-in pages render inside <Outlet />.
 *
 * Sidebar: logo → 5 nav items → spacer → streak card → user row (sign out).
 * Streak data comes from GET /insights/summary and refetches whenever an
 * entry is created/edited/deleted (state.entriesVersion).
 */
import type { CSSProperties, ReactNode } from "react";
import { Link, Outlet, useMatch, useNavigate } from "react-router";
import { BookOpen, House, LogOut, MessageCircle, Settings, Waves, type LucideIcon } from "lucide-react";
import { GuidedTour } from "../components/GuidedTour";
import { Logo } from "../components/Logo";
import { insightsApi } from "../lib/api";
import { firstName } from "../lib/constants";
import { useStore } from "../lib/store";
import { APP_TOUR, useTour } from "../lib/tours";
import { useAsync } from "../lib/useAsync";

// Nav icons are lucide: house, book-open (journal), waves (map), message-circle (reflector), settings.
const NAV: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: "/app/home", label: "Home", icon: House },
  { to: "/app/journal", label: "Journal", icon: BookOpen },
  { to: "/app/map", label: "Map", icon: Waves },
  { to: "/app/reflector", label: "Reflector", icon: MessageCircle },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

/**
 * A router link that exposes NavLink's `isActive` (path match, `end: false`)
 * as `data-active` — the hook globals.css keys `.nav-item` styling off.
 */
function NavItem({
  to,
  className,
  style,
  children,
}: {
  to: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const active = useMatch({ path: to, end: false }) !== null;
  return (
    <Link
      to={to}
      className={className}
      style={style}
      data-active={active ? "true" : "false"}
      data-tour={`nav-${to.split("/").pop()}`}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}

const STREAK_CARD: CSSProperties = {
  borderRadius: 16,
  padding: 16,
  background:
    "linear-gradient(135deg, color-mix(in oklab, var(--color-acc) 10%, #fff), color-mix(in oklab, var(--color-acc2) 12%, #fff))",
  border: "1px solid var(--color-app-line)",
};

function StreakCard({
  days,
  loading,
  error,
  onRetry,
}: {
  days: number | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  // Skeleton while the first summary loads (subsequent refetches keep the old card).
  if (loading && days === null && !error) {
    return (
      <div style={STREAK_CARD} aria-busy="true" aria-label="Loading your streak">
        <div className="animate-pulse">
          <div className="h-[15px] w-[104px] rounded-[6px]" style={{ background: "rgba(20,18,16,.08)" }} />
          <div className="mt-[9px] h-[12px] w-[168px] max-w-full rounded-[6px]" style={{ background: "rgba(20,18,16,.06)" }} />
          <div className="mt-[14px] flex gap-1">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="h-[5px] flex-1 rounded-[4px]" style={{ background: "rgba(20,18,16,.07)" }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && days === null) {
    return (
      <div style={STREAK_CARD} role="status">
        <div className="font-display text-[15px] font-semibold" style={{ marginBottom: 3 }}>
          Your streak
        </div>
        <div className="text-[12.5px] leading-[1.5] text-app-sub">Couldn't load it right now.</div>
        <button type="button" className="btn-link mt-1.5 min-h-[32px]" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  const n = Math.max(0, days ?? 0);
  const filled = Math.min(n, 7);
  // Copy never mentions a gap. An unfilled dot is just an unfilled dot: this is
  // a mental-health app, and framing absence as failure punishes the people
  // most likely to have missed a day for a reason.
  const note =
    n === 0
      ? "One entry is all it takes to start."
      : n < 3
        ? "Your map gets sharper the more you feed it."
        : n < 7
          ? "Enough for the map to start seeing a shape."
          : "Every one of the last seven days.";
  return (
    <div style={STREAK_CARD} aria-live="polite">
      <div className="font-display text-[15px] font-semibold" style={{ marginBottom: 3 }}>
        {n === 0 ? "Your last 7 days" : `${n} of the last 7 days`}
      </div>
      <div className="text-[12.5px] leading-[1.5] text-app-sub">{note}</div>
      <div
        className="mt-[10px] flex gap-1"
        role="img"
        aria-label={`${filled} of the last 7 days written in`}
      >
        {Array.from({ length: 7 }, (_, i) => (
          <div
            key={i}
            className="h-[5px] flex-1 rounded-[4px]"
            style={{ background: i < filled ? "var(--color-acc)" : "var(--color-app-line)" }}
          />
        ))}
      </div>
    </div>
  );
}

export function AppShell() {
  const { state, signOut } = useStore();
  const navigate = useNavigate();
  const summary = useAsync(() => insightsApi.summary(), [state.entriesVersion]);
  // First time in after onboarding: point out what each part of the app does.
  // Waits for the streak to load so the sidebar card is there to spotlight.
  const tour = useTour("app", { delayMs: 1200, when: !summary.loading });

  const name = firstName(state.settings?.display_name, state.user?.email);
  const initial = name.charAt(0).toUpperCase();
  const plan = !state.user || state.user.plan_tier === "free" ? "Free plan" : "Plus plan";

  const handleSignOut = () => {
    signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="surface-light app-shell">
      {/* overflowY: on very short windows the sticky 100dvh rail scrolls instead of clipping the user row. */}
      <aside className="app-sidebar" style={{ overflowY: "auto" }}>
        <div className="flex shrink-0 items-center" style={{ padding: "0 10px", marginBottom: 26 }}>
          <Logo tone="light" to="/app/home" />
        </div>

        <nav aria-label="Primary" className="flex flex-col gap-[6px]">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavItem key={to} to={to} className="nav-item">
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </NavItem>
          ))}
        </nav>

        <div className="flex-1" />

        <div data-tour="streak">
          <StreakCard
            days={summary.data?.streak_days ?? null}
            loading={summary.loading}
            error={summary.error}
            onRetry={() => void summary.reload()}
          />
        </div>

        <div className="flex items-center gap-[10px]" style={{ padding: "12px 10px 2px" }}>
          <div
            className="grid shrink-0 place-items-center rounded-full text-[14px] font-bold"
            style={{
              width: 34,
              height: 34,
              background: "color-mix(in oklab, var(--color-acc) 14%, #fff)",
              color: "var(--color-acc-ink)",
            }}
            aria-hidden="true"
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold">{name}</div>
            <div className="text-[11.5px] text-app-faint">{plan}</div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out"
            title="Sign out"
            className="grid shrink-0 cursor-pointer place-items-center rounded-[10px] border-0 bg-transparent text-app-faint transition-colors hover:text-app-ink"
            style={{ width: 44, height: 44, marginRight: -10 }}
          >
            <LogOut size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </aside>

      <main className="app-content">
        <Outlet />
      </main>

      <nav className="app-tabbar" aria-label="Primary">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavItem
            key={to}
            to={to}
            className="flex min-h-[48px] min-w-[56px] flex-col items-center justify-center gap-[3px] rounded-[12px] px-1.5 py-1 text-[11px] font-semibold text-app-sub no-underline transition-colors data-[active=true]:text-acc"
          >
            <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </NavItem>
        ))}
      </nav>

      <GuidedTour steps={APP_TOUR} open={tour.open} tone="light" onClose={tour.close} />
    </div>
  );
}

export default AppShell;
