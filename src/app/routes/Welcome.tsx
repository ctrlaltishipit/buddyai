/**
 * Welcome — where Google sends people back to.
 *
 * Reads the Supabase session, calls the join-waitlist Edge Function (which
 * records the signup and sends the confirmation email), then confirms.
 *
 * Landing here without a session means the OAuth round trip failed, so the
 * screen offers a way back rather than hanging on a spinner.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Check, Mail } from "lucide-react";
import { BuddyBlob } from "../components/BuddyBlob";
import { Logo } from "../components/Logo";
import { companionById } from "../lib/constants";
import { readPending, PENDING_KEY } from "./EarlyAccess";
import { supabase } from "../lib/supabase";
import { trackEvent } from "../lib/analytics";

type Status = "working" | "done" | "no-session" | "error";

export function Welcome() {
  const [status, setStatus] = useState<Status>("working");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [emailed, setEmailed] = useState(false);
  const pending = readPending();
  const companion = companionById(pending.companion);
  // React 18 StrictMode double-invokes effects in dev; only join once.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    void (async () => {
      if (!supabase) {
        setStatus("error");
        return;
      }

      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session?.user?.email) {
        setStatus("no-session");
        return;
      }

      setEmail(session.user.email);
      const full =
        pending.display_name ||
        (session.user.user_metadata?.full_name as string | undefined) ||
        "";
      setFirstName(full.split(/\s+/)[0] ?? "");

      const { data: result, error } = await supabase.functions.invoke("join-waitlist", {
        body: {
          companion: pending.companion,
          display_name: pending.display_name,
          source: "web",
        },
      });

      if (error) {
        setStatus("error");
        return;
      }

      setEmailed(Boolean((result as { emailed?: boolean } | null)?.emailed));
      try {
        localStorage.removeItem(PENDING_KEY);
      } catch {
        /* noop */
      }
      trackEvent("waitlist_signup", { companion: pending.companion });
      setStatus("done");
    })();
    // Runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="surface-dark" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "18px 24px" }}>
        <Logo tone="dark" to="/" />
      </header>

      <main style={{ flex: 1, display: "grid", placeItems: "center", padding: "16px 20px 64px" }}>
        <div style={{ width: "100%", maxWidth: 440, textAlign: "center" }}>
          {status === "working" && (
            <>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
                <BuddyBlob size={110} colors={companion.colors} float />
              </div>
              <p className="text-fog" style={{ fontSize: 15.5 }}>
                <span className="spinner" aria-hidden="true" /> Saving your spot…
              </p>
            </>
          )}

          {status === "done" && (
            <>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}>
                <BuddyBlob size={132} colors={companion.colors} float />
              </div>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "6px 13px",
                  borderRadius: 999,
                  background: "rgba(255,210,63,.12)",
                  border: "1px solid rgba(255,210,63,.4)",
                  color: "#FFD23F",
                  fontSize: 12.5,
                  fontWeight: 600,
                  marginBottom: 18,
                }}
              >
                <Check size={14} strokeWidth={2.6} aria-hidden="true" /> You're on the list
              </div>

              <h1 className="h-display" style={{ margin: "0 0 12px", fontSize: 34, lineHeight: 1.15 }}>
                {firstName ? `You're in, ${firstName}.` : "You're in."}
              </h1>

              <p className="text-fog" style={{ margin: "0 0 22px", fontSize: 16, lineHeight: 1.65 }}>
                {companion.name} is waiting for you. We are still building the app, and we will email
                you at <span style={{ color: "#F7F3EA", fontWeight: 600 }}>{email}</span> the moment
                access opens.
              </p>

              {emailed && (
                <p
                  className="text-dim"
                  style={{ margin: "0 0 26px", fontSize: 13.5, display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}
                >
                  <Mail size={15} aria-hidden="true" /> Confirmation sent. Check your inbox.
                </p>
              )}

              <Link to="/" className="btn btn-outline-dark" style={{ padding: "14px 24px" }}>
                Back to buddy.ai
              </Link>
            </>
          )}

          {status === "no-session" && (
            <>
              <h1 className="h-display" style={{ margin: "0 0 12px", fontSize: 30 }}>
                That didn't finish.
              </h1>
              <p className="text-fog" style={{ margin: "0 0 24px", fontSize: 15.5 }}>
                Google didn't complete the sign-in, so we couldn't save your spot. Give it another go.
              </p>
              <Link to="/signup" className="btn btn-grad btn-lg">
                Try again
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <h1 className="h-display" style={{ margin: "0 0 12px", fontSize: 30 }}>
                We couldn't save your spot.
              </h1>
              <p className="text-fog" style={{ margin: "0 0 24px", fontSize: 15.5 }}>
                Something went wrong on our side, not yours. Please try again in a moment.
              </p>
              <Link to="/signup" className="btn btn-grad btn-lg">
                Try again
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default Welcome;
