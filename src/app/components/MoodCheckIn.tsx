/**
 * MoodCheckIn — name how you feel without writing anything.
 *
 * The emotion map is only as good as the days it has data for, and the days
 * you least want to write are often the ones worth recording. This saves a
 * `mood` entry: confirmed emotions, no prose required, so it lands on the map
 * exactly like a written entry does.
 *
 * Emotions are marked confirmed + source "user": the person picked them
 * themselves, so nothing here is a guess by the model.
 */
import { useState } from "react";
import { Check } from "lucide-react";
import { entriesApi, errorMessage } from "../lib/api";
import { moodColor, moodDeep, moodTint } from "../lib/mood-colors";
import { useStore } from "../lib/store";

/** Kept short on purpose. A long list is a decision, and this should be a reflex. */
const QUICK: string[] = [
  "joy",
  "gratitude",
  "hope",
  "tiredness",
  "anxiety",
  "sadness",
  "frustration",
  "neutral",
];

const LABEL: Record<string, string> = {
  joy: "Good",
  gratitude: "Grateful",
  hope: "Hopeful",
  tiredness: "Tired",
  anxiety: "Anxious",
  sadness: "Low",
  frustration: "Frustrated",
  neutral: "Fine",
};

export function MoodCheckIn() {
  const { bumpEntries, showToast } = useStore();
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  function toggle(e: string) {
    setPicked((p) => (p.includes(e) ? p.filter((x) => x !== e) : p.length >= 3 ? p : [...p, e]));
  }

  async function save() {
    if (!picked.length || saving) return;
    setSaving(true);
    try {
      await entriesApi.create({
        // The text is the record of what was picked, so the entry reads sensibly
        // in the journal list without pretending to be something it is not.
        text: picked.map((e) => LABEL[e] ?? e).join(", "),
        template: "mood",
        emotions: picked.map((e) => ({ emotion: e, score: 0.7, confirmed: true, source: "user" })),
      });
      setDone(true);
      bumpEntries();
      showToast("Added to your map.");
    } catch (err) {
      showToast(errorMessage(err, "Couldn't save that. Try again."));
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="card-light" style={{ padding: 20 }} role="status">
        <div className="flex items-center gap-2.5">
          <span
            className="grid place-items-center rounded-full"
            style={{ width: 26, height: 26, background: "var(--color-acc)", color: "#fff", flex: "none" }}
          >
            <Check size={15} strokeWidth={3} aria-hidden="true" />
          </span>
          <div>
            <div className="font-display text-[15.5px] font-semibold">On the map.</div>
            <div className="text-[13.5px] text-app-sub">
              That is today recorded. Write more any time you want to.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-light" style={{ padding: 20 }}>
      <div className="font-display text-[15.5px] font-semibold" style={{ marginBottom: 2 }}>
        How are you, right now?
      </div>
      <div className="text-[13.5px] leading-[1.5] text-app-sub" style={{ marginBottom: 14 }}>
        Pick up to three. No writing needed, it still counts on your map.
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="How are you right now">
        {QUICK.map((e) => {
          const on = picked.includes(e);
          return (
            <button
              key={e}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(e)}
              className="min-h-[38px]"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 14px",
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                color: on ? moodDeep(e) : "var(--color-app-ink)",
                background: on ? moodTint(e, 0.22) : "transparent",
                border: `1px solid ${on ? moodColor(e) : "var(--color-app-line)"}`,
                transition: "background .15s ease, border-color .15s ease",
              }}
            >
              <span
                aria-hidden="true"
                style={{ width: 8, height: 8, borderRadius: 999, background: moodColor(e), flex: "none" }}
              />
              {LABEL[e] ?? e}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="btn btn-acc"
        style={{ marginTop: 16 }}
        disabled={!picked.length || saving}
        onClick={() => void save()}
      >
        {saving ? (
          <>
            <span className="spinner" aria-hidden="true" /> Saving…
          </>
        ) : (
          "Add to my map"
        )}
      </button>
    </div>
  );
}

export default MoodCheckIn;
