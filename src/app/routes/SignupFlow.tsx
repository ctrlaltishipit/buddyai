/**
 * /signup — the 7-step onboarding wizard (dark, split layout).
 * Spec: web/design/buddy-redesign.reference.html → "SCREEN: SIGNUP".
 *
 *   create → verify → name → companion → goals → reminder → done
 *
 * `create` is the pre-account step. Every later step is persisted as
 * settings.onboarding_step (via store.updateSettings) so a user who leaves
 * resumes exactly where they stopped. onboarding_complete is flipped only on
 * the final "Enter buddy" click — deliberately, so the done screen is seen.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "react-router";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Eye, EyeOff, Pencil } from "lucide-react";
import clsx from "clsx";
import { BuddyBlob } from "../components/BuddyBlob";
import { FieldDark, LockIcon, MailIcon, UserIcon } from "../components/FieldDark";
import { ApiError, authApi, errorMessage } from "../lib/api";
import { useStore } from "../lib/store";
import {
  COMPANIONS,
  DAY_LABELS,
  DAY_NAMES,
  SIGNUP_STEPS,
  TOPICS,
  companionById,
  firstName,
  signupPanelCopy,
  splitTime12h,
  type Companion,
} from "../lib/constants";
import type {
  AuthSuccess,
  CompanionId,
  OnboardingStep,
  Session,
  SettingsPatch,
  VerificationInfo,
} from "../lib/types";

type Step = (typeof SIGNUP_STEPS)[number];

// ---------- Per-state colors (mirrors the prototype's renderVals) ----------

const GRAD = "linear-gradient(90deg,#FFD23F,#FF7A1A)";
const LINE = "rgba(255,255,255,.12)";
const RADIO_GRAD = "linear-gradient(120deg,#FFD23F,#FF7A1A)";
const CHIP_GRAD = "linear-gradient(100deg,#FFD23F,#FF7A1A)";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const MAX_NAME = 40;
const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;
const DEFAULT_DAYS = [true, true, true, true, true, false, false];

/** Inline "link" button that still meets the 44px tap target inside a line of text. */
const LINK_MINT: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 44,
  padding: "12px 0",
  margin: "-12px 0",
  background: "none",
  border: "none",
  font: "inherit",
  fontWeight: 700,
  color: "#FFD23F",
  cursor: "pointer",
  textDecoration: "none",
};

// ---------- Small shared pieces ----------

function Heading({ children, size = 34, mb = 8 }: { children: ReactNode; size?: number; mb?: number }) {
  return (
    <h1
      id="signup-heading"
      tabIndex={-1}
      className="h-display"
      style={{ fontSize: size, lineHeight: 1.15, margin: `0 0 ${mb}px`, outline: "none" }}
    >
      {children}
    </h1>
  );
}

function Sub({ children, mb }: { children: ReactNode; mb: number }) {
  return (
    <p style={{ margin: `0 0 ${mb}px`, fontSize: 15.5, color: "#B9B1A3", lineHeight: 1.55 }}>{children}</p>
  );
}

function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

/** updateSettings with pending/error state for a step's CTA. */
function useSaveSettings() {
  const { updateSettings } = useStore();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(patch: SettingsPatch, onSaved?: () => void) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await updateSettings(patch);
      setPending(false);
      onSaved?.();
    } catch (err) {
      setError(errorMessage(err, "Couldn't save that. Try again."));
      setPending(false);
    }
  }

  return { pending, error, setError, save };
}

function CheckSvg() {
  return (
    <svg width="12" height="12" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M2.5 6.8l2.5 2.5L10.5 3.7" stroke="#1A1206" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BellSvg() {
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M11 3c-3 0-5 2-5 5 0 4-1.5 5.5-2 6.2-.3.4 0 1 .5 1h13c.5 0 .8-.6.5-1-.5-.7-2-2.2-2-6.2 0-3-2-5-5-5z"
        stroke="#1A1206"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 18.5a2.2 2.2 0 004 0" stroke="#1A1206" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function GoogleSvg() {
  return (
    <svg width="18" height="18" viewBox="0 0 19 19" aria-hidden="true">
      <path d="M18.6 9.7c0-.6-.1-1.2-.2-1.8H9.5v3.5h5.1c-.2 1.2-.9 2.2-1.9 2.9v2.4h3.1c1.8-1.7 2.8-4.1 2.8-7z" fill="#4285F4" />
      <path d="M9.5 19c2.6 0 4.7-.8 6.3-2.3l-3.1-2.4c-.9.6-2 .9-3.2.9-2.5 0-4.6-1.7-5.3-3.9H.9v2.5C2.5 16.9 5.8 19 9.5 19z" fill="#34A853" />
      <path d="M4.2 11.3c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V5.2H.9C.3 6.5 0 7.9 0 9.5s.3 3 .9 4.3l3.3-2.5z" fill="#FBBC05" />
      <path d="M9.5 3.8c1.4 0 2.7.5 3.7 1.4l2.8-2.8C14.2.9 12.1 0 9.5 0 5.8 0 2.5 2.1.9 5.2l3.3 2.5c.7-2.2 2.8-3.9 5.3-3.9z" fill="#EA4335" />
    </svg>
  );
}

function SparkSvg({ fill }: { fill: string }) {
  return (
    <svg viewBox="0 0 12 12" fill={fill} aria-hidden="true" style={{ display: "block", width: "100%", height: "100%" }}>
      <path d="M6 0c.5 3 1 3.5 6 6-5 2.5-5.5 3-6 6-.5-3-1-3.5-6-6 5-2.5 5.5-3 6-6z" />
    </svg>
  );
}

// ---------- Step 1: create ----------

function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return "Enter your email.";
  if (!EMAIL_RE.test(v)) return "That doesn't look like an email address.";
  return null;
}

function validatePassword(value: string): string | null {
  if (!value) return "Choose a password.";
  if (value.length < MIN_PASSWORD) return `Passwords are at least ${MIN_PASSWORD} characters.`;
  return null;
}

/** Social sign-in is intentionally not wired yet: rendered per the reference, but disabled. Google only (Apple removed). */
function SocialButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title="Coming soon"
      className="flex items-center justify-center w-full"
      style={{
        height: 52,
        borderRadius: 14,
        border: "none",
        gap: 10,
        background: "rgba(255,255,255,.06)",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.13)",
        color: "#F7F3EA",
        font: "600 15px var(--font-sans)",
        opacity: 0.6,
        cursor: "not-allowed",
      }}
    >
      <GoogleSvg />
      {children}
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          padding: "3px 7px",
          borderRadius: 999,
          background: "rgba(255,122,26,.18)",
          color: "#FF7A1A",
          lineHeight: 1,
        }}
      >
        soon
      </span>
    </button>
  );
}

function CreateStep({ onSignedUp }: { onSignedUp: (auth: AuthSuccess) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<ReactNode>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    setFormError(null);
    if (eErr || pErr) return;

    setPending(true);
    try {
      const auth = await authApi.signup(email.trim(), password);
      onSignedUp(auth); // parent moves to "verify"; this step unmounts
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError(
          <>
            An account with this email already exists.{" "}
            <Link to="/auth" style={{ ...LINK_MINT, fontSize: 13 }}>
              Sign in instead
            </Link>
          </>,
        );
      } else {
        setFormError(errorMessage(err, "Couldn't create your account. Try again."));
      }
      setPending(false);
    }
  }

  return (
    <>
      <Heading>Create your buddy.</Heading>
      <Sub mb={28}>Takes a minute. Private to you, always.</Sub>

      <div className="flex flex-col" style={{ gap: 11 }}>
        <SocialButton>Continue with Google</SocialButton>
      </div>

      <div className="flex items-center" style={{ gap: 14, margin: "22px 0" }} aria-hidden="true">
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.1)" }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#7D766B" }}>or</span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.1)" }} />
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col" style={{ gap: 14 }}>
        <FieldDark
          label="Email"
          name="email"
          type="email"
          placeholder="you@email.com"
          autoComplete="email"
          inputMode="email"
          icon={<MailIcon />}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError(null);
          }}
          error={emailError}
        />
        <FieldDark
          label="Password"
          name="password"
          type={showPassword ? "text" : "password"}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          icon={<LockIcon />}
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
              className="grid place-items-center shrink-0"
              style={{
                width: 44,
                height: 44,
                margin: "0 -12px 0 -6px",
                background: "none",
                border: "none",
                color: "#7D766B",
                cursor: "pointer",
                borderRadius: 10,
              }}
            >
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          }
        />
        {formError && (
          <p className="form-error" role="alert" style={{ marginTop: 0 }}>
            {formError}
          </p>
        )}
        <button type="submit" className="btn btn-grad btn-block" disabled={pending} aria-busy={pending}>
          {pending && <Spinner />}
          Continue with email
        </button>
      </form>

      <p style={{ margin: "20px 0 0", fontSize: 12, color: "#7D766B", textAlign: "center", lineHeight: 1.6 }}>
        By continuing you agree to our <span style={{ color: "#B9B1A3", fontWeight: 600 }}>Terms</span> &amp;{" "}
        <span style={{ color: "#B9B1A3", fontWeight: 600 }}>Privacy Policy</span>.
      </p>
    </>
  );
}

// ---------- Step 2: verify ----------

function VerifyStep({
  email,
  verification,
  onVerified,
  onVerification,
}: {
  email: string;
  verification: VerificationInfo | null;
  onVerified: (session: Session) => void;
  onVerification: (info: VerificationInfo) => void;
}) {
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendAt, setResendAt] = useState(() => Date.now() + RESEND_SECONDS * 1000);
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  // Drift-free countdown: derive seconds from a target timestamp.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);
  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));

  function setDigits(raw: string) {
    setCode(raw.replace(/\D/g, "").slice(0, OTP_LENGTH));
    setError(null);
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!digits) return;
    e.preventDefault();
    setDigits(digits);
  }

  const complete = code.length === OTP_LENGTH;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || !complete) return;
    setPending(true);
    setError(null);
    try {
      const session = await authApi.verify(code);
      onVerified(session); // parent moves to "name"
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const fallback =
        status === 410
          ? "That code has expired. Send a new one."
          : status === 429
            ? "Too many attempts. Give it a minute, then try again."
            : status === 400
              ? "That code doesn't match. Check it and try again."
              : "Couldn't verify right now. Try again.";
      setError(errorMessage(err, fallback));
      setCode("");
      setPending(false);
      inputRef.current?.focus();
    }
  }

  async function onResend() {
    if (resending || secondsLeft > 0) return;
    setResending(true);
    setError(null);
    try {
      const info = await authApi.resendCode();
      onVerification(info);
      setResendAt(Date.now() + RESEND_SECONDS * 1000);
    } catch (err) {
      setError(errorMessage(err, "Couldn't resend the code right now."));
      if (err instanceof ApiError && err.status === 429) setResendAt(Date.now() + RESEND_SECONDS * 1000);
    } finally {
      setResending(false);
    }
  }

  const devCode = verification?.dev_code ?? null;

  return (
    <form onSubmit={onSubmit} noValidate>
      <div
        className="grid place-items-center"
        style={{ width: 52, height: 52, borderRadius: 15, background: "rgba(255,122,26,.14)", marginBottom: 20 }}
        aria-hidden="true"
      >
        <span style={{ color: "#FF7A1A", display: "grid" }}>
          <MailIcon />
        </span>
      </div>
      <Heading>Check your inbox.</Heading>
      <p style={{ margin: "0 0 34px", fontSize: 15.5, color: "#B9B1A3", lineHeight: 1.55, overflowWrap: "anywhere" }}>
        We sent a 6-digit code to <b style={{ color: "#F7F3EA", fontWeight: 600 }}>{email}</b>.
      </p>

      {/* One real input drives six decorative boxes. The input sits invisibly over the row so
          clicking any box focuses it, and paste / one-time-code autofill land in it. */}
      <div className="relative" onClick={() => inputRef.current?.focus()}>
        <div className="flex" style={{ gap: 10 }} aria-hidden="true">
          {Array.from({ length: OTP_LENGTH }, (_, i) => {
            const ch = code.charAt(i);
            const active = focused && !complete && i === code.length;
            return (
              <div
                key={i}
                className={clsx("otp-box", ch && "filled", active && "active")}
                style={{ width: "auto", flex: "1 1 0", maxWidth: 52, minWidth: 0 }}
              >
                {ch ||
                  (active ? (
                    <span
                      style={{
                        display: "block",
                        width: 2,
                        height: 26,
                        background: "#FFD23F",
                        borderRadius: 2,
                        animation: "spark 1.1s ease-in-out infinite",
                      }}
                    />
                  ) : null)}
              </div>
            );
          })}
        </div>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={OTP_LENGTH}
          autoFocus
          aria-label="6-digit verification code"
          aria-invalid={!!error}
          value={code}
          onChange={(e) => setDigits(e.target.value)}
          onPaste={onPaste}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="absolute inset-0 w-full h-full"
          style={{
            opacity: 0,
            color: "transparent",
            caretColor: "transparent",
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: 16,
            cursor: "pointer",
          }}
        />
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {devCode && (
        <div
          role="note"
          style={{
            marginTop: 18,
            padding: "12px 14px",
            borderRadius: 14,
            background: "rgba(255,210,63,.07)",
            boxShadow: "inset 0 0 0 1px rgba(255,210,63,.28)",
            fontSize: 13,
            color: "#B9B1A3",
            lineHeight: 1.55,
          }}
        >
          <div>
            Dev mode: no email server is configured, so here's your code:{" "}
            <code
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 14,
                fontWeight: 700,
                color: "#F7F3EA",
                letterSpacing: ".12em",
                padding: "2px 6px",
                borderRadius: 6,
                background: "rgba(255,255,255,.08)",
              }}
            >
              {devCode}
            </code>
          </div>
          <button
            type="button"
            className="btn btn-outline-dark btn-sm"
            style={{ marginTop: 10, minHeight: 44, padding: "8px 16px", fontSize: 13 }}
            onClick={() => {
              setDigits(devCode);
              inputRef.current?.focus();
            }}
          >
            Use this code
          </button>
        </div>
      )}

      <p style={{ margin: "26px 0 34px", fontSize: 14, color: "#B9B1A3" }} aria-live="polite">
        Didn't get it?{" "}
        {secondsLeft > 0 ? (
          <span style={{ color: "#FFD23F", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            Resend in 0:{String(secondsLeft).padStart(2, "0")}
          </span>
        ) : (
          <button type="button" onClick={onResend} disabled={resending} style={LINK_MINT}>
            {resending ? "Sending…" : "Resend code"}
          </button>
        )}
      </p>

      <button type="submit" className="btn btn-grad btn-block" disabled={!complete || pending} aria-busy={pending}>
        {pending && <Spinner />}
        Verify
      </button>
    </form>
  );
}

// ---------- Step 3: name ----------

function NameStep({ initial, onDone }: { initial: string; onDone: () => void }) {
  const [name, setName] = useState(initial);
  const { pending, error, setError, save } = useSaveSettings();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = name.trim();
    if (!v) {
      setError("Tell buddy what to call you.");
      return;
    }
    if (v.length > MAX_NAME) {
      setError(`Keep it under ${MAX_NAME} characters.`);
      return;
    }
    void save({ display_name: v, onboarding_step: "companion" }, onDone);
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Heading>What should buddy call you?</Heading>
      <Sub mb={30}>This is how your companion greets you each day.</Sub>
      <FieldDark
        emphasized
        icon={<UserIcon />}
        name="display_name"
        placeholder="Your first name"
        aria-label="Your first name"
        autoComplete="given-name"
        autoFocus
        maxLength={MAX_NAME}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (error) setError(null);
        }}
        error={error}
        style={{ fontSize: 16 }}
      />
      <button type="submit" className="btn btn-grad btn-block" style={{ marginTop: 24 }} disabled={pending} aria-busy={pending}>
        {pending && <Spinner />}
        Continue
      </button>
    </form>
  );
}

// ---------- Step 4: companion ----------

function CompanionStep({
  selected,
  onSelect,
  onDone,
}: {
  selected: CompanionId;
  onSelect: (id: CompanionId) => void;
  onDone: () => void;
}) {
  const { pending, error, save } = useSaveSettings();
  const current = companionById(selected);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Radio-group keyboard model: arrows move the selection.
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const n = COMPANIONS.length;
    let next = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (i + 1) % n;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (i - 1 + n) % n;
    if (next < 0) return;
    e.preventDefault();
    onSelect(COMPANIONS[next].id);
    rowRefs.current[next]?.focus();
  }

  return (
    <>
      <Heading>Choose your buddy.</Heading>
      <Sub mb={26}>Each companion has its own personality. Swap anytime.</Sub>
      <div role="radiogroup" aria-label="Choose your buddy" className="flex flex-col" style={{ gap: 13 }}>
        {COMPANIONS.map((c, i) => {
          const sel = c.id === selected;
          return (
            <button
              key={c.id}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={sel}
              tabIndex={sel ? 0 : -1}
              onClick={() => onSelect(c.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className="flex items-center w-full text-left"
              style={{
                gap: 15,
                padding: "14px 16px",
                borderRadius: 16,
                border: "none",
                color: "inherit",
                cursor: "pointer",
                background: sel ? "rgba(255,122,26,.12)" : "rgba(255,255,255,.04)",
                boxShadow: sel ? "inset 0 0 0 1.5px #FF7A1A" : "inset 0 0 0 1px rgba(255,255,255,.1)",
                transition: "all .2s ease",
              }}
            >
              <BuddyBlob size={50} colors={c.colors} follow={false} glow={false} aria-label="" />
              <span className="flex-1 min-w-0">
                <span className="block font-display" style={{ fontWeight: 600, fontSize: 17, letterSpacing: -0.3 }}>
                  {c.name}
                </span>
                <span className="block" style={{ fontSize: 13.5, color: "#B9B1A3", marginTop: 1 }}>
                  {c.trait}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="grid place-items-center shrink-0"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: sel ? RADIO_GRAD : "transparent",
                  boxShadow: sel ? "none" : "inset 0 0 0 2px rgba(255,255,255,.15)",
                  transition: "all .2s ease",
                }}
              >
                {sel && <CheckSvg />}
              </span>
            </button>
          );
        })}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="btn btn-grad btn-block"
        style={{ marginTop: 26 }}
        disabled={pending}
        aria-busy={pending}
        onClick={() => void save({ companion: selected, onboarding_step: "goals" }, onDone)}
      >
        {pending && <Spinner />}
        Continue with {current.name}
      </button>
    </>
  );
}

// ---------- Step 5: goals ----------

function GoalsStep({ initial, onDone }: { initial: string[]; onDone: () => void }) {
  const [topics, setTopics] = useState<string[]>(initial);
  const { pending, error, save } = useSaveSettings();

  function toggle(label: string) {
    setTopics((t) => (t.includes(label) ? t.filter((x) => x !== label) : [...t, label]));
  }

  return (
    <>
      <Heading>What's on your mind lately?</Heading>
      <Sub mb={28}>Pick a few. buddy tailors your daily prompts around them.</Sub>
      <div className="flex flex-wrap" style={{ gap: 11 }}>
        {TOPICS.map((t) => {
          const sel = topics.includes(t.label);
          return (
            <button
              key={t.label}
              type="button"
              aria-pressed={sel}
              onClick={() => toggle(t.label)}
              className="inline-flex items-center"
              style={{
                gap: 8,
                padding: "11px 16px",
                minHeight: 44,
                borderRadius: 12,
                border: "none",
                background: sel ? CHIP_GRAD : "rgba(255,255,255,.05)",
                color: sel ? "#1A1206" : "#F7F3EA",
                boxShadow: sel ? "0 4px 16px rgba(255,122,26,.35)" : "inset 0 0 0 1px rgba(255,255,255,.12)",
                font: "600 14px var(--font-sans)",
                letterSpacing: -0.2,
                cursor: "pointer",
                transition: "all .18s ease",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }} aria-hidden="true">
                {t.emoji}
              </span>
              {t.label}
            </button>
          );
        })}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="btn btn-grad btn-block"
        style={{ marginTop: 30 }}
        disabled={pending}
        aria-busy={pending}
        onClick={() => void save({ topics, onboarding_step: "reminder" }, onDone)}
      >
        {pending && <Spinner />}
        Continue · {topics.length} chosen
      </button>
    </>
  );
}

// ---------- Step 6: reminder ----------

function normalizeDays(days: boolean[] | null | undefined): boolean[] {
  if (!days || days.length !== 7) return [...DEFAULT_DAYS];
  return days.map(Boolean);
}

function ReminderStep({
  initialTime,
  initialDays,
  onDone,
}: {
  initialTime: string;
  initialDays: boolean[] | null | undefined;
  onDone: () => void;
}) {
  const [time, setTime] = useState(initialTime || "21:00");
  const [days, setDays] = useState<boolean[]>(() => normalizeDays(initialDays));
  const [editing, setEditing] = useState(false);
  const [which, setWhich] = useState<"on" | "later" | null>(null);
  const { pending, error, setError, save } = useSaveSettings();
  const timeInputRef = useRef<HTMLInputElement>(null);
  const timeButtonRef = useRef<HTMLButtonElement>(null);
  const { time: t12, ampm } = splitTime12h(time);

  useEffect(() => {
    if (!editing) return;
    const el = timeInputRef.current;
    if (!el) return;
    el.focus();
    try {
      (el as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
    } catch {
      /* browsers without a picker (or outside a user gesture) fall back to the inline control */
    }
  }, [editing]);

  function closeEditor() {
    setEditing(false);
    // Return focus to the time control so keyboard users don't lose their place.
    window.requestAnimationFrame(() => timeButtonRef.current?.focus());
  }

  function onTurnOn() {
    if (!days.some(Boolean)) {
      setError("Pick at least one day.");
      return;
    }
    setWhich("on");
    void save({ reminders_enabled: true, reminder_time: time, reminder_days: days, onboarding_step: "done" }, onDone);
  }

  function onLater() {
    setWhich("later");
    void save({ reminders_enabled: false, onboarding_step: "done" }, onDone);
  }

  return (
    <>
      <Heading>A gentle daily nudge.</Heading>
      <Sub mb={26}>One mindful moment a day. Never a nag.</Sub>

      <div
        style={{
          background: "rgba(255,255,255,.05)",
          border: "1px solid rgba(255,255,255,.1)",
          borderRadius: 18,
          padding: "22px 20px 24px",
        }}
      >
        {editing ? (
          <div className="flex items-center justify-center">
            <input
              ref={timeInputRef}
              type="time"
              aria-label="Reminder time"
              value={time}
              onChange={(e) => {
                if (e.target.value) setTime(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") {
                  e.preventDefault();
                  closeEditor();
                }
              }}
              onBlur={() => setEditing(false)}
              style={{
                colorScheme: "dark",
                background: "rgba(255,255,255,.06)",
                boxShadow: "inset 0 0 0 1.5px #FFD23F",
                border: "none",
                borderRadius: 12,
                color: "#F7F3EA",
                padding: "6px 14px",
                minHeight: 52,
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: 28,
                letterSpacing: -0.5,
                fontVariantNumeric: "tabular-nums",
                outline: "none",
              }}
            />
          </div>
        ) : (
          <button
            ref={timeButtonRef}
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Reminder time ${t12} ${ampm}, change`}
            title="Change time"
            className="flex items-baseline justify-center mx-auto"
            style={{
              gap: 6,
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              padding: "2px 12px",
              borderRadius: 12,
              minHeight: 52,
            }}
          >
            <span
              className="font-display"
              style={{ fontWeight: 600, fontSize: 42, letterSpacing: -1, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}
            >
              {t12}
            </span>
            <span style={{ fontWeight: 600, fontSize: 17, color: "#B9B1A3" }}>{ampm}</span>
            <Pencil size={13} aria-hidden="true" style={{ color: "#7D766B", alignSelf: "center", marginLeft: 4 }} />
          </button>
        )}

        <div className="flex justify-center" style={{ gap: 1, marginTop: 18 }} role="group" aria-label="Reminder days">
          {DAY_LABELS.map((label, i) => {
            const on = days[i];
            return (
              <button
                key={DAY_NAMES[i]}
                type="button"
                aria-pressed={on}
                aria-label={DAY_NAMES[i]}
                onClick={() => setDays((d) => d.map((v, j) => (j === i ? !v : v)))}
                className="grid place-items-center"
                style={{ width: 44, height: 44, background: "none", border: "none", padding: 0, cursor: "pointer" }}
              >
                <span
                  aria-hidden="true"
                  className="grid place-items-center"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: on ? RADIO_GRAD : "transparent",
                    color: on ? "#1A1206" : "#7D766B",
                    boxShadow: on ? "none" : "inset 0 0 0 1px rgba(255,255,255,.15)",
                    font: "600 13.5px var(--font-sans)",
                    transition: "all .15s ease",
                  }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        className="btn btn-grad btn-block"
        style={{ marginTop: 26 }}
        disabled={pending}
        aria-busy={pending && which === "on"}
        onClick={onTurnOn}
      >
        {pending && which === "on" ? <Spinner /> : <BellSvg />}
        Turn on reminders
      </button>
      <button
        type="button"
        className="inline-flex items-center justify-center w-full"
        style={{
          height: 46,
          marginTop: 8,
          gap: 8,
          border: "none",
          background: "none",
          color: "#B9B1A3",
          font: "600 14.5px var(--font-sans)",
          cursor: pending ? "not-allowed" : "pointer",
          opacity: pending && which !== "later" ? 0.55 : 1,
        }}
        disabled={pending}
        aria-busy={pending && which === "later"}
        onClick={onLater}
      >
        {pending && which === "later" && <Spinner />}
        Maybe later
      </button>
    </>
  );
}

// ---------- Step 7: done ----------

function DoneStep({ name, companion, onEnter }: { name: string; companion: Companion; onEnter: () => void }) {
  const { pending, error, save } = useSaveSettings();

  return (
    <div className="text-center relative">
      <div className="anim-spark absolute" style={{ top: -6, left: "14%", width: 11, height: 11 }} aria-hidden="true">
        <SparkSvg fill="#FFD23F" />
      </div>
      <div className="anim-spark absolute" style={{ top: 34, right: "12%", width: 14, height: 14, animationDelay: ".4s" }} aria-hidden="true">
        <SparkSvg fill="#F24E1E" />
      </div>
      <div className="anim-spark absolute" style={{ top: 120, left: "6%", width: 9, height: 9, animationDelay: ".8s" }} aria-hidden="true">
        <SparkSvg fill="#FF7A1A" />
      </div>

      <div className="flex justify-center" style={{ marginBottom: 28 }}>
        <BuddyBlob size={190} colors={companion.colors} aria-label={`${companion.name}, your buddy`} />
      </div>
      <Heading size={38} mb={10}>
        You're all set, {name}!
      </Heading>
      <p style={{ margin: "0 auto", maxWidth: 320, fontSize: 15.5, color: "#B9B1A3", lineHeight: 1.6 }}>
        {companion.name} is ready when you are. Let's write your first entry together.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="btn btn-grad"
        style={{ marginTop: 32, height: 54, padding: "0 40px", fontSize: 15.5 }}
        disabled={pending}
        aria-busy={pending}
        onClick={() => void save({ onboarding_complete: true }, onEnter)}
      >
        {pending && <Spinner />}
        Enter buddy
      </button>
    </div>
  );
}

// ---------- Loading skeleton (session still hydrating) ----------

function StepSkeleton() {
  const bar = (h: number, w: string, r: number, mt = 0): CSSProperties => ({
    height: h,
    width: w,
    borderRadius: r,
    marginTop: mt,
    background: "rgba(255,255,255,.05)",
  });
  return (
    <div role="status" aria-live="polite" aria-busy="true" aria-label="Loading your progress">
      <div style={bar(34, "72%", 10)} />
      <div style={bar(16, "88%", 8, 14)} />
      <div style={bar(52, "100%", 14, 30)} />
      <div style={bar(52, "100%", 14, 14)} />
      <div style={bar(54, "100%", 999, 22)} />
    </div>
  );
}

// ---------- The wizard ----------

export function SignupFlow() {
  const navigate = useNavigate();
  const { state, signIn, setSession, updateSettings, showToast } = useStore();
  const { status, user, settings } = state;
  const reduceMotion = useReducedMotion();

  /** Step advanced locally after a successful save; falls back to the persisted onboarding_step. */
  const [localStep, setLocalStep] = useState<Step | null>(null);
  const [verification, setVerification] = useState<VerificationInfo | null>(null);
  /** Companion picked on the companion step but not saved yet — drives the right panel live. */
  const [draftCompanion, setDraftCompanion] = useState<CompanionId | null>(null);

  // Signed out mid-flow (a 401 → SIGN_OUT): drop any local progress.
  useEffect(() => {
    if (status === "anon") {
      setLocalStep(null);
      setVerification(null);
      setDraftCompanion(null);
    }
  }, [status]);

  const step: Step | null = useMemo(() => {
    if (status === "loading") return null;
    if (status === "anon") return "create";
    const s: Step = localStep ?? settings?.onboarding_step ?? "verify";
    // Already verified (e.g. resumed later) but still marked "verify": no code is in flight, so move on.
    if (s === "verify" && user?.verified) return "name";
    return s;
  }, [status, localStep, settings?.onboarding_step, user?.verified]);

  const idx = step ? SIGNUP_STEPS.indexOf(step) : 0; // create=0 … reminder=5, done=6
  const companion = companionById(draftCompanion ?? settings?.companion);
  const [panelTitle, panelSub] = signupPanelCopy(step ?? "create", companion.name, companion.trait);
  const stepLabel = step === "done" ? "Done!" : `Step ${idx + 1} of 6`;

  // Back: create/verify → home (they can resume later). name → nowhere (never back to
  // create/verify once verified). Otherwise the previous step, persisted.
  const backHome = step === "create" || step === "verify";
  const prevStep: OnboardingStep | null = step && idx >= 3 ? (SIGNUP_STEPS[idx - 1] as OnboardingStep) : null;

  function onBack() {
    if (backHome) {
      navigate("/");
      return;
    }
    if (!prevStep) return;
    setLocalStep(prevStep);
    void updateSettings({ onboarding_step: prevStep }).catch(() =>
      showToast("Couldn't save your progress, but you can keep going."),
    );
  }

  // Steps without an autofocused input: move focus to the heading so the change is announced.
  useEffect(() => {
    if (step === "companion" || step === "goals" || step === "reminder" || step === "done") {
      document.getElementById("signup-heading")?.focus({ preventScroll: true });
    }
  }, [step]);

  let content: ReactNode = null;
  switch (step) {
    case "create":
      content = (
        <CreateStep
          onSignedUp={(auth) => {
            signIn(auth);
            setVerification(auth.verification ?? null);
            setLocalStep("verify");
          }}
        />
      );
      break;
    case "verify":
      content = (
        <VerifyStep
          email={user?.email ?? ""}
          verification={verification}
          onVerification={setVerification}
          onVerified={(session) => {
            setSession(session);
            setLocalStep("name");
          }}
        />
      );
      break;
    case "name":
      content = <NameStep initial={settings?.display_name ?? ""} onDone={() => setLocalStep("companion")} />;
      break;
    case "companion":
      content = (
        <CompanionStep
          selected={companion.id}
          onSelect={setDraftCompanion}
          onDone={() => {
            setDraftCompanion(null);
            setLocalStep("goals");
          }}
        />
      );
      break;
    case "goals":
      content = <GoalsStep initial={settings?.topics ?? []} onDone={() => setLocalStep("reminder")} />;
      break;
    case "reminder":
      content = (
        <ReminderStep
          initialTime={settings?.reminder_time ?? "21:00"}
          initialDays={settings?.reminder_days}
          onDone={() => setLocalStep("done")}
        />
      );
      break;
    case "done":
      content = (
        <DoneStep
          name={firstName(settings?.display_name, user?.email)}
          companion={companion}
          onEnter={() => navigate("/app/home", { replace: true })}
        />
      );
      break;
    default:
      content = null;
  }

  return (
    <div className="surface-dark split-screen relative">
      {/* Header spans the WHOLE screen: Back at the left edge, progress bar + step label centered in the viewport */}
      <div
        className="absolute inset-x-0 top-0 z-10 grid items-center px-5 pt-6 sm:px-14 sm:pt-7"
        style={{ gridTemplateColumns: "1fr minmax(0, 280px) 1fr", gap: 16 }}
      >
          <div className="justify-self-start">
            {backHome || prevStep ? (
              <button type="button" className="btn-ghost-dark" onClick={onBack}>
                <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" /> Back
              </button>
            ) : (
              <span className="btn-ghost-dark" style={{ visibility: "hidden" }} aria-hidden="true">
                <ArrowLeft size={16} strokeWidth={2} /> Back
              </span>
            )}
          </div>
          <div className="flex flex-col items-center w-full" style={{ gap: 10 }}>
            <div
              className="flex w-full"
              style={{ gap: 6 }}
              role="progressbar"
              aria-label="Signup progress"
              aria-valuemin={0}
              aria-valuemax={6}
              aria-valuenow={Math.min(idx, 6)}
              aria-valuetext={stepLabel}
            >
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  style={{
                    height: 4,
                    borderRadius: 4,
                    flex: 1,
                    background: step && i <= idx ? GRAD : LINE,
                    transition: "background .3s ease",
                  }}
                />
              ))}
            </div>
            <span style={{ fontSize: 12.5, color: "#7D766B", textAlign: "center", lineHeight: 1 }} aria-live="polite">
              {step ? stepLabel : ""}
            </span>
          </div>
          <div aria-hidden="true" />
      </div>

      {/* Left: centered step column (top padding clears the absolute header) */}
      <div className="flex flex-col min-w-0 px-5 pb-8 sm:px-14 sm:pb-10" style={{ paddingTop: 96 }}>
        <div className="flex flex-1 flex-col justify-center w-full mx-auto" style={{ maxWidth: 420, padding: "34px 0" }}>
          {step === null ? (
            <StepSkeleton />
          ) : (
            <motion.div
              key={step}
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              {content}
            </motion.div>
          )}
        </div>
      </div>

      {/* Right: companion panel (hidden ≤900px by .split-panel) */}
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
              background: "radial-gradient(circle,rgba(242,78,30,.18),transparent 65%)",
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
              background: "radial-gradient(circle,rgba(255,210,63,.15),transparent 65%)",
              filter: "blur(60px)",
            }}
          />
          <BuddyBlob size={270} colors={companion.colors} aria-label={`${companion.name}, your buddy`} />
          <div className="relative text-center" style={{ maxWidth: 330 }}>
            <div className="font-display" style={{ fontWeight: 600, fontSize: 21, letterSpacing: -0.3, marginBottom: 8 }}>
              {panelTitle}
            </div>
            <div style={{ fontSize: 14, color: "#B9B1A3", lineHeight: 1.6 }}>{panelSub}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignupFlow;
