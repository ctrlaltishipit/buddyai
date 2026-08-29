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
    body: "Every feeling you confirm becomes a thread. Over a few weeks the threads make a shape, and the shape shows you things you would not have noticed on your own.",
    points: [
      "Each emotion drawn over a week, a month, or all of it",
      "Which feeling was loudest, and what shifted",
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
.tr-row { display: grid; grid-template-columns: 0.85fr 1.15fr; gap: 56px; align-items: center; }
.tr-row.flip .tr-copy { order: 2; }
.tr-shot { border-radius: 18px; overflow: hidden; border: 1px solid rgba(255,255,255,.10); box-shadow: 0 30px 70px rgba(0,0,0,.55); background: #FAF7F1; }
.tr-shot img { display: block; width: 100%; height: auto; }
.tr-anchor { scroll-margin-top: 76px; }
.tr-jump { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
.tr-jump a { display: inline-flex; align-items: center; gap: 8px; padding: 9px 15px; border-radius: 999px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.03); color: #B9B1A3; font-size: 13.5px; text-decoration: none; transition: border-color .15s ease, color .15s ease; }
.tr-jump a:hover { color: #F7F3EA; border-color: rgba(255,255,255,.3); }
@media (max-width: 900px) {
  .tr-row { grid-template-columns: 1fr; gap: 28px; }
  .tr-row.flip .tr-copy { order: 0; }
}
@media (max-width: 720px) {
  .tr-links { display: none; }
  .tr-nav { padding: 12px 18px; gap: 12px; }
}
`;

export function Tour() {
  const location = useLocation();

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
              Every screen below is the real app, not a mockup. It is built and working. We are opening
              access in waves, and early access puts you in the first one.
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
          <section key={s.id} id={s.id} className="tr-anchor px-6 pb-[72px]" aria-labelledby={`${s.id}-title`}>
            <div className={`container-lg tr-row${i % 2 === 1 ? " flip" : ""}`}>
              <div className="tr-copy">
                <p className="eyebrow" style={{ margin: "0 0 12px", color: s.color }}>
                  {s.eyebrow}
                </p>
                <h2
                  id={`${s.id}-title`}
                  className="h-display"
                  style={{ margin: "0 0 16px", fontSize: "clamp(27px, 3.3vw, 38px)", lineHeight: 1.12 }}
                >
                  {s.title}
                </h2>
                <p className="text-pretty text-[16px] leading-[1.65] text-fog" style={{ margin: "0 0 20px" }}>
                  {s.body}
                </p>
                <ul className="m-0 list-none p-0" style={{ display: "grid", gap: 10 }}>
                  {s.points.map((p) => (
                    <li key={p} className="flex gap-[10px] text-[15px] leading-[1.55] text-fog">
                      <span style={{ color: s.color, fontWeight: 700 }} aria-hidden="true">
                        ✓
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <figure className="tr-shot m-0">
                <img src={s.shot} alt={s.alt} width={1600} loading={i === 0 ? "eager" : "lazy"} decoding="async" />
              </figure>
            </div>
          </section>
        ))}

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
