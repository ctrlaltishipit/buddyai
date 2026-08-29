/**
 * Product vocabulary shared across screens: companions, topics, journal
 * templates, day labels, greetings. Copy comes straight from the design
 * reference (web/design/buddy-redesign.reference.html).
 */
import type { CompanionId, OnboardingStep, TemplateId } from "./types";

export interface Companion {
  id: CompanionId;
  name: string;
  trait: string; // "Calm & reflective"
  blurb: string; // landing-page description
  /** Three gradient stops for <BuddyBlob colors=…> */
  colors: [string, string, string];
}

export const COMPANIONS: Companion[] = [
  {
    id: "sage",
    name: "Sage",
    trait: "Calm & reflective",
    blurb: "Calm & reflective. Asks the slow, deep questions.",
    colors: ["#FFF1A8", "#FFD23F", "#FFA61C"],
  },
  {
    id: "sol",
    name: "Sol",
    trait: "Warm & encouraging",
    blurb: "Warm & encouraging. Your gentlest hype-friend.",
    colors: ["#FFE07A", "#FF8A1F", "#E8451C"],
  },
  {
    id: "ember",
    name: "Ember",
    trait: "Bold & motivating",
    blurb: "Bold & motivating. Lights a fire, kindly.",
    colors: ["#FF7A1A", "#C2410C", "#1C1410"],
  },
];

export function companionById(id: CompanionId | string | null | undefined): Companion {
  return COMPANIONS.find((c) => c.id === id) ?? COMPANIONS[0];
}

/** Onboarding topics: [label, emoji] */
export const TOPICS: Array<{ label: string; emoji: string }> = [
  { label: "Reduce stress", emoji: "🌿" },
  { label: "Build a habit", emoji: "🌱" },
  { label: "Process emotions", emoji: "💭" },
  { label: "Gratitude", emoji: "☀️" },
  { label: "Sleep better", emoji: "🌙" },
  { label: "Self-discovery", emoji: "🧭" },
  { label: "Focus & work", emoji: "⚡" },
  { label: "Relationships", emoji: "💞" },
];

export interface JournalTemplate {
  id: TemplateId;
  label: string;
  prompt: string; // page title when active
  placeholder: string;
}

export const TEMPLATES: JournalTemplate[] = [
  {
    id: "freeform",
    label: "Freeform",
    prompt: "What's here, right now?",
    placeholder: "Write a sentence, a fragment, a whole story. Whatever wants out.",
  },
  {
    id: "cbt",
    label: "CBT log",
    prompt: "Situation → thought → feeling → evidence",
    placeholder: "What happened? What did you tell yourself? What does the evidence look like?",
  },
  {
    id: "gratitude",
    label: "Gratitude",
    prompt: "Three small things to notice.",
    placeholder: "1. \n2. \n3. ",
  },
  {
    id: "checkin",
    label: "Check-in",
    prompt: "How is your body? Your mind? Your heart?",
    placeholder: "Body:\nMind:\nHeart:",
  },
];

export function templateById(id: TemplateId | string | null | undefined): JournalTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

/** Monday-first, matches `UserSettings.reminder_days`. */
export const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;
export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

/** Wizard order. `create` is the pre-account step; the rest map to `onboarding_step`. */
export const SIGNUP_STEPS: Array<"create" | OnboardingStep> = [
  "create",
  "verify",
  "name",
  "companion",
  "goals",
  "reminder",
  "done",
];

/** Panel copy for the right-hand blob panel of the signup wizard. */
export function signupPanelCopy(step: "create" | OnboardingStep, companionName: string, trait: string) {
  const map: Record<"create" | OnboardingStep, [string, string]> = {
    create: ["Your space, sealed.", "Your entries are private to your account before anything else happens."],
    verify: ["Just making sure it's you.", "One code, once. Buddy never emails you without a reason."],
    name: ["Buddy greets you by name.", "Every session starts like a conversation, not a form."],
    companion: [`${companionName}: ${trait.toLowerCase()}.`, "Your companion shapes the tone of every reflection."],
    goals: ["Prompts tuned to your life.", "Buddy uses your picks to ask better questions."],
    reminder: ["A nudge, never a nag.", "One gentle check-in a day, on the days you choose."],
    done: [`Say hi to ${companionName}.`, "Your space is ready. Everything in it is yours alone."],
  };
  return map[step];
}

/** "MORNING" / "AFTERNOON" / … for the Home eyebrow. */
export function greetingFor(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "LATE NIGHT";
  if (h < 12) return "MORNING";
  if (h < 17) return "AFTERNOON";
  if (h < 21) return "EVENING";
  return "TONIGHT";
}

/** "Thursday, August 27" */
export function dateLine(date = new Date()): string {
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

/** "Aug 26 · 9:12 PM" */
export function formatEntryStamp(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

/** "9:00" + "PM" from "21:00". */
export function splitTime12h(hhmm: string): { time: string; ampm: "AM" | "PM" } {
  const [hStr, mStr = "00"] = hhmm.split(":");
  const h = Number(hStr);
  const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { time: `${h12}:${mStr.padStart(2, "0")}`, ampm };
}

/** First name for greetings; falls back to the email's local part, then "friend". */
export function firstName(displayName: string | null | undefined, email?: string | null): string {
  const n = (displayName ?? "").trim();
  if (n) return n.split(/\s+/)[0];
  const local = (email ?? "").split("@")[0];
  return local || "friend";
}
