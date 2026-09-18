import { getState, archiveHabit } from "../state/store.js";
import { escapeHtml } from "../utils/html.js";
import { WEEKDAY_LABELS } from "../utils/date.js";
import { openHabitWizard } from "./habitWizard.js";
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
function renderChainTree(habit, allHabits, identityLabel, depth, index) {
    const children = allHabits.filter((h) => !h.archived && h.stackAnchor.type === "habit" && h.stackAnchor.habitId === habit.id);
    const desc = stackDescription(habit, allHabits);
    return `
    <div class="habit-node" style="margin-left: ${depth * 22}px">
      <div class="habit-card stagger-in" style="--stagger-index: ${index}">
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
      ${children.map((c, i) => renderChainTree(c, allHabits, identityLabel, depth + 1, index + i + 1)).join("")}
    </div>
  `;
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
    // Roots = habits not chained after another still-active habit (so a chain
    // renders as a tree; if the anchor habit was archived, this falls back to root).
    const trueRoots = activeHabits.filter((h) => {
        const anchor = h.stackAnchor;
        if (anchor.type !== "habit")
            return true;
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
        ${trueRoots.length === 0
        ? `<div class="empty-state">No habits yet. Tap "Add a habit" above to create your first one.</div>`
        : trueRoots.map((h, i) => renderChainTree(h, activeHabits, identityLabel, 0, i)).join("")}
      </div>
    </section>
  `;
    container.querySelector("#open-add-habit").addEventListener("click", () => openHabitWizard());
    container.querySelectorAll("[data-edit]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const habit = habits.find((h) => h.id === btn.dataset["edit"]);
            if (habit)
                openHabitWizard({ editHabit: habit });
        });
    });
    container.querySelectorAll("[data-archive-habit]").forEach((btn) => {
        btn.addEventListener("click", () => archiveHabit(btn.dataset["archiveHabit"]));
    });
}
//# sourceMappingURL=habits.js.map