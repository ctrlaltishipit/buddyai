/**
 * Session store — auth, per-user settings, global crisis modal, toasts.
 *
 * All user data lives on the server, scoped to the signed-in account.
 * This store only caches the current session (user + settings) in memory;
 * journal entries and insights are fetched by the screens that need them
 * (see `entriesVersion` for cross-screen invalidation).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { ApiError, authApi, getToken, setToken, settingsApi, UNAUTHORIZED_EVENT } from "./api";
import type {
  AuthSuccess,
  CrisisResource,
  Session,
  SettingsPatch,
  UserPublic,
  UserSettings,
} from "./types";

// ---------- State ----------

export type SessionStatus = "loading" | "anon" | "authed";

interface Toast {
  id: number;
  message: string;
}

interface State {
  status: SessionStatus;
  user: UserPublic | null;
  settings: UserSettings | null;
  crisis: { open: boolean; resources: CrisisResource[]; matchedPhrase: string | null };
  toast: Toast | null;
  /** Bumped whenever an entry is created/edited/deleted so Home/Map refetch. */
  entriesVersion: number;
}

const initialState: State = {
  status: "loading",
  user: null,
  settings: null,
  crisis: { open: false, resources: [], matchedPhrase: null },
  toast: null,
  entriesVersion: 0,
};

type Action =
  | { type: "HYDRATE"; session: Session | null }
  | { type: "SIGN_OUT" }
  | { type: "SET_SETTINGS"; settings: UserSettings }
  | { type: "SET_USER"; user: UserPublic }
  | { type: "OPEN_CRISIS"; resources: CrisisResource[]; matchedPhrase: string | null }
  | { type: "CLOSE_CRISIS" }
  | { type: "SHOW_TOAST"; toast: Toast }
  | { type: "HIDE_TOAST"; id: number }
  | { type: "BUMP_ENTRIES" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "HYDRATE":
      return action.session
        ? { ...state, status: "authed", user: action.session.user, settings: action.session.settings }
        : { ...state, status: "anon", user: null, settings: null };
    case "SIGN_OUT":
      return { ...state, status: "anon", user: null, settings: null, entriesVersion: 0 };
    case "SET_SETTINGS":
      return { ...state, settings: action.settings };
    case "SET_USER":
      return { ...state, user: action.user };
    case "OPEN_CRISIS":
      return { ...state, crisis: { open: true, resources: action.resources, matchedPhrase: action.matchedPhrase } };
    case "CLOSE_CRISIS":
      return { ...state, crisis: { ...state.crisis, open: false } };
    case "SHOW_TOAST":
      return { ...state, toast: action.toast };
    case "HIDE_TOAST":
      return state.toast?.id === action.id ? { ...state, toast: null } : state;
    case "BUMP_ENTRIES":
      return { ...state, entriesVersion: state.entriesVersion + 1 };
    default:
      return state;
  }
}

// ---------- Context API ----------

export interface StoreApi {
  state: State;
  /** Store a token + session after signup/login. */
  signIn(auth: AuthSuccess): void;
  /** Replace the cached session (e.g. after /auth/verify). */
  setSession(session: Session): void;
  signOut(): void;
  /** Re-fetch /auth/me and update the cache. */
  refreshSession(): Promise<Session | null>;
  /**
   * Optimistically apply a settings patch, PATCH it to the server, and return
   * the server's copy. On failure the previous settings are restored and the
   * error is re-thrown.
   */
  updateSettings(patch: SettingsPatch): Promise<UserSettings>;
  openCrisis(resources: CrisisResource[], matchedPhrase: string | null): void;
  closeCrisis(): void;
  showToast(message: string, ms?: number): void;
  /** Call after creating/editing/deleting an entry so other screens refetch. */
  bumpEntries(): void;
}

const StoreContext = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const toastTimer = useRef<number | null>(null);

  const refreshSession = useCallback(async (): Promise<Session | null> => {
    if (!getToken()) {
      dispatch({ type: "HYDRATE", session: null });
      return null;
    }
    try {
      const session = await authApi.me();
      dispatch({ type: "HYDRATE", session });
      return session;
    } catch (err) {
      // A rejected token is already cleared by api.ts (401). Keep it on a
      // network/server hiccup so a reload can restore the session.
      if (err instanceof ApiError && err.status === 401) setToken(null);
      dispatch({ type: "HYDRATE", session: null });
      return null;
    }
  }, []);

  // Hydrate once on mount.
  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  // Any 401 from the API client signs us out.
  useEffect(() => {
    const onUnauthorized = () => dispatch({ type: "SIGN_OUT" });
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const showToast = useCallback((message: string, ms = 2600) => {
    const id = Date.now();
    dispatch({ type: "SHOW_TOAST", toast: { id, message } });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => dispatch({ type: "HIDE_TOAST", id }), ms);
  }, []);

  const api = useMemo<StoreApi>(
    () => ({
      state,
      signIn(auth) {
        setToken(auth.access_token);
        dispatch({ type: "HYDRATE", session: { user: auth.user, settings: auth.settings } });
      },
      setSession(session) {
        dispatch({ type: "HYDRATE", session });
      },
      signOut() {
        setToken(null);
        dispatch({ type: "SIGN_OUT" });
      },
      refreshSession,
      async updateSettings(patch) {
        const prev = stateRef.current.settings;
        if (prev) dispatch({ type: "SET_SETTINGS", settings: { ...prev, ...patch } });
        try {
          const saved = await settingsApi.patch(patch);
          dispatch({ type: "SET_SETTINGS", settings: saved });
          return saved;
        } catch (err) {
          if (prev) dispatch({ type: "SET_SETTINGS", settings: prev });
          throw err;
        }
      },
      openCrisis(resources, matchedPhrase) {
        dispatch({ type: "OPEN_CRISIS", resources, matchedPhrase });
      },
      closeCrisis() {
        dispatch({ type: "CLOSE_CRISIS" });
      },
      showToast,
      bumpEntries() {
        dispatch({ type: "BUMP_ENTRIES" });
      },
    }),
    [state, refreshSession, showToast],
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

