// Every modal sheet in this app animates open (see .modal-sheet's own CSS
// animation) but was clearing its container synchronously on close, so the
// sheet just vanished instead of sliding away. This plays the reverse
// animation first, then hands back control to actually clear the DOM.

const CLOSE_DURATION_MS = 220;

export function animateModalClose(container: HTMLElement, onDone: () => void): void {
  const backdrop = container.querySelector<HTMLElement>(".modal-backdrop");
  const sheet = container.querySelector<HTMLElement>(".modal-sheet");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!backdrop || !sheet || reducedMotion) {
    onDone();
    return;
  }

  backdrop.classList.add("modal-closing");
  sheet.classList.add("modal-closing");
  setTimeout(() => {
    // A caller can close() and immediately open a different modal in the
    // same #modal-root (edit/duplicate flows do exactly this). That new
    // modal's own markup detaches these nodes right away. If that happened,
    // this stale timeout must NOT run onDone() — onDone() clears the whole
    // container, which would wipe out the new modal 220ms after it opened.
    if (backdrop.isConnected && sheet.isConnected) {
      onDone();
    }
  }, CLOSE_DURATION_MS);
}
