/**
 * Scroll-reveal via IntersectionObserver.
 *
 * Elements marked `data-reveal` start hidden and get `data-reveal="in"` once
 * they cross into view, which the CSS transitions on. Revealing is one-way:
 * scrolling back up does not re-hide, which reads as jumpy.
 *
 * Anyone who prefers reduced motion gets everything revealed immediately.
 */
import { useEffect } from "react";

export function useReveal(): void {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!nodes.length) return;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced || typeof IntersectionObserver === "undefined") {
      nodes.forEach((n) => n.setAttribute("data-reveal", "in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          (e.target as HTMLElement).setAttribute("data-reveal", "in");
          io.unobserve(e.target);
        });
      },
      // Fire a little before the element is fully on screen so the motion
      // finishes as it settles, rather than starting late.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );

    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);
}

export default useReveal;
