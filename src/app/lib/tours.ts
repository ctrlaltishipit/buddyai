/**
 * The two guided tours and the "have they seen it" bookkeeping.
 *
 *   landing  — first visit to buddyai.co.in: what buddy is, section by section.
 *   app      — first sign-in after onboarding: what each part of the app does.
 *
 * Each auto-runs once per browser (localStorage) and can be replayed on
 * demand: "Show me around" on the landing page, "Replay the tour" in Settings.
 * Replay across a navigation goes through sessionStorage so the request
 * survives the route change.
 */
import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import type { TourStep } from "../components/GuidedTour";

export type TourId = "landing" | "app";

const SEEN_KEY = (id: TourId) => `buddy_tour_seen:${id}`;
const REPLAY_KEY = "buddy_tour_replay";

export const LANDING_TOUR: TourStep[] = [
  {
    title: "New here? Take a quick look around.",
    body: "Thirty seconds, six stops, and you can skip out at any point. buddy is a companion and a journal in one, and this is what that means.",
    cta: "Show me",
  },
  {
    target: "hero",
    title: "Someone to talk to, day or night.",
    body: "Vent, think out loud, or write the day down. buddy listens, helps you make sense of it, and keeps every word private to you.",
  },
  {
    target: "why",
    title: "Why people use it.",
    body: "It is around at 3am when nobody else is. It is private to you, always. And it shows you how you have been, not just how you are today.",
  },
  {
    target: "how",
    title: "How it works.",
    body: "Say what is going on. buddy picks up what you are feeling and asks something back. Each entry adds a thread to your map.",
  },
  {
    target: "map",
    title: "Your emotion map.",
    body: "Every feeling you confirm becomes a thread. Over a few weeks the threads make a shape, and the shape shows you patterns you would miss on your own.",
  },
  {
    target: "privacy",
    title: "Private by design.",
    body: "Entries are tied to your account and nobody else can open them. Export everything or delete everything, any time, in one click.",
  },
  {
    target: "companions",
    title: "Pick your buddy.",
    body: "Sage, Sol or Ember. Three personalities to start from. They all listen first, and you can switch whenever you like.",
  },
  {
    target: "inside",
    title: "See the real screens.",
    body: "Inside the app walks through every screen of the product, captured from the running build rather than mocked up.",
  },
  {
    target: "cta",
    title: "Ready when you are.",
    body: "Create your buddy and sign up with Google. We are opening access in waves and will email you the moment yours is ready.",
    cta: "Got it",
  },
];

export const APP_TOUR: TourStep[] = [
  {
    title: "Welcome in. Here is the lay of the land.",
    body: "Five parts, one thing: somewhere to put it down, someone to say it to, and a way to see what it adds up to. Skip this any time.",
    cta: "Show me",
  },
  {
    target: "nav-home",
    title: "Home",
    body: "Where you left off. What you have written this week, how often you have come back, and the feeling running underneath it.",
  },
  {
    target: "home-stats",
    title: "A read on your week.",
    body: "Entries, days you showed up, and a leaning. It names a noticing, never a verdict, and nothing here turns red if you miss a day.",
  },
  {
    target: "home-checkin",
    title: "One-tap check-in.",
    body: "Pick up to three feelings. No writing needed. A hard day still reaches your map even when you have nothing to say about it.",
  },
  {
    target: "nav-journal",
    title: "Journal",
    body: "Write it however it comes out. Freeform when you just need to get it out, or a guided format when you do not know where to start.",
  },
  {
    target: "nav-map",
    title: "Map",
    body: "Every feeling you confirm becomes a thread. Which feeling was most present, what shifted, and quiet noticings you are free to take or leave.",
  },
  {
    target: "nav-reflector",
    title: "The Reflector",
    body: "Someone who only listens and asks. It never tells you what to do, and nothing you say here is saved.",
  },
  {
    target: "streak",
    title: "Coming back.",
    body: "How many of the last seven days you showed up. It is a count, not a chain to break, and buddy will not guilt you about it.",
  },
  {
    target: "nav-settings",
    title: "Settings",
    body: "Change your buddy, set a reminder, export everything or delete everything. It is all yours to take back, and you can replay this tour from here.",
    cta: "Done",
  },
];

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function hasSeenTour(id: TourId): boolean {
  return read(SEEN_KEY(id)) === "1";
}

export function markTourSeen(id: TourId): void {
  try {
    localStorage.setItem(SEEN_KEY(id), "1");
  } catch {
    /* private browsing: the tour simply shows again next time */
  }
}

/** Ask for a tour to start once the host screen mounts (survives navigation). */
export function requestTour(id: TourId): void {
  try {
    sessionStorage.setItem(REPLAY_KEY, id);
  } catch {
    /* noop */
  }
}

function takeReplay(id: TourId): boolean {
  try {
    if (sessionStorage.getItem(REPLAY_KEY) !== id) return false;
    sessionStorage.removeItem(REPLAY_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Open/close state for a tour on its host screen.
 *
 * Opens automatically on the first visit (after `delayMs`, so the page's own
 * entrance animation lands first) or immediately when a replay was requested.
 * `when` gates the auto-run, e.g. "the data this tour points at has loaded".
 */
export function useTour(id: TourId, { delayMs = 900, when = true }: { delayMs?: number; when?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  // The app shell stays mounted across /app/* navigations, so a replay
  // requested from Settings is only noticed if we re-check on route change.
  const { pathname } = useLocation();

  useEffect(() => {
    if (open) return;
    if (takeReplay(id)) {
      setOpen(true);
      return;
    }
    if (!when || hasSeenTour(id)) return;
    const t = window.setTimeout(() => setOpen(true), delayMs);
    return () => window.clearTimeout(t);
  }, [id, when, delayMs, open, pathname]);

  const close = () => {
    markTourSeen(id);
    setOpen(false);
  };
  const start = () => setOpen(true);

  return { open, close, start };
}
