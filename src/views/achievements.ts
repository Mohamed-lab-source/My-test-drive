import { getState } from "../state/store.js";
import { escapeHtml } from "../utils/html.js";
import { computeBadges } from "../domain/achievements.js";
import { animateModalClose, enableModalKeyboard } from "../modal.js";

function getRoot(): HTMLElement {
  let root = document.getElementById("modal-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "modal-root";
    document.body.appendChild(root);
  }
  return root;
}

export function openAchievements(): void {
  const container = getRoot();
  let disposeKeyboard: (() => void) | null = null;

  function close(): void {
    disposeKeyboard?.();
    disposeKeyboard = null;
    animateModalClose(container, () => {
      container.innerHTML = "";
      document.body.classList.remove("modal-open");
    });
  }

  const { habits, checkins } = getState();
  const badges = computeBadges(habits, checkins);
  const earnedCount = badges.filter((b) => b.earned).length;

  container.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-sheet" role="dialog" aria-modal="true">
      <div class="modal-sheet-handle"></div>
      <div class="wizard-header">
        <button type="button" class="icon-btn" id="achievements-close" aria-label="Close">&times;</button>
        <span class="wizard-header-title">Achievements</span>
        <span></span>
      </div>
      <div class="wizard-body">
        <p class="wizard-subtitle achievements-tally">${earnedCount} of ${badges.length} earned</p>
        <div class="badge-grid">
          ${badges
            .map(
              (b) => `
            <div class="badge-tile ${b.earned ? "earned" : "locked"}" title="${escapeHtml(b.description)}">
              <div class="badge-icon">${b.earned ? b.icon : "🔒"}</div>
              <div class="badge-label">${escapeHtml(b.label)}</div>
              ${
                !b.earned
                  ? `<div class="badge-progress-track" role="progressbar" aria-label="${escapeHtml(b.label)} progress" aria-valuenow="${Math.round(b.progress * 100)}" aria-valuemin="0" aria-valuemax="100"><div class="badge-progress-fill" style="width:${Math.round(b.progress * 100)}%"></div></div>`
                  : `<div class="badge-earned-tag">Earned</div>`
              }
            </div>`
            )
            .join("")}
        </div>
      </div>
    </div>
  `;

  container.querySelector("#achievements-close")!.addEventListener("click", close);
  container.querySelector(".modal-backdrop")!.addEventListener("click", close);

  document.body.classList.add("modal-open");
  disposeKeyboard = enableModalKeyboard(container, close);
}
