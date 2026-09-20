// A tiny reusable scroll-reveal: elements marked .scroll-reveal fade/slide in
// the first time they intersect the viewport, then stop being observed.
// IntersectionObserver reports current intersection state immediately upon
// observe(), so above-the-fold elements reveal right away too — there's no
// need to special-case initial layout vs. actual scrolling.

let observer: IntersectionObserver | null = null;

function getObserver(): IntersectionObserver {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer!.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 }
    );
  }
  return observer;
}

/** Call once after rendering a view's DOM. */
export function initScrollReveal(container: HTMLElement): void {
  const els = container.querySelectorAll<HTMLElement>(".scroll-reveal");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion || !("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("revealed"));
    return;
  }
  els.forEach((el) => getObserver().observe(el));
}
