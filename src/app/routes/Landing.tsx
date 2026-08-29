/**
 * Landing: the dark marketing page for buddy.ai.
 *
 * Visual spec: web/design/buddy-redesign.reference.html → SCREEN: LANDING.
 * This page makes no API calls. The emotion-map chart is a static,
 * illustrative SVG copied from the reference — the real chart lives in the app.
 */
import { useEffect, useState, type CSSProperties } from "react";
import { Link, useLocation } from "react-router";
import { ArrowRight, Lock, Sparkles, Waves } from "lucide-react";
import { BuddyBlob } from "../components/BuddyBlob";
import { Logo } from "../components/Logo";
import { SiteFooter } from "../components/SiteFooter";
import { COMPANIONS } from "../lib/constants";
import type { CompanionId } from "../lib/types";

// ---------- Palette (mirrors @theme tokens; used for inline one-offs) ----------

const MINT = "#FFD23F";
const IRIS = "#FF7A1A";
const LILAC = "#F24E1E";
const FOG = "#B9B1A3";
const DIM = "#7D766B";
const NIGHT_3 = "#16130F";

// ---------- Copy (verbatim from the reference) ----------

const WHY = [
  {
    Icon: Waves,
    color: MINT,
    bg: "rgba(255,210,63,.12)",
    tint: "rgba(255,210,63,.4)",
    title: "There when there's no one else.",
    body: "Some days you need to say it out loud and nobody is free. buddy is around at 3am, on a flat Monday, or right after good news lands.",
  },
  {
    Icon: Lock,
    color: IRIS,
    bg: "rgba(255,122,26,.14)",
    tint: "rgba(255,122,26,.45)",
    title: "Private to you, always.",
    body: "Your entries belong to your account and nothing else. Nobody else can open them. Not other users, not us.",
  },
  {
    Icon: Sparkles,
    color: LILAC,
    bg: "rgba(242,78,30,.14)",
    tint: "rgba(242,78,30,.45)",
    title: "See how you've been.",
    body: "Every entry adds to a map of your feelings, so the patterns show up on their own.",
  },
] as const;

const HOW = [
  { n: "01", color: MINT, title: "Say what's going on", body: "Type it or say it. A whole story or half a sentence. However it comes out is fine." },
  { n: "02", color: IRIS, title: "buddy listens", body: "It picks up what you're feeling underneath and asks you something back, so you can keep going." },
  { n: "03", color: LILAC, title: "Watch it add up", body: "Each entry adds a thread to your map. Look back any time to see how things have shifted." },
] as const;

const LEGEND = [
  { label: "Joy", color: MINT },
  { label: "Anxiety", color: IRIS },
  { label: "Gratitude", color: LILAC },
] as const;

const PRIVACY = [
  "Every entry is tied to your account, and nobody else can open it.",
  "We never see your password.",
  "Your writing is read once to pick up feelings, then that working copy is dropped.",
  "Export everything or delete everything, any time, in one click.",
] as const;

/** Per-companion morph speed + hover border tint (from the reference). */
const COMPANION_STYLE: Record<CompanionId, { speed: number; tint: string }> = {
  sage: { speed: 1, tint: "rgba(255,210,63,.5)" },
  sol: { speed: 0.85, tint: "rgba(255,122,26,.5)" },
  ember: { speed: 1.25, tint: "rgba(255,122,26,.5)" },
};

const NAV_LINKS = [
  { href: "#why", label: "Why buddy" },
  { href: "#how", label: "How it works" },
  { href: "#privacy", label: "Privacy" },
] as const;

/** Router links in the nav (anchors above stay on this page). */
const NAV_ROUTES = [
  { to: "/tour", label: "Inside the app" },
  { to: "/about", label: "About" },
] as const;

// ---------- Helpers ----------

/** "Aug 21 to 27" (or "Aug 29 to Sep 4") for the 7-day window ending today. */
function weekRangeLabel(today = new Date()): string {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  const mon = (d: Date) => d.toLocaleDateString(undefined, { month: "short" });
  return start.getMonth() === end.getMonth()
    ? `${mon(start)} ${start.getDate()} to ${end.getDate()}`
    : `${mon(start)} ${start.getDate()} to ${mon(end)} ${end.getDate()}`;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

const fadeUp = (delay: number): CSSProperties => ({ animationDelay: `${delay}s` });

/* Landing-only rules that need media queries / hover states (globals.css is
   shared and read-only for this screen). Everything is prefixed `lp-`. */
const LANDING_CSS = `
.lp { overflow-x: clip; }
.lp-nav-inner { max-width: 1180px; margin: 0 auto; padding: 14px 28px; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.lp-nav-links { display: flex; align-items: center; gap: 26px; font-size: 14px; }
.lp-nav-links a, .lp-footer-links a { color: ${FOG}; text-decoration: none; transition: color .15s ease; }
.lp-nav-links a { min-height: 44px; display: inline-flex; align-items: center; }
.lp-nav-links a:hover, .lp-footer-links a:hover { color: #F7F3EA; }
.lp-anchor { scroll-margin-top: 72px; }
.lp-hero { position: relative; padding: 56px 24px 64px; text-align: center; }
.lp-card:hover { border-color: var(--tint, rgba(255,255,255,.09)); }
.lp-map-grid { display: grid; grid-template-columns: 1fr 1.15fr; gap: 56px; align-items: center; }
.lp-privacy { display: grid; grid-template-columns: auto 1fr; gap: 44px; align-items: center; padding: 56px; }
.lp-privacy-list { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 28px; }
.lp-cta-panel { padding: 64px 40px; }
@media (max-width: 900px) {
  .lp-map-grid { grid-template-columns: 1fr; gap: 36px; }
}
@media (max-width: 720px) {
  .lp-nav-links { display: none; }
  .lp-nav-inner { padding: 12px 18px; gap: 12px; }
  .lp-hero { padding: 40px 20px 52px; }
  .lp-how-line { display: none; }
  .lp-privacy { grid-template-columns: 1fr; gap: 28px; padding: 36px 26px; }
  .lp-privacy-list { grid-template-columns: 1fr; }
  .lp-cta-panel { padding: 48px 22px; }
}
`;

// ---------- Screen ----------

export function Landing() {
  const small = useMediaQuery("(max-width: 640px)");
  const location = useLocation();

  // Deep links like /#privacy: the page mounts after the session hydrates, so
  // the browser's own fragment jump has nothing to land on. Do it ourselves.
  useEffect(() => {
    const id = location.hash.replace(/^#/, "");
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ block: "start" });
    // Run once on mount only; later anchor clicks are handled natively.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="surface-dark lp">
      <style>{LANDING_CSS}</style>

      {/* ---------- Sticky nav ---------- */}
      <header
        className="sticky top-0 z-50"
        style={{
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          background: "rgba(10,9,8,.65)",
          borderBottom: "1px solid rgba(255,255,255,.07)",
        }}
      >
        <nav className="lp-nav-inner" aria-label="Primary">
          <Logo tone="dark" to="/" />
          <div className="lp-nav-links">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
            {NAV_ROUTES.map((l) => (
              <Link key={l.to} to={l.to}>
                {l.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link to="/signup" className="btn btn-grad btn-sm">
              Get early access
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="lp-hero" aria-labelledby="hero-title">
          <div
            className="glow glow-mint"
            aria-hidden="true"
            style={{ top: -180, left: "8%", width: 560, height: 560, animation: "drift-1 26s ease-in-out infinite" }}
          />
          <div
            className="glow glow-lilac"
            aria-hidden="true"
            style={{ top: 60, right: "4%", width: 640, height: 640, filter: "blur(80px)", animation: "drift-2 32s ease-in-out infinite" }}
          />
          <div
            className="glow glow-iris"
            aria-hidden="true"
            style={{ bottom: -220, left: "38%", width: 520, height: 520, filter: "blur(80px)", animation: "drift-1 38s ease-in-out infinite reverse" }}
          />

          <div className="relative mx-auto max-w-[900px]">
            <div className="anim-fade-up flex justify-center" style={fadeUp(0)}>
              <BuddyBlob size={small ? 220 : 300} float aria-label="buddy, your companion" />
            </div>
            <p
              className="eyebrow anim-fade-up text-mint"
              style={{ ...fadeUp(0.1), margin: "26px 0 14px", fontSize: 12.5, letterSpacing: ".32em" }}
            >
              YOUR AI COMPANION AND JOURNAL
            </p>
            <h1
              id="hero-title"
              className="h-display anim-fade-up text-balance"
              style={{
                ...fadeUp(0.18),
                margin: "0 auto",
                maxWidth: 820,
                fontSize: "clamp(44px, 6.4vw, 74px)",
                lineHeight: 1.04,
                letterSpacing: "-0.03em",
              }}
            >
              Someone to talk to, <span className="text-gradient">day or night</span>.
            </h1>
            <p
              className="anim-fade-up text-fog"
              style={{ ...fadeUp(0.26), margin: "20px auto 0", maxWidth: 840, fontSize: 17.5, lineHeight: 1.6 }}
            >
              Vent, think out loud, or just write the day down.
              <br />
              buddy listens, helps you make sense of it, and keeps every word private to you.
              <br />
              <span className="text-mint">Create your buddy now and we will email you when app access opens.</span>
            </p>
            <div className="anim-fade-up mt-[30px] flex flex-wrap justify-center gap-[14px]" style={fadeUp(0.34)}>
              <Link to="/signup" className="btn btn-grad btn-lg">
                Create your buddy for early access <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            </div>
            <p className="anim-fade-up text-dim" style={{ ...fadeUp(0.42), margin: "22px 0 0", fontSize: 13 }}>
              Takes a minute&nbsp;&nbsp;·&nbsp;&nbsp;Private by design&nbsp;&nbsp;·&nbsp;&nbsp;Free while we build
            </p>
          </div>
        </section>

        {/* ---------- Why buddy ---------- */}
        <section id="why" className="lp-anchor px-6 pb-[56px] pt-1" aria-label="Why buddy">
          <div className="container-lg grid-3" style={{ gap: 22 }}>
            {WHY.map(({ Icon, color, bg, tint, title, body }) => (
              <article
                key={title}
                className="card-dark hoverable lp-card p-[30px]"
                style={{ "--tint": tint } as CSSProperties}
              >
                <div className="mb-[18px] grid h-[46px] w-[46px] place-items-center rounded-[14px]" style={{ background: bg }}>
                  <Icon size={22} strokeWidth={1.8} color={color} aria-hidden="true" />
                </div>
                <h3 className="font-display text-[21px] font-semibold tracking-[-0.4px]" style={{ margin: "0 0 8px" }}>
                  {title}
                </h3>
                <p className="m-0 text-[15px] leading-[1.6] text-fog">{body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section id="how" className="lp-anchor px-6 pb-[64px] pt-6" aria-labelledby="how-title">
          <div className="container-lg">
            <p className="eyebrow text-center text-iris" style={{ margin: "0 0 12px" }}>
              HOW IT WORKS
            </p>
            <h2
              id="how-title"
              className="h-display text-center"
              style={{ margin: "0 auto 40px", maxWidth: 640, fontSize: "clamp(30px, 4vw, 44px)", lineHeight: 1.1 }}
            >
              How a check-in goes.
            </h2>
            <div className="grid-3 relative" style={{ gap: 22 }}>
              <div
                className="lp-how-line absolute h-[2px]"
                aria-hidden="true"
                style={{ top: 26, left: "16%", right: "16%", background: `linear-gradient(90deg, ${MINT}, ${IRIS}, ${LILAC})`, opacity: 0.35 }}
              />
              {HOW.map((s) => (
                <div key={s.n} className="relative text-center">
                  <div
                    className="font-display mx-auto mb-[18px] grid h-[52px] w-[52px] place-items-center rounded-full text-[16px] font-bold"
                    style={{ background: NIGHT_3, boxShadow: `inset 0 0 0 1.5px ${s.color}`, color: s.color }}
                    aria-hidden="true"
                  >
                    {s.n}
                  </div>
                  <h3 className="font-display text-[19px] font-semibold" style={{ margin: "0 0 8px" }}>
                    <span className="sr-only">Step {s.n}: </span>
                    {s.title}
                  </h3>
                  <p className="mx-auto my-0 max-w-[260px] text-[14.5px] leading-[1.6] text-fog">{s.body}</p>
                </div>
              ))}
            </div>
            <p className="text-center" style={{ margin: "34px 0 0" }}>
              <Link
                to="/tour"
                className="btn btn-outline-dark"
                style={{ padding: "13px 22px", fontSize: 15 }}
              >
                See every screen inside the app <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            </p>
          </div>
        </section>

        {/* ---------- Emotion map teaser ---------- */}
        <section className="px-6 pb-[64px] pt-1" aria-labelledby="map-title">
          <div className="container-lg lp-map-grid">
            <div>
              <p className="eyebrow text-mint" style={{ margin: "0 0 12px" }}>
                EMOTION MAP
              </p>
              <h2
                id="map-title"
                className="h-display"
                style={{ margin: "0 0 18px", fontSize: "clamp(30px, 3.6vw, 42px)", lineHeight: 1.1 }}
              >
                See the shape of your week.
              </h2>
              <p className="text-pretty text-[16px] leading-[1.65] text-fog" style={{ margin: "0 0 22px" }}>
                Joy climbing since Tuesday. Anxiety easing after the demo. buddy turns the feelings you confirm into
                threads you can follow, week by week.
              </p>
              <div className="flex flex-wrap gap-2" role="list" aria-label="Chart legend">
                {LEGEND.map((l) => (
                  <span key={l.label} className="pill pill-dark" role="listitem">
                    <span className="dot" style={{ background: l.color }} aria-hidden="true" />
                    {l.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="card-dark relative p-[26px]" style={{ borderRadius: 24 }}>
              <div className="mb-[14px] flex items-center justify-between">
                <span className="font-display text-[15px] font-semibold">This week</span>
                <span className="text-[12px] text-dim">{weekRangeLabel()}</span>
              </div>
              <TeaserChart />
              <div
                className="anim-float absolute right-[26px] top-[-16px] rounded-[12px] px-[14px] py-[9px] text-[12.5px] font-semibold text-mint"
                style={{ background: NIGHT_3, border: "1px solid rgba(255,210,63,.5)", boxShadow: "0 8px 26px rgba(0,0,0,.4)" }}
              >
                Joy rising since Tuesday
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Privacy ---------- */}
        <section id="privacy" className="lp-anchor px-6 pb-[64px]" aria-labelledby="privacy-title">
          <div className="panel-grad container-lg lp-privacy">
            <div
              className="grid h-[96px] w-[96px] place-items-center rounded-full"
              style={{
                background: "radial-gradient(circle at 35% 30%, rgba(255,122,26,.25), rgba(255,122,26,.06) 70%)",
                boxShadow: "inset 0 0 0 1.5px rgba(255,122,26,.4)",
              }}
              aria-hidden="true"
            >
              <Lock size={38} strokeWidth={1.6} color={IRIS} />
            </div>
            <div>
              <h2 id="privacy-title" className="h-display" style={{ margin: "0 0 14px", fontSize: "clamp(28px, 3.4vw, 40px)" }}>
                Private by design.
              </h2>
              <ul className="lp-privacy-list m-0 list-none p-0 text-[15px] leading-[1.6] text-fog">
                {PRIVACY.map((line) => (
                  <li key={line} className="flex gap-[10px]">
                    <span className="font-bold text-mint" aria-hidden="true">
                      ✓
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ---------- Companions ---------- */}
        <section className="px-6 pb-[64px]" aria-labelledby="companions-title">
          <div className="container-lg text-center">
            <p className="eyebrow text-lilac" style={{ margin: "0 0 12px" }}>
              COMPANIONS
            </p>
            <h2 id="companions-title" className="h-display" style={{ margin: "0 0 14px", fontSize: "clamp(30px, 4vw, 44px)" }}>
              Make your buddy yours.
            </h2>
            <p className="text-[16px] leading-[1.6] text-fog" style={{ margin: "0 auto 36px", maxWidth: 520 }}>
              Three personalities to start from. They all listen first. Switch whenever you feel like it.
            </p>
            <div className="grid-3" style={{ gap: 22 }}>
              {COMPANIONS.map((c) => {
                const { speed, tint } = COMPANION_STYLE[c.id];
                return (
                  <article
                    key={c.id}
                    className="card-dark hoverable lp-card px-7 py-[34px]"
                    style={{ "--tint": tint } as CSSProperties}
                  >
                    <div className="mb-5 flex justify-center">
                      <BuddyBlob size={96} colors={c.colors} speed={speed} aria-label={`${c.name}, ${c.trait}`} />
                    </div>
                    <h3 className="font-display text-[20px] font-semibold" style={{ margin: "0 0 4px" }}>
                      {c.name}
                    </h3>
                    <p className="m-0 text-[14px] text-fog">{c.blurb}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

      </main>

      <SiteFooter />
    </div>
  );
}

/** Static, illustrative weekly chart from the reference (not real data). */
function TeaserChart() {
  return (
    <svg
      viewBox="0 0 560 240"
      className="block w-full"
      role="img"
      aria-label="Illustrative chart: joy rising, anxiety fading and gratitude climbing across a week"
    >
      <defs>
        <linearGradient id="lp-joy" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={MINT} stopOpacity=".4" />
          <stop offset="100%" stopColor={MINT} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lp-anx" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={IRIS} stopOpacity=".4" />
          <stop offset="100%" stopColor={IRIS} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lp-gra" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={LILAC} stopOpacity=".35" />
          <stop offset="100%" stopColor={LILAC} stopOpacity="0" />
        </linearGradient>
      </defs>
      <g stroke="rgba(255,255,255,.08)">
        <line x1="10" y1="60" x2="550" y2="60" />
        <line x1="10" y1="120" x2="550" y2="120" />
        <line x1="10" y1="180" x2="550" y2="180" />
      </g>
      <path
        d="M20,190 C60,175 85,150 130,150 S220,168 240,160 S330,95 350,88 S450,70 460,66 S530,80 545,74 L545,225 L20,225 Z"
        fill="url(#lp-joy)"
      />
      <path
        d="M20,190 C60,175 85,150 130,150 S220,168 240,160 S330,95 350,88 S450,70 460,66 S530,80 545,74"
        fill="none"
        stroke={MINT}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M20,140 C60,132 85,118 130,120 S220,90 240,96 S330,150 350,158 S450,185 460,188 S530,196 545,198 L545,225 L20,225 Z"
        fill="url(#lp-anx)"
      />
      <path
        d="M20,140 C60,132 85,118 130,120 S220,90 240,96 S330,150 350,158 S450,185 460,188 S530,196 545,198"
        fill="none"
        stroke={IRIS}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M20,205 C60,202 85,198 130,198 S220,192 240,188 S330,175 350,170 S450,150 460,146 S530,132 545,128 L545,225 L20,225 Z"
        fill="url(#lp-gra)"
      />
      <path
        d="M20,205 C60,202 85,198 130,198 S220,192 240,188 S330,175 350,170 S450,150 460,146 S530,132 545,128"
        fill="none"
        stroke={LILAC}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <g fill={DIM} fontSize="11" fontFamily="'Plus Jakarta Sans', sans-serif" textAnchor="middle" aria-hidden="true">
        <text x="20" y="238">M</text>
        <text x="108" y="238">T</text>
        <text x="196" y="238">W</text>
        <text x="284" y="238">T</text>
        <text x="372" y="238">F</text>
        <text x="460" y="238">S</text>
        <text x="545" y="238">S</text>
      </g>
    </svg>
  );
}

export default Landing;
