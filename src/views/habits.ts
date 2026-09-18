import { getState, archiveHabit } from "../state/store.js";
import { escapeHtml } from "../utils/html.js";
import { WEEKDAY_LABELS } from "../utils/date.js";
import { openHabitWizard } from "./habitWizard.js";
import { openHabitDetail } from "./habitDetail.js";
import { enableSwipeToReveal } from "../swipe.js";
import type { Habit, Frequency } from "../domain/types.js";

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

function frequencyLabel(f: Frequency): string {
  if (f.type === "daily") return "Every day";
  if (f.days.length === 0) return "No days selected";
  return f.days.map((d) => WEEKDAY_LABELS[d]).join(", ");
}

function renderChainTree(
  habit: Habit,
  allHabits: Habit[],
  identityLabel: (id: string | null) => string,
  depth: number,
  index: number
): string {
  const children = allHabits.filter(
    (h) => !h.archived && h.stackAnchor.type === "habit" && h.stackAnchor.habitId === habit.id
  );
  const desc = stackDescription(habit, allHabits);
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
      ${children.map((c, i) => renderChainTree(c, allHabits, identityLabel, depth + 1, index + i + 1)).join("")}
    </div>
  `;
}

export function renderHabits(container: HTMLElement): void {
  const { habits, identities } = getState();
  const activeHabits = habits.filter((h) => !h.archived);
  const activeIdentities = identities.filter((i) => !i.archived);

  const identityLabel = (id: string | null): string => {
    if (!id) return "no identity";
    const found = activeIdentities.find((i) => i.id === id);
    return found ? found.statement : "no identity";
  };

  // Roots = habits not chained after another still-active habit (so a chain
  // renders as a tree; if the anchor habit was archived, this falls back to root).
  const trueRoots = activeHabits.filter((h) => {
    const anchor = h.stackAnchor;
    if (anchor.type !== "habit") return true;
    return !activeHabits.some((p) => p.id === anchor.habitId);
  });

  container.innerHTML = `
    <section class="view">
      <header class="view-header">
        <h1>Habits</h1>
        <p class="view-subtitle">Design each habit with the Four Laws, scale it down with the 2-minute rule, and stack it onto something you already do.</p>
      </header>

      <button type="button" class="btn btn-primary btn-block add-habit-cta" id="open-add-habit">
        <span class="add-habit-cta-icon">+</span> Add a habit
      </button>

      <div class="habit-list">
        ${
          trueRoots.length === 0
            ? `<div class="empty-state">
                <div class="empty-illustration">🌱</div>
                <p>No habits yet. Tap "Add a habit" above to plant your first one.</p>
              </div>`
            : trueRoots.map((h, i) => renderChainTree(h, activeHabits, identityLabel, 0, i)).join("")
        }
      </div>
    </section>
  `;

  container.querySelector("#open-add-habit")!.addEventListener("click", () => openHabitWizard());

  container.querySelectorAll<HTMLButtonElement>("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const habit = habits.find((h) => h.id === btn.dataset["edit"]);
      if (habit) openHabitWizard({ editHabit: habit });
    });
  });

  container.querySelectorAll<HTMLButtonElement>("[data-archive-habit]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      archiveHabit(btn.dataset["archiveHabit"]!);
    });
  });

  container.querySelectorAll<HTMLElement>("[data-open-detail]").forEach((el) => {
    el.addEventListener("click", () => {
      const habit = habits.find((h) => h.id === el.dataset["openDetail"]);
      if (habit) openHabitDetail(habit);
    });
  });

  enableSwipeToReveal(container);
}
