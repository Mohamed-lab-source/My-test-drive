import { archiveHabit, saveHabit } from "../state/store.js";
import { escapeHtml } from "../utils/html.js";
import { hapticTap } from "../confetti.js";
import type { Habit } from "../domain/types.js";

let root: HTMLElement | null = null;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;

function getRoot(): HTMLElement {
  if (!root) {
    root = document.createElement("div");
    root.id = "snackbar-root";
    document.body.appendChild(root);
  }
  return root;
}

function clearExisting(): void {
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
  getRoot().innerHTML = "";
}

/** Archives a habit immediately, offering a few seconds to undo (restore it). */
export function undoableArchive(habit: Habit): void {
  archiveHabit(habit.id);
  clearExisting();

  const container = getRoot();
  const bar = document.createElement("div");
  bar.className = "snackbar";
  bar.innerHTML = `
    <span class="snackbar-message">Archived "${escapeHtml(habit.name)}"</span>
    <button type="button" class="snackbar-action">Undo</button>
  `;
  container.appendChild(bar);
  requestAnimationFrame(() => bar.classList.add("snackbar-in"));

  function dismiss(): void {
    bar.classList.remove("snackbar-in");
    bar.classList.add("snackbar-out");
    setTimeout(() => bar.remove(), 250);
  }

  bar.querySelector(".snackbar-action")!.addEventListener("click", () => {
    hapticTap();
    saveHabit({ ...habit, archived: false });
    if (dismissTimer) clearTimeout(dismissTimer);
    dismiss();
  });

  dismissTimer = setTimeout(dismiss, 5000);
}
