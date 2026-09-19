import { getState, archiveHabit, saveHabit } from "../state/store.js";
import { escapeHtml } from "../utils/html.js";
import { WEEKDAY_LABELS } from "../utils/date.js";
import { openHabitWizard } from "./habitWizard.js";
import { openHabitDetail } from "./habitDetail.js";
import { enableSwipeToReveal } from "../swipe.js";
import { undoableArchive } from "./undoArchive.js";
import { hapticTap } from "../confetti.js";
import type { Habit, Frequency } from "../domain/types.js";

// Persists across re-renders since renderHabits() rebuilds the DOM from
// scratch on every store change; a plain module variable is the simplest way
// to keep the query/filter alive without losing UI state mid-render.
let searchQuery = "";
let tagFilter = new Set<string>();
let selectMode = false;
let selectedIds = new Set<string>();

function stackDescription(habit: Habit, allHabits: Habit[]): string | null {
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

/** A habit is a root if it isn't stacked directly after another habit in the same set. */
function isRoot(habit: Habit, set: Habit[]): boolean {
  const anchor = habit.stackAnchor;
  if (anchor.type !== "habit") return true;
  return !set.some((p) => p.id === anchor.habitId);
}

function frequencyLabel(f: Frequency): string {
  if (f.type === "daily") return "Every day";
  if (f.days.length === 0) return "No days selected";
  return f.days.map((d) => WEEKDAY_LABELS[d]).join(", ");
}

interface RootInfo {
  isFirst: boolean;
  isLast: boolean;
}

function renderChainTree(
  habit: Habit,
  visibleHabits: Habit[],
  identityLabel: (id: string | null) => string,
  depth: number,
  index: number,
  seen: Set<string>,
  rootInfo: RootInfo | null
): string {
  seen.add(habit.id);
  // Excluding already-seen ids protects against a stacking cycle (A after B,
  // B after A) turning this recursion into infinite regress — each habit
  // renders exactly once, wherever it's first reached.
  const children = visibleHabits.filter(
    (h) => h.stackAnchor.type === "habit" && h.stackAnchor.habitId === habit.id && !seen.has(h.id)
  );
  const desc = stackDescription(habit, visibleHabits);
  const checked = selectedIds.has(habit.id);
  return `
    <div class="habit-node" style="margin-left: ${depth * 22}px">
      <div class="swipe-row stagger-in" style="--stagger-index: ${index}">
        <div class="swipe-actions">
          <button class="swipe-action swipe-action-archive" data-archive-habit="${habit.id}">Archive</button>
        </div>
        <div class="swipe-content">
          <div class="habit-card ${checked ? "habit-card-selected" : ""}" data-open-detail="${habit.id}">
            <div class="habit-card-head">
              ${
                selectMode
                  ? `<input type="checkbox" class="habit-select-checkbox" data-select-habit="${habit.id}" ${checked ? "checked" : ""} aria-label="Select ${escapeHtml(habit.name)}" />`
                  : ""
              }
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
            ${
              habit.tags.length > 0
                ? `<div class="habit-tag-row">${habit.tags.map((t) => `<span class="pill pill-tag">${escapeHtml(t)}</span>`).join("")}</div>`
                : ""
            }
            <div class="habit-card-foot">
              <span class="muted">${frequencyLabel(habit.frequency)}</span>
              ${habit.twoMinuteVersion ? `<span class="pill pill-two-min">2-min: ${escapeHtml(habit.twoMinuteVersion)}</span>` : ""}
              <div class="identity-actions">
                ${
                  rootInfo
                    ? `<button class="btn btn-plain reorder-btn" data-move-up="${habit.id}" ${rootInfo.isFirst ? "disabled" : ""} aria-label="Move up">▲</button>
                       <button class="btn btn-plain reorder-btn" data-move-down="${habit.id}" ${rootInfo.isLast ? "disabled" : ""} aria-label="Move down">▼</button>`
                    : ""
                }
                <button class="btn btn-plain" data-edit="${habit.id}">Edit</button>
                <button class="btn btn-plain btn-danger" data-archive-habit="${habit.id}">Archive</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      ${children.map((c, i) => renderChainTree(c, visibleHabits, identityLabel, depth + 1, index + i + 1, seen, null)).join("")}
    </div>
  `;
}

function buildListHtml(activeHabits: Habit[], identityLabel: (id: string | null) => string): string {
  const query = searchQuery.trim().toLowerCase();
  const filtered = query ? activeHabits.filter((h) => h.name.toLowerCase().includes(query)) : activeHabits;
  const visible =
    tagFilter.size === 0 ? filtered : filtered.filter((h) => h.tags.some((t) => tagFilter.has(t)));

  if (visible.length === 0 && (query || tagFilter.size > 0)) {
    return `<div class="empty-state">
      <div class="empty-illustration">🔍</div>
      <p>No habits match${query ? ` "${escapeHtml(searchQuery.trim())}"` : ""}${tagFilter.size > 0 ? " the selected tags" : ""}.</p>
    </div>`;
  }
  if (visible.length === 0) {
    return `<div class="empty-state">
      <div class="empty-illustration">🌱</div>
      <p>No habits yet. Tap "Add a habit" above to plant your first one.</p>
    </div>`;
  }

  // Reordering only makes sense against the full, unfiltered root order —
  // disable the move buttons while a search or tag filter narrows the list.
  const canReorder = !query && tagFilter.size === 0;

  // Roots = habits not chained after another *visible* habit (so a chain
  // renders as a tree; if the anchor isn't visible - archived, or filtered
  // out by search - this falls back to root).
  const roots = visible.filter((h) => isRoot(h, visible));

  const seen = new Set<string>();
  const parts: string[] = [];
  let index = 0;
  roots.forEach((h, i) => {
    if (seen.has(h.id)) return;
    const rootInfo: RootInfo | null = canReorder ? { isFirst: i === 0, isLast: i === roots.length - 1 } : null;
    parts.push(renderChainTree(h, visible, identityLabel, 0, index++, seen, rootInfo));
  });
  // Safety net: a stacking cycle (A after B, B after A) leaves no root among
  // its members — render any such leftover habit as its own root rather than
  // silently dropping it from the list.
  visible.forEach((h) => {
    if (seen.has(h.id)) return;
    parts.push(renderChainTree(h, visible, identityLabel, 0, index++, seen, null));
  });
  return parts.join("");
}

export function renderHabits(container: HTMLElement): void {
  const { habits, identities } = getState();
  const activeHabits = habits.filter((h) => !h.archived).sort((a, b) => a.sortOrder - b.sortOrder);
  const activeIdentities = identities.filter((i) => !i.archived);
  const allTags = Array.from(new Set(activeHabits.flatMap((h) => h.tags))).sort((a, b) => a.localeCompare(b));
  // A tag that no longer exists on any active habit (renamed/removed) shouldn't
  // keep silently filtering the list down to nothing.
  tagFilter = new Set(Array.from(tagFilter).filter((t) => allTags.includes(t)));

  const identityLabel = (id: string | null): string => {
    if (!id) return "no identity";
    const found = activeIdentities.find((i) => i.id === id);
    return found ? found.statement : "no identity";
  };

  container.innerHTML = `
    <section class="view">
      <header class="view-header view-header-with-action">
        <div>
          <h1>Habits</h1>
          <p class="view-subtitle">${
            selectMode
              ? `${selectedIds.size} selected`
              : "Design each habit with the Four Laws, scale it down with the 2-minute rule, and stack it onto something you already do."
          }</p>
        </div>
        ${
          activeHabits.length > 0
            ? `<button type="button" class="btn btn-plain" id="toggle-select-mode">${selectMode ? "Cancel" : "Select"}</button>`
            : ""
        }
      </header>

      ${
        !selectMode
          ? `<button type="button" class="btn btn-primary btn-block add-habit-cta" id="open-add-habit">
              <span class="add-habit-cta-icon">+</span> Add a habit
            </button>`
          : ""
      }

      ${
        activeHabits.length > 3 && !selectMode
          ? `<div class="search-bar">
              <span class="search-icon">🔍</span>
              <input type="text" id="habit-search" class="search-input" placeholder="Search habits" value="${escapeHtml(searchQuery)}" />
              <button type="button" class="search-clear ${searchQuery ? "" : "hidden"}" id="habit-search-clear" aria-label="Clear search">&times;</button>
            </div>`
          : ""
      }

      ${
        allTags.length > 0 && !selectMode
          ? `<div class="tag-filter-bar">
              ${allTags
                .map(
                  (t) => `<button type="button" class="tag-chip ${tagFilter.has(t) ? "active" : ""}" data-tag-filter="${escapeHtml(t)}">${escapeHtml(t)}</button>`
                )
                .join("")}
            </div>`
          : ""
      }

      <div class="habit-list ${selectMode ? "select-mode-padding" : ""}" id="habit-list">${buildListHtml(activeHabits, identityLabel)}</div>
    </section>

    ${
      selectMode
        ? `<div class="bulk-action-bar">
            <span class="muted">${selectedIds.size} selected</span>
            <button type="button" class="btn btn-primary btn-danger-fill" id="bulk-archive-btn" ${selectedIds.size === 0 ? "disabled" : ""}>Archive ${selectedIds.size || ""}</button>
          </div>`
        : ""
    }
  `;

  container.querySelector("#toggle-select-mode")?.addEventListener("click", () => {
    selectMode = !selectMode;
    selectedIds = new Set();
    hapticTap();
    renderHabits(container);
  });

  container.querySelector("#bulk-archive-btn")?.addEventListener("click", async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await archiveHabit(id);
    }
    hapticTap();
    selectMode = false;
    selectedIds = new Set();
    renderHabits(container);
  });

  container.querySelector("#open-add-habit")?.addEventListener("click", () => openHabitWizard());

  const listEl = container.querySelector<HTMLElement>("#habit-list")!;
  wireListInteractions(listEl, activeHabits, container);

  const searchInput = container.querySelector<HTMLInputElement>("#habit-search");
  searchInput?.addEventListener("input", () => {
    searchQuery = searchInput.value;
    const clearBtn = container.querySelector<HTMLButtonElement>("#habit-search-clear");
    if (clearBtn) clearBtn.classList.toggle("hidden", searchQuery.length === 0);
    listEl.innerHTML = buildListHtml(activeHabits, identityLabel);
    wireListInteractions(listEl, activeHabits, container);
  });
  container.querySelector("#habit-search-clear")?.addEventListener("click", () => {
    searchQuery = "";
    if (searchInput) searchInput.value = "";
    listEl.innerHTML = buildListHtml(activeHabits, identityLabel);
    wireListInteractions(listEl, activeHabits, container);
    searchInput?.focus();
  });

  container.querySelectorAll<HTMLButtonElement>("[data-tag-filter]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const tag = chip.dataset["tagFilter"]!;
      if (tagFilter.has(tag)) tagFilter.delete(tag);
      else tagFilter.add(tag);
      hapticTap();
      renderHabits(container);
    });
  });
}

function wireListInteractions(listEl: HTMLElement, habits: Habit[], container: HTMLElement): void {
  const toggleSelected = (id: string): void => {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    hapticTap();
    renderHabits(container);
  };

  listEl.querySelectorAll<HTMLButtonElement>("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const habit = habits.find((h) => h.id === btn.dataset["edit"]);
      if (habit) openHabitWizard({ editHabit: habit });
    });
  });

  listEl.querySelectorAll<HTMLButtonElement>("[data-archive-habit]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const habit = habits.find((h) => h.id === btn.dataset["archiveHabit"]);
      if (habit) undoableArchive(habit);
    });
  });

  listEl.querySelectorAll<HTMLElement>("[data-open-detail]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset["openDetail"]!;
      if (selectMode) {
        toggleSelected(id);
        return;
      }
      const habit = habits.find((h) => h.id === id);
      if (habit) openHabitDetail(habit);
    });
  });

  listEl.querySelectorAll<HTMLInputElement>("[data-select-habit]").forEach((cb) => {
    cb.addEventListener("click", (e) => e.stopPropagation());
    cb.addEventListener("change", () => toggleSelected(cb.dataset["selectHabit"]!));
  });

  // habits is already sorted by sortOrder (renderHabits sorts activeHabits
  // before calling in) — swap this habit's sortOrder with its neighbor's.
  listEl.querySelectorAll<HTMLButtonElement>("[data-move-up]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      moveRoot(habits, btn.dataset["moveUp"]!, -1);
    });
  });
  listEl.querySelectorAll<HTMLButtonElement>("[data-move-down]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      moveRoot(habits, btn.dataset["moveDown"]!, 1);
    });
  });

  if (!selectMode) enableSwipeToReveal(listEl);
}

function moveRoot(sortedHabits: Habit[], habitId: string, direction: -1 | 1): void {
  const roots = sortedHabits.filter((h) => isRoot(h, sortedHabits));
  const i = roots.findIndex((h) => h.id === habitId);
  const j = i + direction;
  if (i === -1 || j < 0 || j >= roots.length) return;
  const a = roots[i]!;
  const b = roots[j]!;
  hapticTap();
  saveHabit({ ...a, sortOrder: b.sortOrder });
  saveHabit({ ...b, sortOrder: a.sortOrder });
}
