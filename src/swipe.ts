// Reusable swipe-to-reveal for list rows: wrap a row's content in
// `.swipe-content` inside a `.swipe-row` that also holds `.swipe-actions`,
// then call enableSwipeToReveal(container) once after rendering.
// <div class="swipe-row">
//   <div class="swipe-actions">...</div>
//   <div class="swipe-content">...</div>
// </div>

const DEFAULT_REVEAL_WIDTH = 84;
const OPEN_RATIO = 0.4;

let openRow: HTMLElement | null = null;
let globalListenerInstalled = false;

function installGlobalCloseListener(): void {
  if (globalListenerInstalled) return;
  globalListenerInstalled = true;
  document.addEventListener("pointerdown", (e) => {
    if (!openRow) return;
    if (e.target instanceof Node && openRow.contains(e.target)) return;
    closeRow(openRow);
  });
}

function closeRow(row: HTMLElement | null): void {
  if (!row) return;
  const content = row.querySelector<HTMLElement>(".swipe-content");
  if (content) content.style.transform = "translateX(0px)";
  row.classList.remove("swipe-open");
  if (openRow === row) openRow = null;
}

export function closeAnyOpenSwipe(): void {
  closeRow(openRow);
}

export function enableSwipeToReveal(container: HTMLElement): void {
  installGlobalCloseListener();
  container.querySelectorAll<HTMLElement>(".swipe-row").forEach((row) => {
    const content = row.querySelector<HTMLElement>(".swipe-content");
    if (!content) return;
    // Measured per-row so a row with two actions (e.g. Skip + Archive)
    // reveals further than a row with just one.
    const actions = row.querySelector<HTMLElement>(".swipe-actions");
    const revealWidth = actions?.offsetWidth || DEFAULT_REVEAL_WIDTH;
    const openThreshold = revealWidth * OPEN_RATIO;

    let startX = 0;
    let startY = 0;
    let dragging = false;
    let decided = false;
    let horizontal = false;

    content.addEventListener("pointerdown", (e) => {
      if (openRow && openRow !== row) closeRow(openRow);
      startX = e.clientX;
      startY = e.clientY;
      dragging = true;
      decided = false;
      horizontal = false;
      content.style.transition = "none";
    });

    content.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!decided) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        decided = true;
        horizontal = Math.abs(dx) > Math.abs(dy);
        if (horizontal) content.setPointerCapture(e.pointerId);
      }
      if (!horizontal) return;

      e.preventDefault();
      const base = row.classList.contains("swipe-open") ? -revealWidth : 0;
      const next = Math.min(0, Math.max(-revealWidth, base + dx));
      content.style.transform = `translateX(${next}px)`;
    });

    const end = (): void => {
      if (!dragging) return;
      dragging = false;
      content.style.transition = "";
      if (!horizontal) return;

      const current = new DOMMatrixReadOnly(getComputedStyle(content).transform).m41;
      if (current <= -openThreshold) {
        content.style.transform = `translateX(${-revealWidth}px)`;
        row.classList.add("swipe-open");
        openRow = row;
      } else {
        closeRow(row);
      }

      // A real drag shouldn't also register as a tap on whatever's underneath.
      const suppressGhostClick = (ev: Event) => {
        ev.stopPropagation();
        ev.preventDefault();
        content.removeEventListener("click", suppressGhostClick, true);
      };
      content.addEventListener("click", suppressGhostClick, true);
    };

    content.addEventListener("pointerup", end);
    content.addEventListener("pointercancel", end);
  });
}
