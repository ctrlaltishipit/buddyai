/**
 * Per-route document metadata for a single-page app.
 *
 * index.html ships one <title> and one description for every URL. Search
 * engines render our JS, so updating the head on each navigation is enough
 * for them to see a distinct title, description and canonical URL per page,
 * and to keep the private screens (/app/*, /auth, /welcome) out of the index.
 *
 * Keep this list in sync with public/sitemap.xml and public/robots.txt.
 */

export const SITE_ORIGIN = "https://www.buddyai.co.in";

const DEFAULT_TITLE = "buddy.ai · Someone to talk to, day or night";
const DEFAULT_DESCRIPTION =
  "buddy.ai is a companion and a journal in one. Vent, think out loud, or write the day down. buddy listens, helps you make sense of it, and keeps every word private to you.";

interface RouteMeta {
  title: string;
  description: string;
  /** Public pages are indexed; everything else is noindex. */
  index: boolean;
}

const ROUTES: Record<string, RouteMeta> = {
  "/": { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, index: true },
  "/tour": {
    title: "Inside the app · buddy.ai",
    description:
      "Real screens from buddy: a home that knows where you left off, a journal that writes back, an emotion map of your weeks, and the Reflector, which listens and asks.",
    index: true,
  },
  "/about": {
    title: "Why we're building buddy · buddy.ai",
    description:
      "buddy exists for the moments when you want to talk and nobody is free. Who is building it, what it will never do, and the four things we will not trade away.",
    index: true,
  },
  "/signup": {
    title: "Get early access · buddy.ai",
    description:
      "Create your buddy, pick a companion, and sign up with Google. We are opening access in waves and will email you the moment yours is ready.",
    index: true,
  },
  "/auth": { title: "Sign in · buddy.ai", description: DEFAULT_DESCRIPTION, index: false },
  "/welcome": { title: "You're on the list · buddy.ai", description: DEFAULT_DESCRIPTION, index: false },
};

const APP_TITLES: Record<string, string> = {
  "/app/home": "Home",
  "/app/journal": "Journal",
  "/app/map": "Emotion map",
  "/app/reflector": "The Reflector",
  "/app/settings": "Settings",
};

function metaFor(pathname: string): RouteMeta & { canonical: string } {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path.startsWith("/app")) {
    const screen = APP_TITLES[path] ?? "buddy";
    return { title: `${screen} · buddy.ai`, description: DEFAULT_DESCRIPTION, index: false, canonical: `${SITE_ORIGIN}${path}` };
  }
  const known = ROUTES[path];
  if (known) return { ...known, canonical: `${SITE_ORIGIN}${path === "/" ? "/" : path}` };
  // Unknown paths redirect to "/" in the router; point crawlers there too.
  return { ...ROUTES["/"], canonical: `${SITE_ORIGIN}/` };
}

function upsertMeta(selector: string, attrs: Record<string, string>): void {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = document.createElement(selector.startsWith("link") ? "link" : "meta");
    document.head.appendChild(el);
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
}

/** Update <title>, description, robots, canonical and Open Graph for a route. */
export function applyRouteMeta(pathname: string): void {
  if (typeof document === "undefined") return;
  const m = metaFor(pathname);

  document.title = m.title;
  upsertMeta('meta[name="description"]', { name: "description", content: m.description });
  upsertMeta('meta[name="robots"]', { name: "robots", content: m.index ? "index,follow" : "noindex,nofollow" });
  upsertMeta('link[rel="canonical"]', { rel: "canonical", href: m.canonical });

  upsertMeta('meta[property="og:title"]', { property: "og:title", content: m.title });
  upsertMeta('meta[property="og:description"]', { property: "og:description", content: m.description });
  upsertMeta('meta[property="og:url"]', { property: "og:url", content: m.canonical });
  upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: m.title });
  upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: m.description });
}
