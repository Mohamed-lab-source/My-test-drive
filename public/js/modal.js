// Every modal sheet in this app animates open (see .modal-sheet's own CSS
// animation) but was clearing its container synchronously on close, so the
// sheet just vanished instead of sliding away. This plays the reverse
// animation first, then hands back control to actually clear the DOM.
const CLOSE_DURATION_MS = 220;
const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
/**
 * Escape closes the modal; Tab/Shift+Tab cycles focus within it instead of
 * escaping to whatever's underneath. Call once after each render() (a
 * wizard step, a settings toggle) so newly rendered focusable elements are
 * picked up, and dispose the previous listener first — these modals
 * re-render often and listeners must not stack.
 */
export function enableModalKeyboard(container, close) {
    function handleKeydown(e) {
        if (e.key === "Escape") {
            e.preventDefault();
            close();
            return;
        }
        if (e.key !== "Tab")
            return;
        const focusable = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => el.offsetParent !== null);
        if (focusable.length === 0)
            return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        }
        else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
}
export function animateModalClose(container, onDone) {
    const backdrop = container.querySelector(".modal-backdrop");
    const sheet = container.querySelector(".modal-sheet");
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
//# sourceMappingURL=modal.js.map