import { getState, saveHabit, updateIdentity } from "../state/store.js";
import { escapeHtml } from "../utils/html.js";
import { hapticSuccess } from "../confetti.js";
import { showToast } from "../toast.js";
import { animateModalClose, enableModalKeyboard } from "../modal.js";
import { findHabitById } from "../domain/analytics.js";
function getRoot() {
    let root = document.getElementById("modal-root");
    if (!root) {
        root = document.createElement("div");
        root.id = "modal-root";
        document.body.appendChild(root);
    }
    return root;
}
export function openArchived() {
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
    function render() {
        const { habits, identities } = getState();
        const archivedHabits = habits.filter((h) => h.archived);
        const archivedIdentities = identities.filter((i) => i.archived);
        container.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-sheet" role="dialog" aria-modal="true">
        <div class="modal-sheet-handle"></div>
        <div class="wizard-header">
          <button type="button" class="icon-btn" id="archived-close" aria-label="Close">&times;</button>
          <span class="wizard-header-title">Archived</span>
          <span></span>
        </div>
        <div class="wizard-body">
          <div class="card">
            <h2 class="card-title">Habits (${archivedHabits.length})</h2>
            ${archivedHabits.length === 0
            ? `<div class="empty-state">No archived habits.</div>`
            : `<div class="list-card">
                    ${archivedHabits
                .map((h) => `
                      <div class="archived-row">
                        <span class="habit-icon">${escapeHtml(h.icon || "⭐")}</span>
                        <span class="archived-row-name">${escapeHtml(h.name)}</span>
                        <button type="button" class="btn btn-plain" data-restore-habit="${h.id}">Restore</button>
                      </div>`)
                .join("")}
                  </div>`}
          </div>

          <div class="card">
            <h2 class="card-title">Identities (${archivedIdentities.length})</h2>
            ${archivedIdentities.length === 0
            ? `<div class="empty-state">No archived identities.</div>`
            : `<div class="list-card">
                    ${archivedIdentities
                .map((i) => `
                      <div class="archived-row">
                        <span class="archived-row-name">I am ${escapeHtml(i.statement)}</span>
                        <button type="button" class="btn btn-plain" data-restore-identity="${i.id}">Restore</button>
                      </div>`)
                .join("")}
                  </div>`}
          </div>
        </div>
      </div>
    `;
        container.querySelector("#archived-close").addEventListener("click", close);
        container.querySelector(".modal-backdrop").addEventListener("click", close);
        container.querySelectorAll("[data-restore-habit]").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const habit = findHabitById(habits, btn.dataset["restoreHabit"]);
                if (!habit)
                    return;
                await saveHabit({ ...habit, archived: false });
                hapticSuccess();
                showToast("↩️", `"${habit.name}" restored.`);
                render();
            });
        });
        container.querySelectorAll("[data-restore-identity]").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const identity = identities.find((i) => i.id === btn.dataset["restoreIdentity"]);
                if (!identity)
                    return;
                await updateIdentity({ ...identity, archived: false });
                hapticSuccess();
                showToast("↩️", "Identity restored.");
                render();
            });
        });
        disposeKeyboard?.();
        disposeKeyboard = enableModalKeyboard(container, close);
    }
    document.body.classList.add("modal-open");
    render();
}
//# sourceMappingURL=archived.js.map