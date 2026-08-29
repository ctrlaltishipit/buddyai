/**
 * About — why buddy exists.
 *
 * The problem it is trying to solve, the vision, the mission, and the
 * principles we hold ourselves to. Everything claimed here is true of the
 * product as built; anything still on the roadmap is named as such.
 */
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { ArrowUpRight } from "lucide-react";
import { BuddyBlob } from "../components/BuddyBlob";
import { Logo } from "../components/Logo";
import { SiteFooter } from "../components/SiteFooter";
import { useReveal } from "../lib/useReveal";

const MINT = "#FFD23F";
const IRIS = "#FF7A1A";
const LILAC = "#F24E1E";

const PRINCIPLES: Array<{ title: string; body: string; color: string }> = [
  {
    title: "Listening comes before fixing.",
    body: "buddy asks questions and stays with what you said. It will not diagnose you and it will not hand you advice you did not ask for, because being told what to do at midnight is not the same as being heard.",
    color: MINT,
  },
  {
    title: "You name your own feelings.",
    body: "buddy suggests what it heard, and you confirm it or correct it. The record is written by you, not decided about you. That one difference is why the map is worth trusting later.",
    color: IRIS,
  },
  {
    title: "Nothing is engineered to hurt.",
    body: "No dying streaks, no guilt, no pressure to come back. If you are having a good month and do not need buddy, that is the product working, not a user we lost.",
    color: LILAC,
  },
  {
    title: "Your words stay yours.",
    body: "Entries are private to your account. Export everything or delete everything, in one click, whenever you want. We would rather you be able to leave than feel stuck.",
    color: IRIS,
  },
];

const ABOUT_CSS = `
.ab-nav { max-width: 1180px; margin: 0 auto; padding: 14px 28px; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.ab-links { display: flex; align-items: center; gap: 26px; font-size: 14px; }
.ab-links a { color: #B9B1A3; text-decoration: none; transition: color .15s ease; min-height: 44px; display: inline-flex; align-items: center; }
.ab-links a:hover { color: #F7F3EA; }
.ab-sec { position: relative; }
.ab-amb { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
.ab-amb .glow { opacity: .5; }
.ab-band {
  position: relative; z-index: 1;
  max-width: 860px; margin: 0 auto; padding: 40px 44px;
  border-radius: 24px; border: 1px solid rgba(255,255,255,.055);
  background: rgba(255,255,255,.014);
}
.ab-lede { font-size: 19px; line-height: 1.62; }
.ab-two { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.ab-card { padding: 26px 28px; border-radius: 20px; border: 1px solid rgba(255,255,255,.07); background: rgba(255,255,255,.018); }
.ab-principles { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.ab-founder { display: grid; grid-template-columns: 168px 1fr; gap: 30px; align-items: start; }
.ab-photo { width: 168px; height: 168px; border-radius: 22px; overflow: hidden; border: 1px solid rgba(255,255,255,.10); background: linear-gradient(160deg, #2A2621, #131110); flex: none; }
.ab-photo img { display: block; width: 100%; height: 100%; object-fit: cover; filter: grayscale(1) contrast(1.03); }
.ab-mono { width: 100%; height: 100%; display: grid; place-items: center; font-size: 46px; font-weight: 700; color: #FFD23F; font-family: var(--font-display), sans-serif; }
.ab-li { display: inline-flex; align-items: center; gap: 7px; color: #FF7A1A; text-decoration: none; font-size: 15px; font-weight: 600; }
.ab-li:hover { text-decoration: underline; }
@media (max-width: 860px) { .ab-founder { grid-template-columns: 1fr; gap: 20px; } }
.ab-p { padding: 22px 24px; border-radius: 18px; border: 1px solid rgba(255,255,255,.07); background: rgba(255,255,255,.018); }
@media (max-width: 860px) {
  .ab-links { display: none; }
  .ab-nav { padding: 12px 18px; gap: 12px; }
  .ab-band { padding: 32px 24px; }
  .ab-two, .ab-principles { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) { .ab-amb .glow { animation: none !important; } }
`;

function Amb({ i, tone }: { i: number; tone: string }) {
  const right = i % 2 === 1;
  return (
    <div className="ab-amb" aria-hidden="true">
      <div
        className={`glow ${tone}`}
        style={{
          top: i % 3 === 0 ? "-16%" : "14%",
          [right ? "right" : "left"]: "-8%",
          width: 500,
          height: 500,
          animation: `drift-${right ? 2 : 1} ${28 + i * 5}s ease-in-out infinite`,
        }}
      />
    </div>
  );
}

export function About() {
  const location = useLocation();
  const [photoOk, setPhotoOk] = useState(true);
  useReveal();

  useEffect(() => {
    const id = location.hash.replace(/^#/, "");
    if (!id) {
      window.scrollTo(0, 0);
      return;
    }
    document.getElementById(id)?.scrollIntoView({ block: "start" });
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="surface-dark" style={{ overflowX: "clip" }}>
      <style>{ABOUT_CSS}</style>

      <header
        className="sticky top-0 z-50"
        style={{
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          background: "rgba(10,9,8,.65)",
          borderBottom: "1px solid rgba(255,255,255,.07)",
        }}
      >
        <nav className="ab-nav" aria-label="Primary">
          <Logo tone="dark" to="/" />
          <div className="ab-links">
            <Link to="/">Home</Link>
            <Link to="/tour">Inside the app</Link>
            <Link to="/#privacy">Privacy</Link>
          </div>
          <Link to="/signup" className="btn btn-grad btn-sm">
            Get early access
          </Link>
        </nav>
      </header>

      <main>
        {/* Intro */}
        <section className="ab-sec px-6 pb-[36px] pt-[52px] text-center">
          <Amb i={0} tone="glow-sun" />
          <div className="relative mx-auto max-w-[720px]" style={{ zIndex: 1 }}>
            <div className="flex justify-center" style={{ marginBottom: 22 }}>
              <BuddyBlob size={88} float />
            </div>
            <p className="eyebrow text-mint" style={{ margin: "0 0 14px", fontSize: 12.5, letterSpacing: ".3em" }}>
              ABOUT
            </p>
            <h1
              className="h-display text-balance"
              style={{ margin: "0 auto 18px", maxWidth: 620, fontSize: "clamp(34px, 5vw, 54px)", lineHeight: 1.08, letterSpacing: "-0.03em" }}
            >
              Why we're building <span className="text-gradient">buddy</span>.
            </h1>
            <p className="ab-lede text-fog" style={{ margin: "0 auto", maxWidth: 580 }}>
              Most people have someone they could call. Almost nobody calls them at 2am.
            </p>
          </div>
        </section>

        {/* The problem */}
        <section className="ab-sec px-6" id="problem" style={{ paddingTop: 24, paddingBottom: 24 }}>
          <Amb i={1} tone="glow-ember" />
          <div className="ab-band" data-reveal="">
            <p className="eyebrow" style={{ margin: "0 0 12px", color: LILAC }}>
              THE PROBLEM
            </p>
            <h2 className="h-display" style={{ margin: "0 0 18px", fontSize: "clamp(25px, 3vw, 34px)", lineHeight: 1.16 }}>
              The feeling arrives at the wrong hour.
            </h2>
            <p className="text-[16.5px] leading-[1.68] text-fog" style={{ margin: "0 0 15px" }}>
              It is late. Something is sitting on your chest. Everyone you would call is asleep, or
              busy, or you do not want to be the friend who keeps bringing this up. So you scroll
              instead, and the feeling goes nowhere.
            </p>
            <p className="text-[16.5px] leading-[1.68] text-fog" style={{ margin: "0 0 15px" }}>
              The next morning it is gone, mostly. And that is the real loss. Not the bad night, but
              that it left no trace. Six months later you cannot tell anyone whether it has been
              getting better or worse, because nobody remembers their own weeks accurately. You only
              remember how you feel right now, and you assume it has always been this way.
            </p>
            <p className="text-[16.5px] leading-[1.68] text-fog" style={{ margin: 0 }}>
              Journals ask you to write when you have the least energy to write. Mood trackers reduce
              a whole day to one tap, which tells you nothing come March. And a general chatbot will
              talk to you at 2am, then forget you completely by morning.
            </p>
          </div>
        </section>

        {/* Vision + mission */}
        <section className="ab-sec px-6" id="vision" style={{ paddingTop: 24, paddingBottom: 24 }}>
          <Amb i={2} tone="glow-orange" />
          <div className="ab-band" data-reveal="">
            <div className="ab-two">
              <div className="ab-card">
                <p className="eyebrow" style={{ margin: "0 0 10px", color: MINT }}>
                  OUR VISION
                </p>
                <p className="text-[17px] leading-[1.62]" style={{ margin: 0, color: "#F7F3EA" }}>
                  That nobody has to sit with a feeling alone just because of the hour, and that
                  everyone can see the shape of their own year instead of guessing at it.
                </p>
              </div>
              <div className="ab-card">
                <p className="eyebrow" style={{ margin: "0 0 10px", color: IRIS }}>
                  OUR MISSION
                </p>
                <p className="text-[17px] leading-[1.62]" style={{ margin: 0, color: "#F7F3EA" }}>
                  Build something you can talk to at any hour that turns what you said into a record
                  of how you actually felt, so the talking adds up to knowing yourself better.
                </p>
              </div>
            </div>
            <p className="text-[16.5px] leading-[1.68] text-fog" style={{ margin: "22px 0 0" }}>
              That second half is the part most apps skip. Talking helps in the moment. A record helps
              in six months. buddy is built so the same two minutes gives you both.
            </p>
          </div>
        </section>

        {/* Principles */}
        <section className="ab-sec px-6" id="principles" style={{ paddingTop: 24, paddingBottom: 24 }}>
          <Amb i={3} tone="glow-sun" />
          <div className="ab-band" data-reveal="">
            <p className="eyebrow" style={{ margin: "0 0 12px", color: MINT }}>
              WHAT WE HOLD TO
            </p>
            <h2 className="h-display" style={{ margin: "0 0 24px", fontSize: "clamp(25px, 3vw, 34px)", lineHeight: 1.16 }}>
              Four things we will not trade away.
            </h2>
            <div className="ab-principles">
              {PRINCIPLES.map((pr) => (
                <div key={pr.title} className="ab-p">
                  <p className="font-display" style={{ margin: "0 0 7px", fontSize: 16.5, fontWeight: 600, color: pr.color }}>
                    {pr.title}
                  </p>
                  <p className="text-[15px] leading-[1.62] text-fog" style={{ margin: 0 }}>
                    {pr.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Who is behind it */}
        <section className="ab-sec px-6" id="founder" style={{ paddingTop: 24, paddingBottom: 24 }}>
          <Amb i={5} tone="glow-orange" />
          <div className="ab-band" data-reveal="">
            <p className="eyebrow" style={{ margin: "0 0 12px", color: LILAC }}>
              WHO IS BEHIND IT
            </p>
            <div className="ab-founder">
              <div className="ab-photo">
                {photoOk ? (
                  <img
                    src="/founder.jpg"
                    alt="Deekshitha Sreerala"
                    width={168}
                    height={168}
                    loading="lazy"
                    decoding="async"
                    onError={() => setPhotoOk(false)}
                  />
                ) : (
                  <span className="ab-mono" aria-hidden="true">
                    D
                  </span>
                )}
              </div>
              <div>
                <h2 className="h-display" style={{ margin: "0 0 4px", fontSize: "clamp(23px, 2.6vw, 30px)", lineHeight: 1.16 }}>
                  Deekshitha Sreerala
                </h2>
                <p className="text-dim" style={{ margin: "0 0 16px", fontSize: 14.5, letterSpacing: ".02em" }}>
                  Founder · Product and AI
                </p>
                <p className="text-[16.5px] leading-[1.68] text-fog" style={{ margin: "0 0 14px" }}>
                  Deekshitha works across product management, marketing and go-to-market, with a
                  systems thinking habit of pulling on a thread until the whole shape shows. Her line
                  is turning "what ifs" into "what's next". buddy is one of those what ifs.
                </p>
                <p className="text-[16.5px] leading-[1.68] text-fog" style={{ margin: "0 0 14px" }}>
                  It started from something small and stubborn: the moment you most want to talk is
                  usually the moment there is nobody to talk to. Not because people do not care, but
                  because it is late, or because you do not want to be the friend who keeps bringing
                  this up again.
                </p>
                <p className="text-[16.5px] leading-[1.68] text-fog" style={{ margin: "0 0 18px" }}>
                  So the aim was never to build something clever. It was to build something that
                  listens properly, refuses to hand out advice it has no business giving, and quietly
                  keeps a record you own, so that months of hard nights add up to something you can
                  actually look at.
                </p>
                <a
                  className="ab-li"
                  href="https://www.linkedin.com/in/deekshitha-sreerala/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Connect on LinkedIn
                  <ArrowUpRight size={16} strokeWidth={2.3} aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Honest state of things */}
        <section className="ab-sec px-6" id="where-we-are" style={{ paddingTop: 24, paddingBottom: 30 }}>
          <Amb i={4} tone="glow-ember" />
          <div className="ab-band" data-reveal="">
            <p className="eyebrow" style={{ margin: "0 0 12px", color: IRIS }}>
              WHERE WE ARE
            </p>
            <h2 className="h-display" style={{ margin: "0 0 16px", fontSize: "clamp(25px, 3vw, 34px)", lineHeight: 1.16 }}>
              Built, and not yet open.
            </h2>
            <p className="text-[16.5px] leading-[1.68] text-fog" style={{ margin: "0 0 15px" }}>
              The app works. Writing, the companion, the emotion map and the privacy controls are all
              real, and you can see every screen of it on the{" "}
              <Link to="/tour" style={{ color: IRIS }}>
                inside the app
              </Link>{" "}
              page. We are opening access in waves so we can watch it carefully with a small number of
              people first, which matters more than usual for something people use on their worst
              nights.
            </p>
            <p className="text-[16.5px] leading-[1.68] text-fog" style={{ margin: 0 }}>
              buddy is not a therapist and does not try to be. It cannot diagnose, and for anything
              heavy or ongoing a real professional is the right call. If something you write sounds
              like a crisis, buddy stops and points you to people who can actually help.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter
        title="Come in early."
        blurb="Create your buddy, sign up with Google, and we will email you the moment access opens."
      />
    </div>
  );
}

export default About;
