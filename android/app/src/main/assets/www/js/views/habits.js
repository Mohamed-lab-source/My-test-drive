import { getState } from "../state/store.js";
import { escapeHtml } from "../utils/html.js";
import { WEEKDAY_LABELS } from "../utils/date.js";
import { openHabitWizard } from "./habitWizard.js";
import { openHabitDetail } from "./habitDetail.js";
import { enableSwipeToReveal } from "../swipe.js";
import { undoableArchive } from "./undoArchive.js";
// Persists across re-renders since renderHabits() rebuilds the DOM from
// scratch on every store change; a plain module variable is the simplest way
// to keep the query alive without losing the input's focus mid-render.
let searchQuery = "";
function stackDescription(habit, allHabits) {
    const anchor = habit.stackAnchor;
    if (anchor.type === "custom") {
        return anchor.text ? `After ${anchor.text}` : null;
    }
    if (anchor.type === "habit") {
        const anchorHabit = allHabits.find((h) => h.id === anchor.habitId);
        return anchorHabit ? `After "${anchorHabit.name}"` : null;
    }
    return null;
}
function frequencyLabel(f) {
    if (f.type === "daily")
        return "Every day";
    if (f.days.length === 0)
        return "No days selected";
    return f.days.map((d) => WEEKDAY_LABELS[d]).join(", ");
}
function renderChainTree(habit, visibleHabits, identityLabel, depth, index, seen) {
    seen.add(habit.id);
    // Excluding already-seen ids protects against a stacking cycle (A after B,
    // B after A) turning this recursion into infinite regress — each habit
    // renders exactly once, wherever it's first reached.
    const children = visibleHabits.filter((h) => h.stackAnchor.type === "habit" && h.stackAnchor.habitId === habit.id && !seen.has(h.id));
    const desc = stackDescription(habit, visibleHabits);
    return `
    <div class="habit-node" style="margin-left: ${depth * 22}px">
      <div class="swipe-row stagger-in" style="--stagger-index: ${index}">
        <div class="swipe-actions">
          <button class="swipe-action swipe-action-archive" data-archive-habit="${habit.id}">Archive</button>
        </div>
        <div class="swipe-content">
          <div class="habit-card" data-open-detail="${habit.id}">
            <div class="habit-card-head">
              <span class="habit-icon">${escapeHtml(habit.icon || "⭐")}</span>
              <span class="habit-name">${depth > 0 ? "↳ " : ""}${escapeHtml(habit.name)}</span>
              <span class="pill pill-identity">${escapeHtml(identityLabel(habit.identityId))}</span>
            </div>
            ${desc ? `<div class="habit-stack-desc muted">${escapeHtml(desc)}</div>` : ""}
            <div class="habit-four-laws">
              <div><span class="law-tag">Obvious</span> ${escapeHtml(habit.cue) || "—"}</div>
              <div><span class="law-tag">Attractive</span> ${escapeHtml(habit.craving) || "—"}</div>
              <div><span class="law-tag">Easy</span> ${escapeHtml(habit.response) || "—"}</div>
              <div><span class="law-tag">Satisfying</span> ${escapeHtml(habit.reward) || "—"}</div>
            </div>
            <div class="habit-card-foot">
              <span class="muted">${frequencyLabel(habit.frequency)}</span>
              ${habit.twoMinuteVersion ? `<span class="pill pill-two-min">2-min: ${escapeHtml(habit.twoMinuteVersion)}</span>` : ""}
              <div class="identity-actions">
                <button class="btn btn-plain" data-edit="${habit.id}">Edit</button>
                <button class="btn btn-plain btn-danger" data-archive-habit="${habit.id}">Archive</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      ${children.map((c, i) => renderChainTree(c, visibleHabits, identityLabel, depth + 1, index + i + 1, seen)).join("")}
    </div>
  `;
}
function buildListHtml(activeHabits, identityLabel) {
    const query = searchQuery.trim().toLowerCase();
    const visible = query ? activeHabits.filter((h) => h.name.toLowerCase().includes(query)) : activeHabits;
    if (visible.length === 0 && query) {
        return `<div class="empty-state">
      <div class="empty-illustration">🔍</div>
      <p>No habits match "${escapeHtml(searchQuery.trim())}".</p>
    </div>`;
    }
    if (visible.length === 0) {
        return `<div class="empty-state">
      <div class="empty-illustration">🌱</div>
      <p>No habits yet. Tap "Add a habit" above to plant your first one.</p>
    </div>`;
    }
    // Roots = habits not chained after another *visible* habit (so a chain
    // renders as a tree; if the anchor isn't visible - archived, or filtered
    // out by search - this falls back to root).
    const roots = visible.filter((h) => {
        const anchor = h.stackAnchor;
        if (anchor.type !== "habit")
            return true;
        return !visible.some((p) => p.id === anchor.habitId);
    });
    const seen = new Set();
    const parts = [];
    let index = 0;
    roots.forEach((h) => {
        if (seen.has(h.id))
            return;
        parts.push(renderChainTree(h, visible, identityLabel, 0, index++, seen));
    });
    // Safety net: a stacking cycle (A after B, B after A) leaves no root among
    // its members — render any such leftover habit as its own root rather than
    // silently dropping it from the list.
    visible.forEach((h) => {
        if (seen.has(h.id))
            return;
        parts.push(renderChainTree(h, visible, identityLabel, 0, index++, seen));
    });
    return parts.join("");
}
export function renderHabits(container) {
    const { habits, identities } = getState();
    const activeHabits = habits.filter((h) => !h.archived);
    const activeIdentities = identities.filter((i) => !i.archived);
    const identityLabel = (id) => {
        if (!id)
            return "no identity";
        const found = activeIdentities.find((i) => i.id === id);
        return found ? found.statement : "no identity";
    };
    container.innerHTML = `
    <section class="view">
      <header class="view-header">
        <h1>Habits</h1>
        <p class="view-subtitle">Design each habit with the Four Laws, scale it down with the 2-minute rule, and stack it onto something you already do.</p>
      </header>

      <button type="button" class="btn btn-primary btn-block add-habit-cta" id="open-add-habit">
        <span class="add-habit-cta-icon">+</span> Add a habit
      </button>

      ${activeHabits.length > 3
        ? `<div class="search-bar">
              <span class="search-icon">🔍</span>
              <input type="text" id="habit-search" class="search-input" placeholder="Search habits" value="${escapeHtml(searchQuery)}" />
              <button type="button" class="search-clear ${searchQuery ? "" : "hidden"}" id="habit-search-clear" aria-label="Clear search">&times;</button>
            </div>`
        : ""}

      <div class="habit-list" id="habit-list">${buildListHtml(activeHabits, identityLabel)}</div>
    </section>
  `;
    container.querySelector("#open-add-habit").addEventListener("click", () => openHabitWizard());
    const listEl = container.querySelector("#habit-list");
    wireListInteractions(listEl, habits);
    const searchInput = container.querySelector("#habit-search");
    searchInput?.addEventListener("input", () => {
        searchQuery = searchInput.value;
        const clearBtn = container.querySelector("#habit-search-clear");
        if (clearBtn)
            clearBtn.classList.toggle("hidden", searchQuery.length === 0);
        listEl.innerHTML = buildListHtml(activeHabits, identityLabel);
        wireListInteractions(listEl, habits);
    });
    container.querySelector("#habit-search-clear")?.addEventListener("click", () => {
        searchQuery = "";
        if (searchInput)
            searchInput.value = "";
        listEl.innerHTML = buildListHtml(activeHabits, identityLabel);
        wireListInteractions(listEl, habits);
        searchInput?.focus();
    });
}
function wireListInteractions(listEl, habits) {
    listEl.querySelectorAll("[data-edit]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const habit = habits.find((h) => h.id === btn.dataset["edit"]);
            if (habit)
                openHabitWizard({ editHabit: habit });
        });
    });
    listEl.querySelectorAll("[data-archive-habit]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const habit = habits.find((h) => h.id === btn.dataset["archiveHabit"]);
            if (habit)
                undoableArchive(habit);
        });
    });
    listEl.querySelectorAll("[data-open-detail]").forEach((el) => {
        el.addEventListener("click", () => {
            const habit = habits.find((h) => h.id === el.dataset["openDetail"]);
            if (habit)
                openHabitDetail(habit);
        });
    });
    enableSwipeToReveal(listEl);
}
//# sourceMappingURL=habits.js.map