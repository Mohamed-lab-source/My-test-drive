import { getState, archiveIdentity, updateIdentity } from "../state/store.js";
import { escapeHtml } from "../utils/html.js";
import { lastNDates } from "../utils/date.js";
import { dailyConsistency, identityVoteCount } from "../domain/analytics.js";
import { heatmapSVG } from "../charts/svg.js";
import { hapticSuccess } from "../confetti.js";
import { openHabitDetail } from "./habitDetail.js";
import { openHabitWizard } from "./habitWizard.js";
function getRoot() {
    let root = document.getElementById("modal-root");
    if (!root) {
        root = document.createElement("div");
        root.id = "modal-root";
        document.body.appendChild(root);
    }
    return root;
}
export function openIdentityDetail(identity) {
    const container = getRoot();
    let editing = false;
    function close() {
        container.innerHTML = "";
        document.body.classList.remove("modal-open");
    }
    function render() {
        const { identities, habits, checkins } = getState();
        const current = identities.find((i) => i.id === identity.id) ?? identity;
        const linkedHabits = habits.filter((h) => h.identityId === current.id && !h.archived);
        const totalVotes = identityVoteCount(current.id, habits, checkins);
        const votes30 = identityVoteCount(current.id, habits, checkins, lastNDates(30));
        const cells = dailyConsistency(linkedHabits, checkins, lastNDates(84));
        container.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-sheet" role="dialog" aria-modal="true">
        <div class="modal-sheet-handle"></div>
        <div class="wizard-header">
          <button type="button" class="icon-btn" id="detail-close" aria-label="Close">&times;</button>
          <span></span>
          <span></span>
        </div>
        <div class="wizard-body">
          <div class="detail-hero">
            <div class="detail-hero-icon">🧭</div>
            ${editing
            ? `<div class="form-card-row prefix-row" style="justify-content:center;">
                    <span class="row-label">I am</span>
                    <input type="text" id="identity-edit-input" class="plain-input" maxlength="80" value="${escapeHtml(current.statement)}" />
                  </div>
                  <textarea id="identity-why-input" class="backup-textarea identity-why-input" rows="2" maxlength="400" placeholder="Why does this matter to you? (optional)">${escapeHtml(current.why)}</textarea>`
            : `<div class="detail-hero-name">I am ${escapeHtml(current.statement)}</div>`}
          </div>

          ${!editing && current.why.trim()
            ? `<div class="card">
                  <h2 class="card-title">Why this matters</h2>
                  <p class="identity-why-text">${escapeHtml(current.why)}</p>
                </div>`
            : ""}

          <div class="stat-tile-row detail-stats">
            ${[
            { label: "Votes cast", value: String(totalVotes), sub: "all time" },
            { label: "Last 30 days", value: String(votes30) },
            { label: "Habits linked", value: String(linkedHabits.length) },
        ]
            .map((s) => `
              <div class="stat-tile">
                <div class="stat-tile-label">${escapeHtml(s.label)}</div>
                <div class="stat-tile-value detail-stat-value">${escapeHtml(s.value)}</div>
                ${s.sub ? `<div class="stat-tile-sublabel">${escapeHtml(s.sub)}</div>` : ""}
              </div>`)
            .join("")}
          </div>

          <div class="card">
            <h2 class="card-title">Vote history — last 12 weeks</h2>
            ${cells.length === 0 || linkedHabits.length === 0
            ? `<div class="empty-state">No linked habits yet.</div>`
            : `<div class="heatmap-wrap">${heatmapSVG(cells)}</div>`}
          </div>

          <div class="card">
            <h2 class="card-title">Linked habits</h2>
            ${linkedHabits.length === 0
            ? `<div class="empty-state">
                    <p>No habits vote for this identity yet.</p>
                  </div>`
            : `<div class="list-card">
                    ${linkedHabits
                .map((h) => `
                      <button type="button" class="identity-linked-habit" data-open-habit="${h.id}">
                        <span class="habit-icon">${escapeHtml(h.icon || "⭐")}</span>
                        <span class="habit-name">${escapeHtml(h.name)}</span>
                      </button>`)
                .join("")}
                  </div>`}
            <button type="button" class="btn btn-outline btn-block identity-add-habit-btn" id="identity-add-habit">+ Add a habit for this identity</button>
          </div>

          <div class="wizard-nav">
            <button type="button" class="btn btn-plain btn-danger" id="identity-archive">Archive identity</button>
            ${editing
            ? `<button type="button" class="btn btn-primary" id="identity-save">Save</button>`
            : `<button type="button" class="btn btn-primary" id="identity-edit">Edit</button>`}
          </div>
        </div>
      </div>
    `;
        container.querySelector("#detail-close").addEventListener("click", close);
        container.querySelector(".modal-backdrop").addEventListener("click", close);
        container.querySelectorAll("[data-open-habit]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const habit = habits.find((h) => h.id === btn.dataset["openHabit"]);
                if (habit)
                    openHabitDetail(habit);
            });
        });
        container.querySelector("#identity-add-habit").addEventListener("click", () => {
            close();
            openHabitWizard({ identityId: current.id });
        });
        container.querySelector("#identity-archive").addEventListener("click", () => {
            archiveIdentity(current.id);
            close();
        });
        if (editing) {
            const input = container.querySelector("#identity-edit-input");
            requestAnimationFrame(() => {
                input.focus();
                input.select();
            });
            const whyInput = container.querySelector("#identity-why-input");
            container.querySelector("#identity-save").addEventListener("click", async () => {
                const value = input.value.trim();
                if (!value)
                    return;
                await updateIdentity({ ...current, statement: value, why: whyInput.value.trim() });
                hapticSuccess();
                editing = false;
                render();
            });
        }
        else {
            container.querySelector("#identity-edit").addEventListener("click", () => {
                editing = true;
                render();
            });
        }
    }
    document.body.classList.add("modal-open");
    render();
}
//# sourceMappingURL=identityDetail.js.map