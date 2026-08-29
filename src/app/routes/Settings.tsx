/**
 * Settings — the light app's "quiet controls" screen.
 *
 * Account · Profile · Reminders · What buddy stores · Time-off   (left)
 * Region · Reflector tone · Consents · Change password · Danger  (right)
 *
 * Every settings change goes through store.updateSettings(patch), which is
 * optimistic (UI updates instantly, reverts on failure). Success/failure is
 * surfaced as a toast: "Saved." or the error message.
 */
import { useEffect, useId, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { Download, LogOut, Moon } from "lucide-react";
import clsx from "clsx";
import { BuddyBlob } from "../components/BuddyBlob";
import { authApi, errorMessage, exportApi } from "../lib/api";
import { COMPANIONS, DAY_LABELS, DAY_NAMES } from "../lib/constants";
import { useStore } from "../lib/store";
import type { Region, SettingsPatch, Tone, UserPublic, UserSettings } from "../lib/types";

// ---------- Vocabulary (copy verbatim from the reference) ----------

type Save = (patch: SettingsPatch) => Promise<void>;
type ConsentKey = "consent_nlp" | "consent_voice" | "consent_crash";

const REGIONS: Array<[Region, string]> = [
  ["IN", "India"],
  ["US", "United States"],
  ["OTHER", "Other"],
];

const TONES: Array<[Tone, string]> = [
  ["warm", "Warm"],
  ["neutral", "Neutral"],
  ["brief", "Brief"],
];

const CONSENTS: Array<{ key: ConsentKey; title: string; desc: string }> = [
  {
    key: "consent_nlp",
    title: "Send entry text for analysis",
    desc: "Required for emotion suggestions on web. Text is never stored by the analyzer.",
  },
  {
    key: "consent_voice",
    title: "Cloud voice transcription",
    desc: "Off by default. Uses an encrypted, delete-after API.",
  },
  {
    key: "consent_crash",
    title: "Crash diagnostics",
    desc: "Sends app-level errors only. Never journal content.",
  },
];

const STORED_LINES = [
  "Your account: email and a password hash. Never the password itself.",
  "Your journal: entries, the feelings you confirmed, and your settings, scoped to your account only.",
  "Reflector chats: kept in this browser session only, never saved to the server.",
  "Never collected: voice audio, location, contacts, anything you didn't type into buddy.",
];

const NAME_MAX = 40;

// ---------- Shared styling ----------

/** Light text input: 1px line border, radius 12, 44px tall, accent border on focus. */
const INPUT =
  "block w-full h-11 rounded-xl border border-app-line bg-white px-3.5 text-[14.5px] font-medium text-app-ink " +
  "outline-none transition-[border-color,box-shadow] duration-150 " +
  "focus:border-acc focus:shadow-[0_0_0_1px_var(--color-acc)] focus-visible:outline-none disabled:opacity-60";

const LABEL = "block text-[13px] font-semibold text-app-sub mb-2";

/** Soft reveal for content that appears on interaction (honours reduced motion via globals). */
const REVEAL: CSSProperties = { animation: "fade-up .35s var(--ease-soft) both" };

// ---------- Helpers ----------

/** Local-time YYYY-MM-DD (toISOString would roll the date over in UTC). */
function localDateStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function planLabel(tier: string | null | undefined): string {
  const t = (tier ?? "free").trim() || "free";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ---------- Screen ----------

export function Settings() {
  const { state, updateSettings, showToast, signOut } = useStore();
  const navigate = useNavigate();
  const { user, settings } = state;

  const save: Save = async (patch) => {
    try {
      await updateSettings(patch);
      showToast("Saved.");
    } catch (err) {
      showToast(errorMessage(err, "Couldn't save that. Try again."));
    }
  };

  const leave = () => {
    signOut();
    navigate("/");
  };

  const onDeleted = () => {
    signOut();
    showToast("Account deleted.");
    navigate("/");
  };

  return (
    <div className="container-md page">
      <h1 className="h-display" style={{ fontSize: 32, marginBottom: 6 }}>
        Settings
      </h1>
      <p className="m-0 text-[15px] text-app-sub" style={{ marginBottom: 28 }}>
        Quiet controls. Take what you need.
      </p>

      {!user || !settings ? (
        <SettingsSkeleton />
      ) : (
        <div className="grid-2" style={{ alignItems: "start" }}>
          <div className="flex min-w-0 flex-col gap-4">
            <AccountCard user={user} onSignOut={leave} showToast={showToast} />
            <ProfileCard settings={settings} save={save} />
            <RemindersCard settings={settings} save={save} />
            <StoredCard />
            <TimeOffCard />
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <Card title="Region" sub="Used to show the right crisis hotlines.">
              <ChipGroup
                label="Region"
                options={REGIONS}
                value={settings.region}
                onPick={(region) => save({ region })}
              />
            </Card>
            <Card title="Reflector tone">
              <ChipGroup label="Reflector tone" options={TONES} value={settings.tone} onPick={(tone) => save({ tone })} />
            </Card>
            <ConsentsCard settings={settings} save={save} />
            <PasswordCard email={user.email} showToast={showToast} />
            <DangerCard onDeleted={onDeleted} />
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;

// ---------- Building blocks ----------

function Card({
  title,
  sub,
  titleColor,
  titleGap = 14,
  children,
  className,
  style,
}: {
  title?: string;
  sub?: string;
  titleColor?: string;
  /** Space under the h2 when there is no sub line. */
  titleGap?: number;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const id = useId();
  return (
    <section aria-labelledby={title ? id : undefined} className={clsx("card-light", className)} style={{ padding: 24, ...style }}>
      {title && (
        <h2
          id={id}
          className="font-display"
          style={{ margin: `0 0 ${sub ? 4 : titleGap}px`, fontWeight: 600, fontSize: 17, color: titleColor }}
        >
          {title}
        </h2>
      )}
      {sub && (
        <p className="m-0 text-[12.5px] text-app-faint" style={{ marginBottom: 14 }}>
          {sub}
        </p>
      )}
      {children}
    </section>
  );
}

function Row({ label, divider, children }: { label: string; divider?: boolean; children: ReactNode }) {
  return (
    <div
      className="flex items-center justify-between gap-3"
      style={{ padding: "10px 0", borderBottom: divider ? "1px solid var(--color-app-line-2)" : undefined }}
    >
      <span className="shrink-0 text-[13.5px] text-app-sub">{label}</span>
      {children}
    </div>
  );
}

/** A title/description row with a toggle. The whole row is the tap target. */
function SwitchRow({
  title,
  desc,
  checked,
  onChange,
  divider,
}: {
  title: string;
  desc?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  divider?: boolean;
}) {
  const titleId = useId();
  const descId = useId();
  return (
    <label
      className="flex cursor-pointer items-start justify-between gap-3.5"
      style={{ padding: "13px 0", borderBottom: divider ? "1px solid var(--color-app-line-2)" : undefined }}
    >
      <span className="min-w-0 flex-1">
        <span id={titleId} className="block text-[14px] font-semibold">
          {title}
        </span>
        {desc && (
          <span id={descId} className="block text-[12px] leading-[1.5] text-app-faint" style={{ marginTop: 2 }}>
            {desc}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={titleId}
        aria-describedby={desc ? descId : undefined}
        className="switch"
        style={{ marginTop: 1 }}
        onClick={() => onChange(!checked)}
      />
    </label>
  );
}

function ChipGroup<T extends string>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: Array<[T, string]>;
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map(([id, text]) => {
        const active = id === value;
        return (
          <button
            key={id}
            type="button"
            className="chip-light"
            data-active={active ? "true" : "false"}
            aria-pressed={active}
            onClick={() => {
              if (!active) onPick(id);
            }}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="grid-2" style={{ alignItems: "start" }} aria-busy="true" aria-live="polite" aria-label="Loading settings">
      {[0, 1].map((col) => (
        <div key={col} className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card-light animate-pulse" style={{ padding: 24 }}>
              <div className="h-4 w-1/3 rounded-md bg-app-line-2" />
              <div className="mt-4 h-3 w-3/4 rounded-md bg-app-line-2" />
              <div className="mt-2 h-3 w-1/2 rounded-md bg-app-line-2" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------- Left column ----------

function AccountCard({
  user,
  onSignOut,
  showToast,
}: {
  user: UserPublic;
  onSignOut: () => void;
  showToast: (message: string) => void;
}) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const payload = await exportApi.all();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `buddy-export-${localDateStamp()}.json`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      showToast("Export ready.");
    } catch (err) {
      showToast(errorMessage(err, "Couldn't build your export. Try again."));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card title="Account">
      <Row label="Email" divider>
        <span className="min-w-0 break-all text-right text-[13.5px] font-semibold">{user.email}</span>
      </Row>
      <Row label="Plan">
        <span
          className="pill"
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: "3px 11px",
            background: "color-mix(in oklab, var(--color-acc) 12%, #fff)",
            color: "var(--color-acc-ink)",
          }}
        >
          {planLabel(user.plan_tier)}
        </span>
      </Row>
      <div className="mt-3.5 flex flex-wrap gap-2.5">
        <button
          type="button"
          className="btn btn-soft"
          style={{ gap: 8 }}
          onClick={handleExport}
          disabled={exporting}
          aria-busy={exporting}
        >
          {exporting ? (
            <span className="spinner" style={{ width: 14, height: 14 }} aria-hidden="true" />
          ) : (
            <Download size={14} strokeWidth={1.8} aria-hidden="true" />
          )}
          {exporting ? "Preparing…" : "Export my data"}
        </button>
        <button type="button" className="btn btn-soft" style={{ gap: 8 }} onClick={onSignOut}>
          <LogOut size={14} strokeWidth={1.8} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </Card>
  );
}

function ProfileCard({ settings, save }: { settings: UserSettings; save: Save }) {
  const nameId = useId();
  const [name, setName] = useState(settings.display_name);

  // Keep the field in sync if settings change elsewhere (e.g. a revert after a failed save).
  useEffect(() => {
    setName(settings.display_name);
  }, [settings.display_name]);

  const commit = () => {
    const next = name.trim().slice(0, NAME_MAX);
    if (!next) {
      // A blank name isn't saved — snap back to the last saved one.
      setName(settings.display_name);
      return;
    }
    setName(next);
    if (next !== settings.display_name) void save({ display_name: next });
  };

  return (
    <Card title="Profile">
      <label htmlFor={nameId} className={LABEL}>
        Your name
      </label>
      <input
        id={nameId}
        className={INPUT}
        value={name}
        maxLength={NAME_MAX}
        autoComplete="given-name"
        placeholder="Your first name"
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />

      <div className={LABEL} style={{ marginTop: 18 }}>
        Your buddy
      </div>
      <div className="grid grid-cols-3 gap-2.5" role="group" aria-label="Your buddy">
        {COMPANIONS.map((c) => {
          const selected = c.id === settings.companion;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                if (!selected) void save({ companion: c.id });
              }}
              className="flex min-w-0 cursor-pointer flex-col items-center gap-2 rounded-[14px] border-0 transition-[background,box-shadow] duration-150"
              style={{
                padding: "12px 8px 11px",
                background: selected ? "color-mix(in oklab, var(--color-acc) 8%, #fff)" : "#fff",
                boxShadow: selected ? "inset 0 0 0 1.5px var(--color-acc)" : "inset 0 0 0 1px var(--color-app-line)",
              }}
            >
              <BuddyBlob size={44} colors={c.colors} follow={false} glow={false} aria-label="" />
              <span
                className="font-display text-[14px] font-semibold"
                style={{ letterSpacing: -0.2, color: selected ? "var(--color-acc)" : "var(--color-app-ink)" }}
              >
                {c.name}
              </span>
              <span className="text-center text-[11.5px] leading-[1.3] text-app-faint" style={{ marginTop: -4 }}>
                {c.trait}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function RemindersCard({ settings, save }: { settings: UserSettings; save: Save }) {
  const timeId = useId();
  const daysId = useId();
  const [time, setTime] = useState(settings.reminder_time);

  useEffect(() => {
    setTime(settings.reminder_time);
  }, [settings.reminder_time]);

  const days = Array.from({ length: 7 }, (_, i) => settings.reminder_days[i] === true);

  const toggleDay = (i: number) => {
    const next = days.slice();
    next[i] = !next[i];
    void save({ reminder_days: next });
  };

  return (
    <Card title="Reminders" titleGap={4}>
      <SwitchRow
        title="Daily reminder"
        desc="One gentle check-in a day, on the days you choose."
        checked={settings.reminders_enabled}
        onChange={(v) => save({ reminders_enabled: v })}
      />

      {settings.reminders_enabled && (
        <div className="flex flex-col gap-4" style={{ paddingTop: 10, ...REVEAL }}>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={timeId} className="text-[13px] font-semibold text-app-sub">
              Time
            </label>
            <input
              id={timeId}
              type="time"
              className={INPUT}
              style={{ width: 150 }}
              value={time}
              onChange={(e) => {
                const v = e.target.value;
                setTime(v);
                // type="time" reports "" while a segment is incomplete — only save whole values.
                if (v && v !== settings.reminder_time) void save({ reminder_time: v });
              }}
            />
          </div>

          <div>
            <div id={daysId} className="text-[13px] font-semibold text-app-sub">
              Days
            </div>
            <div className="mt-2 flex justify-between gap-1" role="group" aria-labelledby={daysId}>
              {DAY_LABELS.map((letter, i) => {
                const on = days[i];
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={on}
                    aria-label={DAY_NAMES[i]}
                    onClick={() => toggleDay(i)}
                    className="grid cursor-pointer place-items-center border-0 bg-transparent p-0"
                    style={{ flex: "0 1 44px", height: 44, minWidth: 0 }}
                  >
                    <span
                      className="grid place-items-center rounded-full text-[13.5px] font-semibold transition-[background,color] duration-150"
                      style={{
                        width: 36,
                        height: 36,
                        background: on ? "var(--color-acc)" : "rgba(20,18,16,.05)",
                        color: on ? "#fff" : "var(--color-app-sub)",
                      }}
                    >
                      {letter}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function StoredCard() {
  return (
    <Card title="What buddy stores about you" sub="A receipt, not a disclaimer.">
      <ul className="m-0 flex list-none flex-col gap-[9px] p-0 text-[13.5px] leading-[1.55] text-app-text">
        {STORED_LINES.map((line) => (
          <li key={line} className="flex gap-[9px]">
            <span className="font-bold" style={{ color: "var(--color-teal-ink)" }} aria-hidden="true">
              ✓
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TimeOffCard() {
  return (
    <section className="card-light flex items-start gap-3" style={{ padding: 24 }}>
      <Moon size={17} strokeWidth={1.7} aria-hidden="true" className="shrink-0" style={{ marginTop: 2, color: "var(--color-app-sub)" }} />
      <p className="m-0 text-[13.5px] leading-[1.6] text-app-sub">
        <span className="font-bold text-app-ink">Time-off mode</span> pauses all reminders. Coming in v1.1.
      </p>
    </section>
  );
}

// ---------- Right column ----------

function ConsentsCard({ settings, save }: { settings: UserSettings; save: Save }) {
  return (
    <Card title="Consents" titleGap={8}>
      {CONSENTS.map((c) => (
        <SwitchRow
          key={c.key}
          title={c.title}
          desc={c.desc}
          checked={settings[c.key]}
          onChange={(v) => save({ [c.key]: v })}
          divider
        />
      ))}
    </Card>
  );
}

function PasswordCard({ email, showToast }: { email: string; showToast: (message: string) => void }) {
  const curId = useId();
  const newId = useId();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!current) {
      setError("Enter your current password.");
      return;
    }
    if (next.length < 8) {
      setError("Your new password needs at least 8 characters.");
      return;
    }
    if (next === current) {
      setError("Pick a password that's different from your current one.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await authApi.changePassword(current, next);
      setCurrent("");
      setNext("");
      showToast("Password updated.");
    } catch (err) {
      setError(errorMessage(err, "Couldn't update your password. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Change password">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        {/* Lets password managers associate the new password with this account. */}
        <input type="email" autoComplete="username" value={email} readOnly tabIndex={-1} aria-hidden="true" className="sr-only" />
        <div>
          <label htmlFor={curId} className={LABEL}>
            Current password
          </label>
          <input
            id={curId}
            type="password"
            className={INPUT}
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            disabled={busy}
          />
        </div>
        <div>
          <label htmlFor={newId} className={LABEL}>
            New password
          </label>
          <input
            id={newId}
            type="password"
            className={INPUT}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            minLength={8}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            disabled={busy}
            aria-invalid={!!error}
          />
        </div>
        {error && (
          <p className="form-error" role="alert" style={{ marginTop: 0 }}>
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-soft self-start" style={{ gap: 8 }} disabled={busy} aria-busy={busy}>
          {busy && <span className="spinner" style={{ width: 14, height: 14 }} aria-hidden="true" />}
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    </Card>
  );
}

function DangerCard({ onDeleted }: { onDeleted: () => void }) {
  const pwId = useId();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cancel = () => {
    setOpen(false);
    setPassword("");
    setError(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!password) {
      setError("Enter your password to confirm.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await authApi.deleteAccount(password);
      onDeleted(); // signs out + navigates; this card unmounts
    } catch (err) {
      setError(errorMessage(err, "Couldn't delete your account. Try again."));
      setBusy(false);
    }
  };

  return (
    <Card title="Danger zone" titleColor="var(--color-care)" titleGap={8}>
      <p className="m-0 text-[13.5px] leading-[1.55] text-app-sub">Delete my account and everything in it.</p>

      {!open ? (
        <button type="button" className="btn btn-soft danger mt-3.5" onClick={() => setOpen(true)}>
          Delete account…
        </button>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-3.5 flex flex-col gap-3" style={REVEAL}>
          <div>
            <label htmlFor={pwId} className={LABEL}>
              Confirm with your password
            </label>
            <input
              id={pwId}
              type="password"
              className={INPUT}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              aria-invalid={!!error}
              autoFocus
            />
          </div>
          {error && (
            <p className="form-error" role="alert" style={{ marginTop: 0 }}>
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2.5">
            <button
              type="submit"
              className="btn btn-soft danger"
              style={{ gap: 8 }}
              disabled={busy || !password}
              aria-busy={busy}
            >
              {busy && <span className="spinner" style={{ width: 14, height: 14 }} aria-hidden="true" />}
              {busy ? "Deleting…" : "Yes, delete everything"}
            </button>
            <button type="button" className="btn btn-soft" onClick={cancel} disabled={busy}>
              Keep my account
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}
