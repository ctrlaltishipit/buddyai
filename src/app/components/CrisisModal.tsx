/**
 * Global crisis modal. Opened by Journal/Reflector right after a positive
 * /crisis-check — BEFORE any analysis or reflection is shown. Renders on top
 * of both dark and light surfaces with its own palette.
 */
import { useEffect } from "react";
import { Phone, MessageSquareText, ExternalLink, X } from "lucide-react";
import { useStore } from "../lib/store";
import { BuddyBlob } from "./BuddyBlob";

export function CrisisModal() {
  const { state, closeCrisis } = useStore();
  const { open, resources } = state.crisis;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCrisis();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, closeCrisis]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center p-4"
      style={{ background: "rgba(10,9,8,.72)", backdropFilter: "blur(10px)" }}
      onClick={closeCrisis}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="crisis-title"
        className="anim-fade-up w-full max-w-[520px] rounded-[26px] p-7 sm:p-8"
        style={{ background: "#FFFFFF", color: "#141210", boxShadow: "0 30px 80px rgba(0,0,0,.45)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <BuddyBlob size={52} colors={["#D58E8E", "#B85C5C", "#FF7A1A"]} follow={false} />
            <div>
              <p className="eyebrow" style={{ color: "#B85C5C", letterSpacing: ".2em" }}>You matter</p>
              <h2 id="crisis-title" className="h-display" style={{ fontSize: 24, marginTop: 4 }}>
                Let's get you to someone who can help right now.
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={closeCrisis}
            aria-label="Close"
            className="shrink-0 grid place-items-center rounded-full"
            style={{ width: 36, height: 36, border: "1px solid #ECE6DC", background: "#fff", color: "#6B645A", cursor: "pointer" }}
          >
            <X size={16} />
          </button>
        </div>

        <p className="mt-4 text-[15px] leading-relaxed" style={{ color: "#3D3730" }}>
          What you wrote sounds really hard. buddy isn't a therapist or an emergency service, but these people are
          trained for exactly this moment, and they'll pick up.
        </p>

        <ul className="mt-5 flex flex-col gap-2.5 list-none p-0 m-0">
          {resources.map((r) => (
            <li
              key={r.label}
              className="rounded-[16px] p-4"
              style={{ background: "#FAF7F1", border: "1px solid #ECE6DC" }}
            >
              <div className="font-semibold text-[15px]">{r.label}</div>
              {r.note && (
                <div className="text-[12.5px] mt-0.5" style={{ color: "#6B645A" }}>
                  {r.note}
                </div>
              )}
              <div className="mt-2.5 flex flex-wrap gap-2">
                {r.phone && (
                  <a
                    href={`tel:${r.phone.replace(/\s+/g, "")}`}
                    className="btn btn-acc"
                    style={{ padding: "9px 16px", fontSize: 13.5, minHeight: 38, background: "#B85C5C", boxShadow: "0 6px 18px rgba(184,92,92,.3)" }}
                  >
                    <Phone size={15} /> Call {r.phone}
                  </a>
                )}
                {r.text_line && (
                  <span className="btn btn-soft" style={{ cursor: "default" }}>
                    <MessageSquareText size={15} /> {r.text_line}
                  </span>
                )}
                {r.url && (
                  <a href={r.url} target="_blank" rel="noreferrer" className="btn btn-soft">
                    <ExternalLink size={15} /> Open site
                  </a>
                )}
              </div>
            </li>
          ))}
          {resources.length === 0 && (
            <li className="rounded-[16px] p-4" style={{ background: "#FAF7F1", border: "1px solid #ECE6DC" }}>
              <div className="font-semibold text-[15px]">Find a helpline near you</div>
              <a href="https://findahelpline.com" target="_blank" rel="noreferrer" className="btn btn-soft mt-2.5">
                <ExternalLink size={15} /> findahelpline.com
              </a>
            </li>
          )}
        </ul>

        <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
          <p className="m-0 text-[12.5px]" style={{ color: "#A39C90" }}>
            This message wasn't analyzed or saved.
          </p>
          <button type="button" onClick={closeCrisis} className="btn btn-soft">
            I'm safe for now, close this
          </button>
        </div>
      </div>
    </div>
  );
}

export default CrisisModal;
