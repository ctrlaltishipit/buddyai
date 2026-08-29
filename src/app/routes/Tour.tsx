/**
 * Tour — "Inside the app".
 *
 * Real screenshots of the built product, one section per area of the app, so
 * someone deciding whether to sign up can see exactly what they're joining.
 * Images live in public/shots and are captured from the running app, not mocked.
 */
import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import { BookOpen, House, MessageCircle, Settings as Cog, Waves, type LucideIcon } from "lucide-react";
import { BuddyBlob } from "../components/BuddyBlob";
import { Logo } from "../components/Logo";
import { SiteFooter } from "../components/SiteFooter";
import { useReveal } from "../lib/useReveal";

const MINT = "#FFD23F";
const IRIS = "#FF7A1A";
const LILAC = "#F24E1E";

interface Section {
  id: string;
  eyebrow: string;
  Icon: LucideIcon;
  color: string;
  title: string;
  body: string;
  points: string[];
  shot: string;
  alt: string;
}

const SECTIONS: Section[] = [
  {
    id: "home",
    eyebrow: "HOME",
    Icon: House,
    color: MINT,
    title: "It knows where you left off.",
    body: "You open buddy and it picks up the thread. What you've written this week, how often you've come back, and the feeling running underneath it all.",
    points: [
      "A read on the week that names a leaning, not a verdict",
      "Your streak, there to encourage and never to scold",
      "One tap into writing or into a conversation",
    ],
    shot: "/shots/home.png",
    alt: "The buddy home screen showing a weekly leaning, a six day streak and recent entries",
  },
  {
    id: "journal",
    eyebrow: "JOURNAL",
    Icon: BookOpen,
    color: IRIS,
    title: "Write it however it comes out.",
    body: "A sentence, a fragment, or the whole story. Start from a blank page when you have the words, or a prompt when you don't.",
    points: [
      "Freeform when you just need to get it out",
      "Guided formats for gratitude, check-ins and untangling a thought",
      "buddy suggests what it heard; you confirm or correct it",
    ],
    shot: "/shots/journal.png",
    alt: "The buddy journal screen with writing formats and earlier entries tagged with feelings",
  },
  {
    id: "reflector",
    eyebrow: "THE REFLECTOR",
    Icon: MessageCircle,
    color: LILAC,
    title: "Someone who listens and asks.",
    body: "For the times writing alone isn't enough. The Reflector hears what you said and asks the question underneath it. It never diagnoses, and it never tells you what to do.",
    points: [
      "Starters for when you don't know how to begin",
      "Questions that open things up instead of closing them down",
      "The conversation stays in your browser and is never saved",
    ],
    shot: "/shots/reflector.png",
    alt: "A conversation with the Reflector, which replies with a question rather than advice",
  },
  {
    id: "map",
    eyebrow: "EMOTION MAP",
    Icon: Waves,
    color: MINT,
    title: "See how you've been.",
    body: "Every feeling you confirm on an entry becomes a thread. Over a few weeks the threads make a shape, and the shape shows you things you would not have noticed on your own.",
    points: [
      "Each emotion drawn over a week, a month, or all of it",
      "Which feeling was most present, and what shifted",
      "Quiet noticings you are free to take or leave",
    ],
    shot: "/shots/map.png",
    alt: "The emotion map showing hope, gratitude and joy plotted across a week",
  },
  {
    id: "settings",
    eyebrow: "YOUR CONTROL",
    Icon: Cog,
    color: IRIS,
    title: "Everything is yours to take back.",
    body: "Your entries belong to your account and nobody else can open them. Change your buddy, change how it speaks, or take it all and leave, whenever you want.",
    points: [
      "Swap your companion or its tone at any time",
      "One reminder a day, on the days you pick, or none at all",
      "Export everything or delete everything in one click",
    ],
    shot: "/shots/settings.png",
    alt: "The buddy settings screen showing companion, reminders, privacy and account controls",
  },
];

const TOUR_CSS = `
.tr { overflow-x: clip; }
.tr-nav { max-width: 1180px; margin: 0 auto; padding: 14px 28px; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.tr-links { display: flex; align-items: center; gap: 26px; font-size: 14px; }
.tr-links a { color: #B9B1A3; text-decoration: none; transition: color .15s ease; min-height: 44px; display: inline-flex; align-items: center; }
.tr-links a:hover { color: #F7F3EA; }
.tr-anchor { scroll-margin-top: 84px; }

/* Each section owns a viewport and carries one slow drifting glow behind it,
   so there is always something quietly moving without competing with the copy. */
.tr-sec { position: relative; }
.tr-amb { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
.tr-amb .glow { opacity: .55; }

/* Lighter card: a hairline and a whisper of fill, not a heavy panel. */
.tr-card {
  position: relative;
  z-index: 1;
  max-width: 1000px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 52px;
  align-items: center;
  padding: 40px 44px;
  border-radius: 24px;
  border: 1px solid rgba(255,255,255,.055);
  background: rgba(255,255,255,.014);
  backdrop-filter: blur(2px);
}
.tr-card.flip { grid-template-columns: 320px 1fr; }
.tr-card.flip .tr-copy { order: 2; }
.tr-card.flip .tr-device { order: 1; }

.tr-device { display: flex; justify-content: center; }
/* The frame's padding changes the inner aspect ratio, so the screen carries the
   image's own ratio and the phone takes its height from that. Any mismatch here
   makes object-fit crop the sides and silently eat the UI. */
.tr-phone {
  position: relative;
  width: 100%;
  max-width: 300px;
  border-radius: 38px;
  padding: 9px;
  background: linear-gradient(160deg, #2A2621, #131110 60%);
  box-shadow: 0 0 0 1px rgba(255,255,255,.09), 0 26px 56px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.13);
}
.tr-phone::after {
  content: ""; position: absolute; top: 17px; left: 50%; transform: translateX(-50%);
  width: 72px; height: 6px; border-radius: 99px; background: rgba(0,0,0,.5); z-index: 2;
}
.tr-screen {
  width: 100%;
  aspect-ratio: 588 / 1200;
  border-radius: 30px;
  overflow: hidden;
  background: #FAF7F1;
}
.tr-screen img { display: block; width: 100%; height: 100%; object-fit: contain; }

/* Prose blocks share the card's lightness. */
.tr-band {
  position: relative; z-index: 1;
  max-width: 1000px; margin: 0 auto; padding: 40px 44px;
  border-radius: 24px; border: 1px solid rgba(255,255,255,.055);
  background: rgba(255,255,255,.014);
}
.tr-two { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
.tr-ritual h3 { font-size: 19px; margin: 0 0 9px; }
.tr-table-wrap { overflow-x: auto; border-radius: 14px; border: 1px solid rgba(255,255,255,.08); }
.tr-table { border-collapse: collapse; width: 100%; min-width: 600px; font-size: 14px; }
.tr-table th, .tr-table td { text-align: left; padding: 11px 14px; border-bottom: 1px solid rgba(255,255,255,.06); }
.tr-table thead th { font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: #7D766B; background: rgba(255,255,255,.025); }
.tr-table tbody tr:last-child td { border-bottom: 0; }
.tr-table td:first-child { color: #B9B1A3; }
.tr-table .tr-us { color: #F7F3EA; font-weight: 600; background: rgba(255,122,26,.05); }
.tr-table thead .tr-us { color: #FF7A1A; background: rgba(255,122,26,.08); }
.tr-limits { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.tr-limit { padding: 15px 16px; border-radius: 13px; border: 1px solid rgba(255,255,255,.07); background: rgba(255,255,255,.018); }

.tr-jump { display: flex; flex-wrap: wrap; gap: 9px; justify-content: center; }
.tr-jump a { display: inline-flex; align-items: center; gap: 7px; padding: 8px 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,.11); background: rgba(255,255,255,.025); color: #B9B1A3; font-size: 13px; text-decoration: none; transition: border-color .15s ease, color .15s ease; }
.tr-jump a:hover { color: #F7F3EA; border-color: rgba(255,255,255,.3); }

[data-reveal] { opacity: 0; transform: translateY(30px) scale(.99); transition: opacity .7s cubic-bezier(.2,.7,.2,1), transform .7s cubic-bezier(.2,.7,.2,1); will-change: opacity, transform; }
[data-reveal="in"] { opacity: 1; transform: none; }
[data-reveal] .tr-device { opacity: 0; transform: translateY(22px); transition: opacity .75s cubic-bezier(.2,.7,.2,1) .12s, transform .75s cubic-bezier(.2,.7,.2,1) .12s; }
[data-reveal="in"] .tr-device { opacity: 1; transform: none; }

@media (max-width: 980px) {
  .tr-card, .tr-card.flip { grid-template-columns: 1fr; gap: 30px; padding: 34px 26px; }
  .tr-card.flip .tr-copy, .tr-card.flip .tr-device { order: 0; }
  .tr-phone { max-width: 288px; }
  .tr-band { padding: 32px 26px; }
  .tr-two { grid-template-columns: 1fr; gap: 26px; }
  .tr-limits { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
  .tr-links { display: none; }
  .tr-nav { padding: 12px 18px; gap: 12px; }
  .tr-card, .tr-card.flip, .tr-band { padding: 26px 20px; border-radius: 20px; }
}
@media (prefers-reduced-motion: reduce) {
  [data-reveal], [data-reveal] .tr-device { opacity: 1; transform: none; transition: none; }
  .tr-amb .glow { animation: none !important; }
}
`;

/**
 * One slow-drifting glow behind a section. Deliberately faint: it should read
 * as something moving at the edge of vision, not as decoration competing with
 * the copy. Alternates side and colour so consecutive screens differ.
 */
function Ambient({ i, color }: { i: number; color: string }) {
  const right = i % 2 === 1;
  const tone = color === MINT ? "glow-sun" : color === LILAC ? "glow-ember" : "glow-orange";
  return (
    <div className="tr-amb" aria-hidden="true">
      <div
        className={`glow ${tone}`}
        style={{
          top: i % 3 === 0 ? "-14%" : "18%",
          [right ? "right" : "left"]: "-6%",
          width: 520,
          height: 520,
          animation: `drift-${right ? 2 : 1} ${26 + i * 4}s ease-in-out infinite`,
        }}
      />
      <div
        className="glow glow-orange"
        style={{
          bottom: "-18%",
          [right ? "left" : "right"]: "12%",
          width: 380,
          height: 380,
          opacity: 0.5,
          animation: `drift-${right ? 1 : 2} ${34 + i * 3}s ease-in-out infinite reverse`,
        }}
      />
    </div>
  );
}

export function Tour() {
  const location = useLocation();
  useReveal();

  useEffect(() => {
    const id = location.hash.replace(/^#/, "");
    if (!id) {
      window.scrollTo(0, 0);
      return;
    }
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ block: "start" });
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="surface-dark tr">
      <style>{TOUR_CSS}</style>

      <header
        className="sticky top-0 z-50"
        style={{
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          background: "rgba(10,9,8,.65)",
          borderBottom: "1px solid rgba(255,255,255,.07)",
        }}
      >
        <nav className="tr-nav" aria-label="Primary">
          <Logo tone="dark" to="/" />
          <div className="tr-links">
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
            <Link to="/#why">Why buddy</Link>
            <Link to="/#privacy">Privacy</Link>
          </div>
          <Link to="/signup" className="btn btn-grad btn-sm">
            Get early access
          </Link>
        </nav>
      </header>

      <main>
        {/* Intro */}
        <section className="px-6 pb-[46px] pt-[52px] text-center">
          <div className="mx-auto max-w-[760px]">
            <div className="anim-fade-up flex justify-center" style={{ marginBottom: 22 }}>
              <BuddyBlob size={92} float />
            </div>
            <p className="eyebrow text-mint" style={{ margin: "0 0 14px", fontSize: 12.5, letterSpacing: ".3em" }}>
              INSIDE THE APP
            </p>
            <h1
              className="h-display text-balance"
              style={{ margin: "0 auto 18px", maxWidth: 660, fontSize: "clamp(36px, 5.4vw, 58px)", lineHeight: 1.07, letterSpacing: "-0.03em" }}
            >
              This is what you're <span className="text-gradient">signing up for</span>.
            </h1>
            <p className="text-fog" style={{ margin: "0 auto 30px", maxWidth: 600, fontSize: 17, lineHeight: 1.6 }}>
              buddy is a phone app. Every screen below is the real thing, captured from the running
              build rather than mocked up. We are opening access in waves, and early access puts you in
              the first one.
            </p>
            <nav className="tr-jump" aria-label="Jump to a section">
              {SECTIONS.map(({ id, eyebrow, Icon, color }) => (
                <a key={id} href={`#${id}`}>
                  <Icon size={15} color={color} aria-hidden="true" />
                  {eyebrow.charAt(0) + eyebrow.slice(1).toLowerCase()}
                </a>
              ))}
            </nav>
          </div>
        </section>

        {/* Sections */}
        {SECTIONS.map((s, i) => (
          <section
            key={s.id}
            id={s.id}
            className="tr-anchor tr-sec px-6"
            style={{ paddingTop: 30, paddingBottom: 30 }}
            aria-labelledby={`${s.id}-title`}
          >
            <Ambient i={i} color={s.color} />
            <div className={`tr-card${i % 2 === 1 ? " flip" : ""}`} data-reveal="">
              <div className="tr-copy">
                <p className="eyebrow" style={{ margin: "0 0 12px", color: s.color }}>
                  {s.eyebrow}
                </p>
                <h2
                  id={`${s.id}-title`}
                  className="h-display"
                  style={{ margin: "0 0 16px", fontSize: "clamp(27px, 3.1vw, 36px)", lineHeight: 1.14 }}
                >
                  {s.title}
                </h2>
                <p className="text-pretty text-[16px] leading-[1.65] text-fog" style={{ margin: "0 0 22px", maxWidth: "46ch" }}>
                  {s.body}
                </p>
                <ul className="m-0 list-none p-0" style={{ display: "grid", gap: 11 }}>
                  {s.points.map((pt) => (
                    <li key={pt} className="flex gap-[11px] text-[15px] leading-[1.55] text-fog">
                      <span style={{ color: s.color, fontWeight: 700 }} aria-hidden="true">
                        ✓
                      </span>
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="tr-device">
                <div className="tr-phone">
                  <div className="tr-screen">
                    <img
                      src={s.shot}
                      alt={s.alt}
                      width={588}
                      height={1200}
                      loading={i === 0 ? "eager" : "lazy"}
                      decoding="async"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        ))}

        {/* Why coming back matters. Tied to the map, not to a badge. */}
        <section className="tr-anchor tr-sec px-6" id="streak" style={{ paddingTop: 30, paddingBottom: 30 }}>
          <Ambient i={5} color={MINT} />
          <div className="tr-band" data-reveal="">
            <p className="eyebrow" style={{ margin: "0 0 12px", color: MINT }}>
              COMING BACK
            </p>
            <h2 className="h-display" style={{ margin: "0 0 16px", fontSize: "clamp(26px, 3.1vw, 36px)", lineHeight: 1.14, maxWidth: "20ch" }}>
              A streak here is not a badge.
            </h2>
            <div className="tr-two" style={{ marginTop: 22 }}>
              <div>
                <p className="text-[16px] leading-[1.68] text-fog" style={{ margin: "0 0 14px" }}>
                  The map can only show you what you gave it. Three entries in a month is a chart with
                  three dots and nothing to say. Write four or five times a week and it can tell you that
                  Sunday nights run anxious, or that the word you keep reaching for is not sad, it is
                  tired.
                </p>
                <p className="text-[16px] leading-[1.68] text-fog" style={{ margin: 0 }}>
                  You cannot see a pattern from inside a single bad day. That is the whole reason to come
                  back. Not to keep a number alive.
                </p>
              </div>
              <div>
                <p className="text-[16px] leading-[1.68] text-fog" style={{ margin: "0 0 14px" }}>
                  So the reward for showing up is not points. It is resolution. The more you write, the
                  sharper the map gets and the more confident its noticings become.
                </p>
                <p className="text-[15px] leading-[1.65] text-dim" style={{ margin: 0 }}>
                  Miss a day and nothing dies, nothing turns red, and buddy will not guilt you into
                  opening it. Some weeks you are fine and do not need this. That is a good outcome, not a
                  failure.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Not another journal */}
        <section className="tr-anchor tr-sec px-6" id="different" style={{ paddingTop: 30, paddingBottom: 30 }}>
          <Ambient i={6} color={LILAC} />
          <div className="tr-band" data-reveal="">
            <p className="eyebrow" style={{ margin: "0 0 12px", color: LILAC }}>
              WHAT MAKES IT DIFFERENT
            </p>
            <h2 className="h-display" style={{ margin: "0 0 14px", fontSize: "clamp(26px, 3.1vw, 36px)", lineHeight: 1.14 }}>
              Not another journal.
            </h2>
            <p className="text-[16px] leading-[1.68] text-fog" style={{ margin: "0 0 26px", maxWidth: "62ch" }}>
              A notes app holds your words. A paper journal holds them and asks nothing. A general AI
              chat answers fast, forgets you tomorrow, and is happy to tell you what to do about your
              marriage. buddy sits somewhere none of those do.
            </p>
            <div className="tr-table-wrap">
              <table className="tr-table">
                <thead>
                  <tr>
                    <th scope="col" />
                    <th scope="col">notes app</th>
                    <th scope="col">paper journal</th>
                    <th scope="col">general AI chat</th>
                    <th scope="col" className="tr-us">buddy</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Writes back", "no", "no", "yes", "yes, by asking"],
                    ["Remembers your weeks", "no", "if you reread", "not really", "as an emotion map"],
                    ["Names what you felt", "no", "you do", "inconsistently", "suggests it, you confirm"],
                    ["Shows patterns over time", "no", "no", "no", "most present, biggest shift"],
                    ["Gives advice", "no", "no", "constantly", "no, by design"],
                    ["Has a shape when you are blank", "no", "no", "you must prompt it", "guided formats"],
                  ].map((row) => (
                    <tr key={row[0]}>
                      <th scope="row" style={{ color: "#B9B1A3", fontWeight: 500 }}>
                        {row[0]}
                      </th>
                      <td>{row[1]}</td>
                      <td>{row[2]}</td>
                      <td>{row[3]}</td>
                      <td className="tr-us">{row[4]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[16px] leading-[1.68] text-fog" style={{ margin: "24px 0 0", maxWidth: "62ch" }}>
              A chatbot gives you an answer and moves on. A journal lets you rewrite the same bad night
              fifty times and never notice. buddy shows you the fifty nights on one chart. That is the
              difference between sitting in it and seeing it.
            </p>
          </div>
        </section>

        {/* Daily ritual */}
        <section className="tr-anchor tr-sec px-6" id="ritual" style={{ paddingTop: 30, paddingBottom: 30 }}>
          <Ambient i={7} color={IRIS} />
          <div className="tr-band" data-reveal="">
            <p className="eyebrow" style={{ margin: "0 0 12px", color: IRIS }}>
              A PLACE IN YOUR DAY
            </p>
            <h2 className="h-display" style={{ margin: "0 0 26px", fontSize: "clamp(26px, 3.1vw, 36px)", lineHeight: 1.14 }}>
              Two minutes, twice a day.
            </h2>
            <div className="tr-two tr-ritual">
              <div>
                <h3 className="font-display" style={{ color: MINT }}>Start your day</h3>
                <p className="text-[16px] leading-[1.68] text-fog" style={{ margin: 0 }}>
                  Open buddy and see which way your week has been leaning. Take two minutes with a
                  check-in, body, mind and heart, and name where you are actually starting from. It is a
                  smaller thing than a plan, and it makes the rest of the day less of a surprise.
                </p>
              </div>
              <div>
                <h3 className="font-display" style={{ color: LILAC }}>End your night</h3>
                <p className="text-[16px] leading-[1.68] text-fog" style={{ margin: 0 }}>
                  Write it out, or just talk. Say what happened, or the one thing that will not leave you
                  alone. buddy suggests what it heard you feeling, you fix it if it got it wrong, and that
                  feeling joins the map. Then you put the phone down.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Depth and limits */}
        <section className="tr-anchor tr-sec px-6" id="limits" style={{ paddingTop: 30, paddingBottom: 30 }}>
          <Ambient i={8} color={MINT} />
          <div className="tr-band" data-reveal="">
            <p className="eyebrow" style={{ margin: "0 0 12px", color: MINT }}>
              YOU SET THE DEPTH
            </p>
            <h2 className="h-display" style={{ margin: "0 0 16px", fontSize: "clamp(26px, 3.1vw, 36px)", lineHeight: 1.14, maxWidth: "22ch" }}>
              As far as you want to go, and no further.
            </h2>
            <p className="text-[16px] leading-[1.68] text-fog" style={{ margin: "0 0 26px", maxWidth: "62ch" }}>
              Some nights you want to write one line and close the app. Some nights you want to talk for
              an hour. Both are fine. buddy will not push you to say more than you came to say, and it
              will not tell you what your problem is, because a companion that hands out answers at
              midnight is not actually helping you hear yourself.
            </p>
            <div className="tr-limits">
              {[
                ["It is not a therapist.", "buddy cannot diagnose you and will not try. For anything heavy or ongoing, a real professional is the right call, and buddy will say so."],
                ["It stops if you are in danger.", "If something you write sounds like a crisis, buddy stops the conversation and shows you real helplines instead of carrying on."],
                ["Your words stay yours.", "Entries are private to your account. Export everything or delete everything, whenever you want, in one click."],
              ].map(([h, b]) => (
                <div key={h} className="tr-limit">
                  <p className="font-display" style={{ margin: "0 0 5px", fontSize: 16.5, fontWeight: 600 }}>
                    {h}
                  </p>
                  <p className="text-[15px] leading-[1.6] text-fog" style={{ margin: 0 }}>
                    {b}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bridge back to the promise */}
        <section className="px-6 pb-[64px]">
          <div className="container-lg text-center">
            <h2 className="h-display" style={{ margin: "0 auto 14px", maxWidth: 640, fontSize: "clamp(26px, 3.2vw, 36px)" }}>
              Five parts, one thing.
            </h2>
            <p className="text-fog" style={{ margin: "0 auto", maxWidth: 560, fontSize: 16, lineHeight: 1.65 }}>
              Somewhere to put it down, someone to say it to, and a way to see what it all adds up to.
              That is the whole app.{" "}
              <Link to="/#why" style={{ color: IRIS }}>
                Why we built it this way
              </Link>
              .
            </p>
          </div>
        </section>
      </main>

      <SiteFooter
        title="Want in early?"
        blurb="Create your buddy, sign up with Google, and we will email you the moment access opens."
      />
    </div>
  );
}

export default Tour;
