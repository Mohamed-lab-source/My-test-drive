import { archiveHabit, saveHabit } from "../state/store.js";
import { escapeHtml } from "../utils/html.js";
import { hapticTap } from "../confetti.js";
let root = null;
let dismissTimer = null;
function getRoot() {
    if (!root) {
        root = document.createElement("div");
        root.id = "snackbar-root";
        document.body.appendChild(root);
    }
    return root;
}
function clearExisting() {
    if (dismissTimer) {
        clearTimeout(dismissTimer);
        dismissTimer = null;
    }
    getRoot().innerHTML = "";
}
/** Archives a habit immediately, offering a few seconds to undo (restore it). */
export function undoableArchive(habit) {
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
    function dismiss() {
        bar.classList.remove("snackbar-in");
        bar.classList.add("snackbar-out");
        setTimeout(() => bar.remove(), 250);
    }
    bar.querySelector(".snackbar-action").addEventListener("click", () => {
        hapticTap();
        saveHabit({ ...habit, archived: false });
        if (dismissTimer)
            clearTimeout(dismissTimer);
        dismiss();
    });
    dismissTimer = setTimeout(dismiss, 5000);
}
//# sourceMappingURL=undoArchive.js.map