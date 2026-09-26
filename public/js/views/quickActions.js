import { animateModalClose, enableModalKeyboard } from "../modal.js";
import { escapeHtml } from "../utils/html.js";
function getRoot() {
    let root = document.getElementById("modal-root");
    if (!root) {
        root = document.createElement("div");
        root.id = "modal-root";
        document.body.appendChild(root);
    }
    return root;
}
/** A compact bottom action sheet for a long-pressed card — title plus a list of actions and a Cancel row. */
export function openQuickActions(title, actions) {
    const container = getRoot();
    let disposeKeyboard = null;
    function close() {
        disposeKeyboard?.();
        disposeKeyboard = null;
        animateModalClose(container, () => {
            container.innerHTML = "";
            document.body.classList.remove("modal-open");
        });
    }
    container.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-sheet quick-actions-sheet" role="dialog" aria-modal="true">
      <div class="modal-sheet-handle"></div>
      <div class="quick-actions-title">${escapeHtml(title)}</div>
      <div class="quick-actions-list">
        ${actions
        .map((a, i) => `<button type="button" class="quick-action-btn ${a.danger ? "quick-action-danger" : ""}" data-action-index="${i}">${escapeHtml(a.label)}</button>`)
        .join("")}
      </div>
      <button type="button" class="btn btn-plain btn-block quick-actions-cancel" id="quick-actions-cancel">Cancel</button>
    </div>
  `;
    container.querySelector(".modal-backdrop").addEventListener("click", close);
    container.querySelector("#quick-actions-cancel").addEventListener("click", close);
    container.querySelectorAll("[data-action-index]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const action = actions[Number(btn.dataset["actionIndex"])];
            close();
            // Run after close() so an action that opens another modal in the same
            // #modal-root (e.g. the edit wizard) isn't wiped by close()'s own
            // deferred DOM clear.
            action?.onSelect();
        });
    });
    document.body.classList.add("modal-open");
    disposeKeyboard = enableModalKeyboard(container, close);
}
//# sourceMappingURL=quickActions.js.map