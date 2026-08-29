/**
 * /auth — sign in (dark, split layout) with an inline "forgot password" mode.
 * Spec: web/design/buddy-redesign.reference.html → "SCREEN: AUTH".
 *
 * Login:  authApi.login → store.signIn → /app/home (or the guarded page the
 *         user came from) — or back into the signup wizard if onboarding is
 *         unfinished.
 * Forgot: authApi.forgotPassword → always the same "if an account exists…"
 *         message, so the screen never reveals which emails are registered.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { BuddyBlob } from "../components/BuddyBlob";
import { FieldDark, LockIcon, MailIcon } from "../components/FieldDark";
import { Logo } from "../components/Logo";
import { ApiError, authApi, errorMessage } from "../lib/api";
import { useStore } from "../lib/store";

type Mode = "login" | "forgot";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
/** Mirrors the backend's default so the copy is identical even if the body is empty. */
const FORGOT_FALLBACK = "If an account exists for that email, we've sent it a new password.";

function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return "Enter your email.";
  if (!EMAIL_RE.test(v)) return "That doesn't look like an email address.";
  return null;
}

function validatePassword(value: string): string | null {
  if (!value) return "Enter your password.";
  if (value.length < MIN_PASSWORD) return `Passwords are at least ${MIN_PASSWORD} characters.`;
  return null;
}

/** Where RequireOnboarded sent us from, if it's an in-app path; else Home. */
function appPathFrom(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from;
  return typeof from === "string" && from.startsWith("/app") ? from : "/app/home";
}

export function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useStore();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // Put the caret in the email field on mount and whenever the form swaps.
  useEffect(() => {
    emailRef.current?.focus();
  }, [mode]);

  function switchMode(next: Mode) {
    setMode(next);
    setEmailError(null);
    setPasswordError(null);
    setFormError(null);
    setSentMessage(null);
    setPending(false);
  }

  async function onLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) return;

    setPending(true);
    setFormError(null);
    try {
      const auth = await authApi.login(email.trim(), password);
      signIn(auth);
      // The component unmounts on navigate, so `pending` intentionally stays true
      // (no enabled-button flash before the route changes).
      navigate(auth.settings.onboarding_complete ? appPathFrom(location.state) : "/signup", {
        replace: true,
      });
    } catch (err) {
      setFormError(
        err instanceof ApiError && err.status === 401 ? "Invalid email or password." : errorMessage(err),
      );
      setPending(false);
    }
  }

  async function onForgot(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const eErr = validateEmail(email);
    setEmailError(eErr);
    if (eErr) return;

    setPending(true);
    setFormError(null);
    try {
      const res = await authApi.forgotPassword(email.trim());
      setSentMessage(res.message || FORGOT_FALLBACK);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  const emailField = (
    <FieldDark
      ref={emailRef}
      id="auth-email"
      name="email"
      label="Email"
      icon={<MailIcon />}
      type="email"
      autoComplete="email"
      inputMode="email"
      autoCapitalize="none"
      spellCheck={false}
      placeholder="you@somewhere.com"
      value={email}
      onChange={(e) => {
        setEmail(e.target.value);
        if (emailError) setEmailError(null);
      }}
      error={emailError}
    />
  );

  const privacyFooter = (
    <p className="m-0 text-center text-[12px] text-dim" style={{ marginTop: 34, lineHeight: 1.6 }}>
      buddy stores your email, a password hash, and the entries you choose to save.
      <br />
      Nobody but you can read them.
    </p>
  );

  const loginView = (
    <>
      <h1 className="h-display" style={{ fontSize: 36, marginBottom: 8 }}>
        Welcome back.
      </h1>
      <p className="m-0 text-[15.5px] text-fog" style={{ marginBottom: 32 }}>
        buddy's been here, waiting.
      </p>

      <form onSubmit={onLogin} noValidate aria-busy={pending} className="flex flex-col gap-4">
        {emailField}

        <FieldDark
          id="auth-password"
          name="password"
          label="Password"
          labelAside={
            <button
              type="button"
              onClick={() => switchMode("forgot")}
              className="hover:underline"
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "#FF7A1A",
                background: "none",
                border: "none",
                cursor: "pointer",
                // 44px hit area without changing the label row's height.
                padding: "14px 0",
                margin: "-14px 0",
              }}
            >
              Forgot password?
            </button>
          }
          icon={<LockIcon />}
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (passwordError) setPasswordError(null);
          }}
          error={passwordError}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="grid shrink-0 place-items-center hover:text-fog"
              style={{
                width: 44,
                height: 44,
                marginRight: -12,
                background: "none",
                border: "none",
                borderRadius: 10,
                color: "var(--color-dim)",
                cursor: "pointer",
              }}
            >
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          }
        />

        <div style={{ marginTop: 6 }}>
          <button type="submit" className="btn btn-grad btn-block" disabled={pending}>
            {pending ? (
              <>
                <span className="spinner" aria-hidden="true" /> Logging in…
              </>
            ) : (
              "Log in"
            )}
          </button>
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
        </div>
      </form>

      <p className="m-0 text-center text-[14px] text-fog" style={{ marginTop: 26 }}>
        New here?{" "}
        <Link
          to="/signup"
          className="font-bold text-mint hover:underline"
          style={{ textDecoration: "none", display: "inline-block", padding: "12px 0", margin: "-12px 0" }}
        >
          Create your space
        </Link>
      </p>

      {privacyFooter}
    </>
  );

  const forgotView = (
    <>
      <h1 className="h-display" style={{ fontSize: 36, marginBottom: 8 }}>
        Forgot your password?
      </h1>
      <p className="m-0 text-[15.5px] text-fog" style={{ marginBottom: 32 }}>
        We'll email you a temporary one.
      </p>

      {sentMessage ? (
        <div
          className="card-dark anim-fade-up"
          role="status"
          aria-live="polite"
          style={{ borderColor: "rgba(255,210,63,.55)", padding: "20px 22px", animationDuration: ".45s" }}
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="grid shrink-0 place-items-center"
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                background: "rgba(255,210,63,.14)",
                color: "#FFD23F",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              ✓
            </span>
            <div>
              <p className="m-0 text-[15px] font-semibold">{sentMessage}</p>
              <p className="m-0 text-[13px] text-dim" style={{ marginTop: 6, lineHeight: 1.6 }}>
                It can take a minute to arrive. Check spam if you don't see it. Sign in with the temporary
                password, then change it in Settings.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={onForgot} noValidate aria-busy={pending} className="flex flex-col gap-4">
          {emailField}
          <div style={{ marginTop: 6 }}>
            <button type="submit" className="btn btn-grad btn-block" disabled={pending}>
              {pending ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Sending…
                </>
              ) : (
                "Send me a new password"
              )}
            </button>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
          </div>
        </form>
      )}

      <div className="flex justify-center" style={{ marginTop: 26 }}>
        <button type="button" className="btn-ghost-dark" onClick={() => switchMode("login")}>
          <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" /> Back to sign in
        </button>
      </div>

      {privacyFooter}
    </>
  );

  return (
    <div className="surface-dark split-screen">
      {/* Left: form column */}
      <div className="relative flex flex-col p-6 min-[901px]:px-14 min-[901px]:pt-7 min-[901px]:pb-10">
        <div>
          <Link to="/" className="btn-ghost-dark" style={{ textDecoration: "none" }}>
            <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" /> Back to home
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-8">
          <div style={{ marginBottom: 34 }}>
            <Logo tone="dark" />
          </div>

          <div key={mode} className="anim-fade-up" style={{ animationDuration: ".45s" }}>
            {mode === "forgot" ? forgotView : loginView}
          </div>
        </div>
      </div>

      {/* Right: blob panel (hidden ≤900px by .split-panel) */}
      <div className="split-panel">
        <div
          className="relative flex flex-1 flex-col items-center justify-center overflow-hidden"
          style={{ gap: 30 }}
        >
          <div
            className="glow"
            aria-hidden="true"
            style={{
              top: -140,
              right: -80,
              width: 440,
              height: 440,
              background: "radial-gradient(circle, rgba(242,78,30,.18), transparent 65%)",
              filter: "blur(60px)",
            }}
          />
          <div
            className="glow"
            aria-hidden="true"
            style={{
              bottom: -120,
              left: 40,
              width: 440,
              height: 440,
              background: "radial-gradient(circle, rgba(255,210,63,.15), transparent 65%)",
              filter: "blur(60px)",
            }}
          />

          <BuddyBlob size={260} colors={["#FFD23F", "#FF7A1A", "#F24E1E"]} />

          <div className="relative text-center" style={{ maxWidth: 320 }}>
            <div
              className="font-display"
              style={{ fontWeight: 600, fontSize: 21, letterSpacing: -0.3, marginBottom: 8 }}
            >
              Everything you write stays yours.
            </div>
            <div className="text-[14px] text-fog" style={{ lineHeight: 1.6 }}>
              Your account, your entries, your eyes only.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Auth;
