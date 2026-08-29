/**
 * EarlyAccess — the whole public sign-up funnel, in two steps.
 *
 *   1. Create your buddy   pick a companion, optionally name yourself
 *   2. Continue with Google  Supabase OAuth; the confirmation lives in Welcome
 *
 * The companion choice is made before the OAuth round trip, so it is stashed
 * in localStorage and picked up again by /welcome once Google sends the user
 * back.
 */
import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { BuddyBlob } from "../components/BuddyBlob";
import { FieldDark } from "../components/FieldDark";
import { Logo } from "../components/Logo";
import { COMPANIONS } from "../lib/constants";
import { oauthRedirectTo, supabase } from "../lib/supabase";
import { trackEvent } from "../lib/analytics";
import type { CompanionId } from "../lib/types";

/** Survives the OAuth redirect, which is a full page load. */
export const PENDING_KEY = "buddy_pending_signup";

export interface PendingSignup {
  companion: CompanionId;
  display_name: string;
}

export function savePending(v: PendingSignup): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(v));
  } catch {
    /* private browsing; /welcome falls back to defaults */
  }
}

export function readPending(): PendingSignup {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (raw) return JSON.parse(raw) as PendingSignup;
  } catch {
    /* noop */
  }
  return { companion: "sage", display_name: "" };
}

/* Google's dark-theme button spec, adapted to the buddy surface. The label is
   optically centred by padding the row with an icon-sized spacer on both sides. */
const GSI_CSS = `
.gsi-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 52px;
  padding: 0 16px;
  border-radius: 26px;
  border: 1px solid #5F6368;
  background: #131314;
  color: #E3E3E3;
  font-family: inherit;
  font-size: 15.5px;
  font-weight: 500;
  letter-spacing: .1px;
  cursor: pointer;
  transition: background .15s ease, border-color .15s ease, box-shadow .15s ease;
}
.gsi-btn:hover:not(:disabled) {
  background: #1B1B1C;
  border-color: #8E918F;
  box-shadow: 0 1px 3px rgba(0,0,0,.4);
}
.gsi-btn:active:not(:disabled) { background: #202021; }
.gsi-btn:focus-visible {
  outline: none;
  border-color: #FF7A1A;
  box-shadow: 0 0 0 3px rgba(255,122,26,.28);
}
.gsi-btn:disabled { opacity: .75; cursor: default; }
.gsi-icon {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  flex: none;
}
.gsi-label { flex: 1; text-align: center; }
`;

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.0 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.0 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C37 41.2 44 36 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

export function EarlyAccess() {
  const [step, setStep] = useState<1 | 2>(1);
  const [companion, setCompanion] = useState<CompanionId>("sage");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = COMPANIONS.find((c) => c.id === companion) ?? COMPANIONS[0];

  function goToSignIn() {
    savePending({ companion, display_name: name.trim() });
    trackEvent("waitlist_buddy_created", { companion });
    setStep(2);
  }

  async function signInWithGoogle() {
    setError(null);
    if (!supabase) {
      setError("Sign-up isn't switched on yet. Please check back shortly.");
      return;
    }
    setPending(true);
    savePending({ companion, display_name: name.trim() });
    trackEvent("waitlist_google_started", { companion });

    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: oauthRedirectTo() },
    });
    if (err) {
      setError("Couldn't reach Google. Please try again.");
      setPending(false);
    }
    // On success the browser navigates away to Google.
  }

  return (
    <div className="surface-dark" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <style>{GSI_CSS}</style>
      <header style={{ padding: "18px 24px" }}>
        <Logo tone="dark" to="/" />
      </header>

      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px 20px 64px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 460 }}>
          <p className="eyebrow text-mint" style={{ margin: "0 0 12px", textAlign: "center" }}>
            {step === 1 ? "STEP 1 OF 2" : "STEP 2 OF 2"}
          </p>

          {step === 1 ? (
            <>
              <h1
                className="h-display"
                style={{ margin: "0 0 8px", fontSize: 34, textAlign: "center", lineHeight: 1.15 }}
              >
                Create your buddy.
              </h1>
              <p className="text-fog" style={{ margin: "0 0 28px", textAlign: "center", fontSize: 15.5 }}>
                Pick who you want to talk to. You can change this later.
              </p>

              <div style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}>
                <BuddyBlob size={132} colors={chosen.colors} float />
              </div>

              <div role="radiogroup" aria-label="Choose your companion" style={{ display: "grid", gap: 10, marginBottom: 22 }}>
                {COMPANIONS.map((c) => {
                  const active = c.id === companion;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setCompanion(c.id)}
                      className="card-dark hoverable"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: "14px 16px",
                        textAlign: "left",
                        cursor: "pointer",
                        border: active ? "1.5px solid #FF7A1A" : undefined,
                        background: active ? "rgba(255,122,26,.08)" : undefined,
                      }}
                    >
                      <BuddyBlob size={40} colors={c.colors} eyes={false} />
                      <span style={{ flex: 1 }}>
                        <span className="font-display" style={{ display: "block", fontSize: 16, fontWeight: 600 }}>
                          {c.name}
                        </span>
                        <span className="text-fog" style={{ fontSize: 13.5 }}>{c.trait}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <FieldDark
                name="display_name"
                label="What should Buddy call you?"
                placeholder="Your first name (optional)"
                value={name}
                autoComplete="given-name"
                onChange={(e) => setName(e.target.value)}
                containerClassName="mb-6"
              />

              <button type="button" className="btn btn-grad btn-block btn-lg" onClick={goToSignIn}>
                Continue <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <h1
                className="h-display"
                style={{ margin: "0 0 8px", fontSize: 34, textAlign: "center", lineHeight: 1.15 }}
              >
                Claim your early access.
              </h1>
              <p className="text-fog" style={{ margin: "0 0 28px", textAlign: "center", fontSize: 15.5 }}>
                Sign up with Google and we will email you the moment app access opens.
              </p>

              <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
                <BuddyBlob size={110} colors={chosen.colors} float />
              </div>

              <button
                type="button"
                className="gsi-btn"
                onClick={() => void signInWithGoogle()}
                disabled={pending}
                aria-label="Continue with Google"
              >
                <span className="gsi-icon" aria-hidden="true">
                  {pending ? <span className="spinner" /> : <GoogleMark />}
                </span>
                <span className="gsi-label">{pending ? "Opening Google\u2026" : "Continue with Google"}</span>
                <span className="gsi-icon" aria-hidden="true" />
              </button>

              {error && (
                <p className="form-error" role="alert" style={{ marginTop: 14, textAlign: "center" }}>
                  {error}
                </p>
              )}

              <p className="text-dim" style={{ margin: "18px 0 0", fontSize: 12.5, textAlign: "center", lineHeight: 1.6 }}>
                We only use your email to tell you when access opens.
                <br />
                No posting, no sharing, no spam.
              </p>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-ghost-dark"
                style={{ margin: "22px auto 0", display: "flex", alignItems: "center", gap: 7 }}
              >
                <ArrowLeft size={15} aria-hidden="true" /> Back
              </button>
            </>
          )}

          <p className="text-dim" style={{ margin: "26px 0 0", fontSize: 12.5, textAlign: "center" }}>
            <Link to="/" style={{ color: "inherit" }}>
              Back to buddy.ai
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default EarlyAccess;
