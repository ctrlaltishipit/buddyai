/**
 * Shared footer for the public pages (Landing, Tour).
 *
 * Carries the early-access call to action on every page, so a visitor can sign
 * up from wherever they stopped reading, plus the care disclaimer that has to
 * appear anywhere we talk about feelings.
 */
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";

const MINT = "#FFD23F";
const IRIS = "#FF7A1A";
const LILAC = "#F24E1E";

export interface SiteFooterProps {
  /** Headline above the call to action. */
  title?: string;
  /** Supporting line. */
  blurb?: string;
}

export function SiteFooter({
  title = "Ready when you are.",
  blurb = "Create your buddy, sign up with Google, and we will email you the moment app access opens.",
}: SiteFooterProps) {
  return (
    <>
      <section className="px-6 pb-[64px]" aria-labelledby="footer-cta-title">
        <div
          className="panel-grad strong lp-cta-panel relative mx-auto max-w-[900px] overflow-hidden text-center"
          style={{ borderRadius: 30, padding: "60px 32px" }}
        >
          <h2
            id="footer-cta-title"
            className="h-display relative"
            style={{ margin: "0 0 12px", fontSize: "clamp(30px, 4.2vw, 44px)" }}
          >
            {title}
          </h2>
          <p
            className="relative text-[16.5px] leading-[1.6] text-fog"
            style={{ margin: "0 auto 30px", maxWidth: 470 }}
          >
            {blurb}
          </p>
          <div className="relative flex flex-wrap justify-center gap-[14px]">
            <Link to="/signup" className="btn btn-grad btn-lg">
              Create your buddy for early access{" "}
              <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="px-6 pb-11 pt-9" style={{ borderTop: "1px solid rgba(255,255,255,.07)" }}>
        <div className="container-lg flex flex-col gap-[18px]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              to="/"
              className="flex items-center gap-[9px] no-underline"
              style={{ color: "inherit" }}
              aria-label="buddy.ai home"
            >
              <span
                className="block h-[22px] w-[22px]"
                aria-hidden="true"
                style={{
                  borderRadius: "46% 54% 55% 45% / 53% 47% 53% 47%",
                  background: `linear-gradient(160deg, ${MINT} 25%, ${IRIS} 60%, ${LILAC} 92%)`,
                }}
              />
              <span className="font-display text-[16px] font-bold">buddy.ai</span>
            </Link>
            <nav className="lp-footer-links flex flex-wrap gap-[22px] text-[13.5px]" aria-label="Footer">
              <Link to="/">Home</Link>
              <Link to="/tour">Inside the app</Link>
              <Link to="/#privacy">Privacy</Link>
              <Link to="/signup">Early access</Link>
            </nav>
          </div>
          <p className="m-0 text-[12px] leading-[1.6] text-dim">
            buddy is not a substitute for professional care. If you're in crisis, please reach out to a
            hotline. buddy can help you find one.
            <br />© 2026 buddy.ai. Yours alone.
          </p>
        </div>
      </footer>
    </>
  );
}

export default SiteFooter;
