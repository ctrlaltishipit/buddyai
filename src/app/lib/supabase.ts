/**
 * Supabase browser client.
 *
 * Only used for early-access sign-up (Google OAuth + joining the waitlist).
 * Journal data still goes through the FastAPI backend.
 *
 * Both env vars are public by design: the anon key is meant to ship to the
 * browser, and every table has row-level security denying it direct access.
 * If either is missing the client is null and the UI shows a clear message
 * instead of throwing on load.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL: string | undefined = import.meta.env.VITE_SUPABASE_URL;
const ANON: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True once both env vars are set, so screens can degrade gracefully. */
export const isSupabaseConfigured = Boolean(URL && ANON && !URL.startsWith("PASTE_"));

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(URL!, ANON!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // The OAuth redirect returns tokens in the URL fragment.
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    })
  : null;

/** Where Google sends the user back to. Must be listed in Supabase → URL Configuration. */
export function oauthRedirectTo(): string {
  return `${window.location.origin}/welcome`;
}
