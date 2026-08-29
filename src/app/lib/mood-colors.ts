/**
 * Emotion → color mappings.
 * Used ONLY for mood pills, the Emotion Map threads, entry rails and the
 * "leaning" chip. UI chrome stays neutral; color comes from feelings.
 */
import type { EmotionName } from "./types";

/** Dot / line / fill color. */
export const MOOD_COLOR: Record<EmotionName | string, string> = {
  joy: "#E8B23A",
  gratitude: "#9CB071",
  love: "#D58E8E",
  hope: "#C8A66B",
  sadness: "#7C8EA8",
  anxiety: "#A395C2",
  frustration: "#C97A5D",
  tiredness: "#8A8F9C",
  shame: "#9A7E8C",
  neutral: "#B8B0A2",
};

/** Darker text color that reads on a light tinted pill. */
export const MOOD_DEEP: Record<EmotionName | string, string> = {
  joy: "#9C7314",
  gratitude: "#75894E",
  love: "#A05B5B",
  hope: "#96793F",
  sadness: "#5D7089",
  anxiety: "#7A6B99",
  frustration: "#9A5238",
  tiredness: "#666B78",
  shame: "#75606B",
  neutral: "#7E776A",
};

export function moodColor(emotion: string | null | undefined): string {
  return MOOD_COLOR[(emotion ?? "neutral").toLowerCase()] ?? MOOD_COLOR.neutral;
}

export function moodDeep(emotion: string | null | undefined): string {
  return MOOD_DEEP[(emotion ?? "neutral").toLowerCase()] ?? MOOD_DEEP.neutral;
}

/** Soft tint (default ~16% alpha) for pill backgrounds. */
export function moodTint(emotion: string | null | undefined, alpha = 0.16): string {
  const hex = moodColor(emotion);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function moodLabel(emotion: string | null | undefined): string {
  if (!emotion) return "Neutral";
  return emotion.charAt(0).toUpperCase() + emotion.slice(1);
}
