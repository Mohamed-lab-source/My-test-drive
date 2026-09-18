import { getState, setCheckIn } from "../state/store.js";
import { escapeHtml } from "../utils/html.js";
import { todayISO, isDue } from "../utils/date.js";
import { findCheckIn, isVote, computeCurrentStreak } from "../domain/analytics.js";
function orderDueHabits(due) {
    const dueIds = new Set(due.map((h) => h.id));
    const isRoot = (h) => !(h.stackAnchor.type === "habit" && dueIds.has(h.stackAnchor.habitId));
    const ordered = [];
    const visited = new Set();
    function visit(h) {
        if (visited.has(h.id))
            return;
        visited.add(h.id);
        ordered.push(h);
        due
            .filter((c) => c.stackAnchor.type === "habit" && c.stackAnchor.habitId === h.id)
            .forEach(visit);
    }
    due.filter(isRoot).forEach(visit);
    due.forEach(visit); // safety net for any cycles/orphans
    return ordered;
}
export function renderToday(container) {
    const { habits, checkins, identities } = getState();
    const today = todayISO();
    const activeHabits = habits.filter((h) => !h.archived);
    const dueToday = orderDueHabits(activeHabits.filter((h) => isDue(h.frequency, today)));
    const notDueCount = activeHabits.length - dueToday.length;
    const doneCount = dueToday.filter((h) => isVote(findCheckIn(checkins, h.id, today))).length;
    const identityLabel = (id) => {
        if (!id)
            return null;
        const found = identities.find((i) => i.id === id);
        return found ? found.statement : null;
    };
    container.innerHTML = `
    <section class="view">
      <header class="view-header">
        <h1>Today</h1>
        <p class="view-subtitle">
          ${new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          &middot; ${doneCount}/${dueToday.length} done
          ${notDueCount > 0 ? `&middot; ${notDueCount} not scheduled today` : ""}
        </p>
      </header>

      <div class="today-list">
        ${dueToday.length === 0
        ? `<div class="empty-state">Nothing scheduled today. Head to <a href="#/habits">Habits</a> to create one.</div>`
        : dueToday
            .map((habit) => {
            const checkin = findCheckIn(checkins, habit.id, today);
            const state = checkin?.completedFull ? "full" : checkin?.usedTwoMinuteVersion ? "two-minute" : "none";
            const streak = computeCurrentStreak(habit, checkins);
            const idLabel = identityLabel(habit.identityId);
            const chained = habit.stackAnchor.type === "habit";
            return `
                <div class="today-item state-${state} ${chained ? "chained" : ""}">
                  <div class="today-item-main">
                    <div class="today-item-title">
                      <span class="habit-name">${chained ? "↳ " : ""}${escapeHtml(habit.name)}</span>
                      ${streak > 0 ? `<span class="pill pill-streak">🔥 ${streak}</span>` : ""}
                    </div>
                    ${habit.response ? `<div class="today-item-response muted">${escapeHtml(habit.response)}</div>` : ""}
                    ${idLabel ? `<div class="today-item-identity muted">vote for: I am ${escapeHtml(idLabel)}</div>` : ""}
                  </div>
                  <div class="today-item-actions">
                    <button class="btn ${state === "full" ? "btn-success" : "btn-outline"}" data-checkin="${habit.id}" data-mode="full">
                      ${state === "full" ? "✓ Done" : "Done"}
                    </button>
                    ${habit.twoMinuteVersion
                ? `<button class="btn ${state === "two-minute" ? "btn-success" : "btn-outline"} btn-small" data-checkin="${habit.id}" data-mode="two-minute" title="${escapeHtml(habit.twoMinuteVersion)}">
                            ${state === "two-minute" ? "✓ 2-min" : "2-min"}
                          </button>`
                : ""}
                  </div>
                </div>`;
        })
            .join("")}
      </div>
    </section>
  `;
    container.querySelectorAll("[data-checkin]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const habitId = btn.dataset["checkin"];
            const mode = btn.dataset["mode"];
            const habit = activeHabits.find((h) => h.id === habitId);
            if (!habit)
                return;
            const checkin = findCheckIn(checkins, habitId, today);
            const currentState = checkin?.completedFull ? "full" : checkin?.usedTwoMinuteVersion ? "two-minute" : "none";
            setCheckIn(habitId, today, currentState === mode ? "clear" : mode);
        });
    });
}
//# sourceMappingURL=today.js.map