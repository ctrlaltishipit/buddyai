/**
 * Scroll choreography for the marketing pages.
 *
 * Two layers, both opt-in per element:
 *
 *   [data-reveal]  one-way entrance. The element lifts, settles and stays.
 *                  Revealing is one-way on purpose: re-hiding on scroll-up
 *                  reads as jumpy and makes a page feel unstable.
 *
 *   [data-parallax] continuous. Sets --p, from -1 when the element sits below
 *                   the fold to 1 when it has passed above, so CSS can drift a
 *                   phone or a glow at a different rate to the page. This is
 *                   what makes each section feel like its own card rather than
 *                   a strip of a long document.
 *
 * Anyone who prefers reduced motion gets everything revealed and nothing moving.
 */
import { useEffect } from "react";

export function useReveal(): void {
  useEffect(() => {
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const revealNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const parallaxNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));

    if (reduced) {
      revealNodes.forEach((n) => n.setAttribute("data-reveal", "in"));
      return;
    }

    // ---- entrance ----
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined" && revealNodes.length) {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (!e.isIntersecting) return;
            (e.target as HTMLElement).setAttribute("data-reveal", "in");
            io?.unobserve(e.target);
          });
        },
        { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
      );
      revealNodes.forEach((n) => io!.observe(n));
    } else {
      revealNodes.forEach((n) => n.setAttribute("data-reveal", "in"));
    }

    // ---- continuous drift ----
    if (!parallaxNodes.length) return () => io?.disconnect();

    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight || 1;
      for (const el of parallaxNodes) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) continue; // far off screen, skip the work
        const centre = r.top + r.height / 2;
        // 0 when the element is centred, negative below the fold, positive above.
        const p = Math.max(-1, Math.min(1, (vh / 2 - centre) / (vh / 2 + r.height / 2)));
        el.style.setProperty("--p", p.toFixed(4));
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      io?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
}

export default useReveal;
