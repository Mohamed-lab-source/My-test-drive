import { getState } from "../state/store.js";
import { escapeHtml } from "../utils/html.js";
import { navigateTo } from "../router.js";
import { openHabitDetail } from "./habitDetail.js";
import { openIdentityDetail } from "./identityDetail.js";
import { animateModalClose, enableModalKeyboard } from "../modal.js";
import { findHabitById } from "../domain/analytics.js";
import type { Habit, Identity, ScorecardEntry } from "../domain/types.js";

function getRoot(): HTMLElement {
  let root = document.getElementById("modal-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "modal-root";
    document.body.appendChild(root);
  }
  return root;
}

interface Results {
  habits: Habit[];
  identities: Identity[];
  scorecard: ScorecardEntry[];
}

function search(query: string): Results {
  const { habits, identities, scorecard } = getState();
  const q = query.trim().toLowerCase();
  if (!q) return { habits: [], identities: [], scorecard: [] };
  return {
    habits: habits.filter((h) => !h.archived && h.name.toLowerCase().includes(q)),
    identities: identities.filter((i) => !i.archived && i.statement.toLowerCase().includes(q)),
    scorecard: scorecard.filter((e) => e.activity.toLowerCase().includes(q)),
  };
}

function buildResultsHtml(query: string, results: Results): string {
  const total = results.habits.length + results.identities.length + results.scorecard.length;
  if (!query.trim()) return `<div class="empty-state"><p>Start typing to search habits, identities, and your scorecard.</p></div>`;
  if (total === 0) {
    return `<div class="empty-state"><div class="empty-illustration">🔍</div><p>No matches for "${escapeHtml(query.trim())}".</p></div>`;
  }

  const sections: string[] = [];
  if (results.habits.length > 0) {
    sections.push(`
      <div class="form-section-label">Habits</div>
      <div class="list-card">
        ${results.habits
          .map(
            (h) => `
          <button type="button" class="identity-linked-habit" data-open-habit="${h.id}">
            <span class="habit-icon">${escapeHtml(h.icon || "⭐")}</span>
            <span class="habit-name">${escapeHtml(h.name)}</span>
          </button>`
          )
          .join("")}
      </div>`);
  }
  if (results.identities.length > 0) {
    sections.push(`
      <div class="form-section-label">Identities</div>
      <div class="list-card">
        ${results.identities
          .map(
            (i) => `
          <button type="button" class="identity-linked-habit" data-open-identity="${i.id}">
            <span class="habit-icon">${escapeHtml(i.icon || "🧭")}</span>
            <span class="habit-name">I am ${escapeHtml(i.statement)}</span>
          </button>`
          )
          .join("")}
      </div>`);
  }
  if (results.scorecard.length > 0) {
    sections.push(`
      <div class="form-section-label">Scorecard</div>
      <div class="list-card">
        ${results.scorecard
          .map(
            (e) => `
          <button type="button" class="identity-linked-habit" data-open-scorecard="${e.id}">
            <span class="scorecard-badge">${e.rating}</span>
            <span class="habit-name">${escapeHtml(e.activity)}</span>
          </button>`
          )
          .join("")}
      </div>`);
  }
  return sections.join("");
}

export function openSearch(): void {
  const container = getRoot();
  let query = "";
  let disposeKeyboard: (() => void) | null = null;

  function close(): void {
    disposeKeyboard?.();
    disposeKeyboard = null;
    animateModalClose(container, () => {
      container.innerHTML = "";
      document.body.classList.remove("modal-open");
    });
  }

  function wireResults(): void {
    const resultsEl = container.querySelector<HTMLElement>("#search-results")!;
    resultsEl.querySelectorAll<HTMLButtonElement>("[data-open-habit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const habit = findHabitById(getState().habits, btn.dataset["openHabit"]!);
        if (habit) {
          close();
          openHabitDetail(habit);
        }
      });
    });
    resultsEl.querySelectorAll<HTMLButtonElement>("[data-open-identity]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const identity = getState().identities.find((i) => i.id === btn.dataset["openIdentity"]);
        if (identity) {
          close();
          openIdentityDetail(identity);
        }
      });
    });
    resultsEl.querySelectorAll<HTMLButtonElement>("[data-open-scorecard]").forEach((btn) => {
      btn.addEventListener("click", () => {
        close();
        navigateTo("scorecard");
      });
    });
  }

  function renderResults(): void {
    const resultsEl = container.querySelector<HTMLElement>("#search-results")!;
    resultsEl.innerHTML = buildResultsHtml(query, search(query));
    wireResults();
  }

  container.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-sheet" role="dialog" aria-modal="true">
      <div class="modal-sheet-handle"></div>
      <div class="wizard-header">
        <button type="button" class="icon-btn" id="search-close" aria-label="Close">&times;</button>
        <span class="wizard-header-title">Search</span>
        <span></span>
      </div>
      <div class="wizard-body">
        <div class="search-bar">
          <span class="search-icon">🔍</span>
          <input type="text" id="global-search-input" class="search-input" placeholder="Search habits, identities, scorecard" />
        </div>
        <div id="search-results"></div>
      </div>
    </div>
  `;

  container.querySelector("#search-close")!.addEventListener("click", close);
  container.querySelector(".modal-backdrop")!.addEventListener("click", close);

  const input = container.querySelector<HTMLInputElement>("#global-search-input")!;
  input.addEventListener("input", () => {
    query = input.value;
    renderResults();
  });

  renderResults();
  document.body.classList.add("modal-open");
  disposeKeyboard = enableModalKeyboard(container, close);
  requestAnimationFrame(() => input.focus());
}
