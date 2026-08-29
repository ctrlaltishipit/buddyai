/**
 * How an entry's feelings are shown in lists (Home, Journal). One rule so the
 * same entry never looks different from one screen to the next.
 */
import { moodColor } from "./mood-colors";
import type { EmotionScore, JournalEntry } from "./types";

/**
 * Confirmed emotions, falling back to every emotion when none are confirmed
 * (same rule the backend uses for insights). De-duped by name, entry order kept.
 */
export function visibleEmotions(entry: JournalEntry): EmotionScore[] {
  const confirmed = entry.emotions.filter((e) => e.confirmed);
  const list = confirmed.length ? confirmed : entry.emotions;
  const seen = new Set<string>();
  return list.filter((e) => {
    const key = e.emotion.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 4px rail: gradient of the first two emotion colors, solid if one, a hairline if none. */
export function railFor(emotions: EmotionScore[]): string {
  const [a, b] = emotions;
  if (a && b) return `linear-gradient(${moodColor(a.emotion)}, ${moodColor(b.emotion)})`;
  if (a) return moodColor(a.emotion);
  return "var(--color-app-line)";
}
