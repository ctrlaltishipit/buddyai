/**
 * Shared types for the buddy.ai frontend.
 *
 * THIS FILE MIRRORS THE BACKEND CONTRACT in web/backend/app/schemas.py.
 * If you change a shape here, change it there too (and vice versa).
 */

// ---------- Vocabulary ----------

export type EmotionName =
  | "joy"
  | "sadness"
  | "anxiety"
  | "frustration"
  | "gratitude"
  | "love"
  | "hope"
  | "tiredness"
  | "shame"
  | "neutral";

export type TemplateId = "freeform" | "cbt" | "gratitude" | "checkin";
export type CompanionId = "sage" | "sol" | "ember";
export type Region = "IN" | "US" | "OTHER";
export type Tone = "warm" | "neutral" | "brief";
export type OnboardingStep = "verify" | "name" | "companion" | "goals" | "reminder" | "done";
export type MapRange = "week" | "month" | "all";

// ---------- Auth / session ----------

export interface UserPublic {
  id: string;
  email: string;
  verified: boolean;
  plan_tier: "free" | "plus" | string;
  created_at: string; // ISO
}

export interface UserSettings {
  display_name: string;
  companion: CompanionId;
  topics: string[];
  reminder_time: string; // "HH:MM" 24h, e.g. "21:00"
  reminder_days: boolean[]; // length 7, Monday first
  reminders_enabled: boolean;
  region: Region;
  tone: Tone;
  consent_nlp: boolean;
  consent_voice: boolean;
  consent_crash: boolean;
  onboarding_step: OnboardingStep;
  onboarding_complete: boolean;
  updated_at: string; // ISO
}

/** PATCH /settings body — every field optional. */
export type SettingsPatch = Partial<Omit<UserSettings, "updated_at">>;

export interface Session {
  user: UserPublic;
  settings: UserSettings;
}

export interface VerificationInfo {
  sent: boolean;
  expires_in_seconds: number;
  /** Only present when the backend has no SMTP configured (local dev). */
  dev_code: string | null;
}

export interface AuthSuccess extends Session {
  access_token: string;
  token_type: "bearer";
  verification?: VerificationInfo | null;
}

export interface ForgotPasswordResult {
  ok: boolean;
  message: string;
}

// ---------- Journal entries ----------

export interface EmotionScore {
  emotion: EmotionName | string;
  score: number; // 0..1
  confirmed: boolean;
  source: "ai" | "user";
}

export interface JournalEntry {
  id: string;
  created_at: string; // ISO
  updated_at: string; // ISO
  template: TemplateId;
  text: string;
  word_count: number;
  sentiment: number; // -1..1
  intensity: number; // 0..1
  keywords: string[];
  is_crisis_flagged: boolean;
  emotions: EmotionScore[];
}

export interface EntryCreate {
  text: string;
  template: TemplateId;
  emotions: EmotionScore[];
}

export interface EntryPatch {
  text?: string;
  template?: TemplateId;
  emotions?: EmotionScore[];
}

export interface EntryList {
  items: JournalEntry[];
  /** Pass back as `cursor` to fetch the next (older) page. */
  next_cursor: string | null;
  total: number;
}

// ---------- Insights ----------

export interface InsightsSummary {
  entries_this_week: number;
  entries_today: number;
  streak_days: number;
  /** Dominant confirmed emotion over the last 7 days, or null if no entries. */
  leaning: string | null;
  total_entries: number;
  last_entry_at: string | null;
}

export interface MapBucket {
  key: string; // ISO date of bucket start
  label: string; // axis label, e.g. "Aug 21", "M", "Jun"
}

export interface MapSeries {
  emotion: string;
  values: number[]; // one per bucket; sum of confirmed scores in that bucket
  total: number;
}

export interface MapMix {
  emotion: string;
  pct: number; // integer 0..100; all mix entries sum to 100 (or 0 if empty)
}

export interface MapCard {
  label: string; // "Most present" | "Biggest shift" | "Most written"
  value: string; // "Joy", "Anxiety ↓", "Sunday", "8 to 10 PM"
  sub: string;
  emotion: string | null; // for the dot color
}

export interface InsightsMap {
  range: MapRange;
  range_label: string; // "this week" | "this month" | "all time"
  start: string; // ISO
  end: string; // ISO
  buckets: MapBucket[];
  series: MapSeries[]; // top 3 emotions in range, most present first
  mix: MapMix[];
  cards: MapCard[];
  noticings: string[];
  entry_count: number;
  y_max: number; // suggested chart ceiling (>= max value, >= 1)
}

// ---------- Export ----------

export interface ExportPayload {
  exported_at: string;
  user: UserPublic;
  settings: UserSettings;
  entries: JournalEntry[];
  note: string;
}

// ---------- Stateless analysis ----------

export interface AnalyzeResponse {
  emotions: EmotionScore[];
  sentiment: number;
  intensity: number;
  keywords: string[];
  is_crisis_flagged: boolean;
}

export interface CrisisResource {
  label: string;
  phone?: string | null;
  text_line?: string | null;
  url?: string | null;
  note?: string | null;
}

export interface CrisisCheckResponse {
  flagged: boolean;
  matched_phrase: string | null;
  resources: CrisisResource[];
}

// ---------- Reflector (client-side history only; never persisted) ----------

export interface ReflectorMessage {
  role: "user" | "reflector";
  text: string;
  ts: string; // ISO
}

export interface ReflectorApiResponse {
  turn: "validate" | "mirror" | "ask" | "crisis";
  text: string;
  redirect_to_crisis: boolean;
}
