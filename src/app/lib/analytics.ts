/**
 * Google Analytics 4.
 *
 * Loads only when VITE_GA_MEASUREMENT_ID is set, so local dev and any build
 * without the ID stay completely silent (no script, no network calls).
 *
 * Page views are sent manually on route change: GA's automatic pageview fires
 * once on load, which would miss every navigation in a single-page app.
 */

const GA_ID: string | undefined = import.meta.env.VITE_GA_MEASUREMENT_ID;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let loaded = false;

/** Inject gtag.js once. No-op without an ID. */
export function initAnalytics(): void {
  if (loaded || !GA_ID || typeof document === "undefined") return;
  loaded = true;

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // gtag relies on `arguments`, so it cannot be a rest-args arrow.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  // Router sends page_view itself, so suppress the automatic one.
  window.gtag("config", GA_ID, { send_page_view: false });
}

/** One page view. Call on every route change. */
export function trackPageView(path: string): void {
  if (!GA_ID || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

/** A named conversion, e.g. waitlist_signup. */
export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  if (!GA_ID || !window.gtag) return;
  window.gtag("event", name, params);
}
