/**
 * buddy.ai API client — thin fetch wrapper over the FastAPI backend.
 *
 * Base URL: VITE_API_BASE_URL, default http://localhost:8000.
 * The JWT lives in localStorage under `buddy_token` and is attached to every
 * authenticated request. A 401 clears the token and fires `buddy:unauthorized`
 * on `window` so the session store can sign the user out.
 */
import type {
  AnalyzeResponse,
  AuthSuccess,
  CrisisCheckResponse,
  EntryCreate,
  EntryList,
  ExportPayload,
  ForgotPasswordResult,
  InsightsMap,
  InsightsSummary,
  JournalEntry,
  MapRange,
  ReflectorApiResponse,
  ReflectorMessage,
  Region,
  Session,
  SettingsPatch,
  UserSettings,
  VerificationInfo,
} from "./types";

export const API_BASE: string =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

const TOKEN_KEY = "buddy_token";
export const UNAUTHORIZED_EVENT = "buddy:unauthorized";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* noop */
  }
}

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/** Human-friendly message for any thrown error. */
export function errorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (err instanceof ApiError) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init.body ? { "Content-Type": "application/json" } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };
  const token = auth ? getToken() : null;
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(`Could not reach Buddy. Is the backend running on ${API_BASE}?`, 0);
  }

  if (res.status === 401 && auth && token) {
    setToken(null);
    try {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    } catch {
      /* noop */
    }
  }

  if (!res.ok) {
    let detail: unknown = res.statusText;
    try {
      const body = await res.json();
      if (body?.detail !== undefined) detail = body.detail;
    } catch {
      /* noop */
    }
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string } | null) => d?.msg ?? JSON.stringify(d)).join("; ")
          : res.statusText || `Request failed (${res.status})`;
    throw new ApiError(message, res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const json = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

// ---------- Auth ----------

export const authApi = {
  signup: (email: string, password: string) =>
    request<AuthSuccess>("/auth/signup", json({ email, password }), false),

  login: (email: string, password: string) =>
    request<AuthSuccess>("/auth/login", json({ email, password }), false),

  /** Current user + settings. 401 if the token is missing/expired. */
  me: () => request<Session>("/auth/me"),

  /** Submit the 6-digit email verification code. */
  verify: (code: string) => request<Session>("/auth/verify", json({ code })),

  /** Issue a fresh verification code (rate-limited server-side). */
  resendCode: () => request<VerificationInfo>("/auth/resend-code", { method: "POST" }),

  forgotPassword: (email: string) =>
    request<ForgotPasswordResult>("/auth/forgot-password", json({ email }), false),

  changePassword: (current_password: string, new_password: string) =>
    request<{ ok: boolean }>("/auth/change-password", json({ current_password, new_password })),

  /** Permanently deletes the account and ALL of its data. */
  deleteAccount: (password: string) =>
    request<void>("/auth/me", { method: "DELETE", body: JSON.stringify({ password }) }),
};

// ---------- Settings ----------

export const settingsApi = {
  patch: (patch: SettingsPatch) =>
    request<UserSettings>("/settings", { method: "PATCH", body: JSON.stringify(patch) }),
};

// ---------- Journal entries (always scoped to the signed-in user) ----------

export const entriesApi = {
  list: (opts: { limit?: number; cursor?: string | null } = {}) => {
    const q = new URLSearchParams();
    if (opts.limit) q.set("limit", String(opts.limit));
    if (opts.cursor) q.set("cursor", opts.cursor);
    const qs = q.toString();
    return request<EntryList>(`/entries${qs ? `?${qs}` : ""}`);
  },
  create: (body: EntryCreate) => request<JournalEntry>("/entries", json(body)),
  remove: (id: string) => request<void>(`/entries/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

// ---------- Insights ----------

/** Minutes EAST of UTC for the browser's zone (JS getTimezoneOffset is west-positive). */
export function tzOffsetMinutes(): number {
  return -new Date().getTimezoneOffset();
}

export const insightsApi = {
  summary: () => request<InsightsSummary>(`/insights/summary?tz_offset=${tzOffsetMinutes()}`),
  map: (range: MapRange) =>
    request<InsightsMap>(`/insights/map?range=${range}&tz_offset=${tzOffsetMinutes()}`),
};

// ---------- Export ----------

export const exportApi = {
  all: () => request<ExportPayload>("/me/export"),
};

// ---------- Stateless analysis ----------

export const analyzeApi = {
  analyze: (text: string) => request<AnalyzeResponse>("/analyze", json({ text }), false),
};

export const crisisApi = {
  check: (text: string, locale: Region = "IN") =>
    request<CrisisCheckResponse>("/crisis-check", json({ text, locale }), false),
};

export const reflectorApi = {
  turn: (history: ReflectorMessage[], userInput: string, dominantEmotion?: string | null) =>
    request<ReflectorApiResponse>(
      "/reflector",
      json({
        history: history.map((m) => ({ role: m.role, text: m.text })),
        user_input: userInput,
        dominant_emotion: dominantEmotion ?? null,
      }),
      false,
    ),
};
