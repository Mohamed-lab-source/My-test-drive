import { getState, setCheckIn } from "../state/store.js";
import { escapeHtml } from "../utils/html.js";
import { todayISO, isDue } from "../utils/date.js";
import { findCheckIn, isVote, computeCurrentStreak } from "../domain/analytics.js";
import { icons } from "../icons.js";
import type { Habit } from "../domain/types.js";

function orderDueHabits(due: Habit[]): Habit[] {
  const dueIds = new Set(due.map((h) => h.id));
  const isRoot = (h: Habit) =>
    !(h.stackAnchor.type === "habit" && dueIds.has(h.stackAnchor.habitId));

  const ordered: Habit[] = [];
  const visited = new Set<string>();

  function visit(h: Habit): void {
    if (visited.has(h.id)) return;
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

export function renderToday(container: HTMLElement): void {
  const { habits, checkins, identities } = getState();
  const today = todayISO();
  const activeHabits = habits.filter((h) => !h.archived);
  const dueToday = orderDueHabits(activeHabits.filter((h) => isDue(h.frequency, today)));
  const notDueCount = activeHabits.length - dueToday.length;

  const doneCount = dueToday.filter((h) => isVote(findCheckIn(checkins, h.id, today))).length;

  const identityLabel = (id: string | null): string | null => {
    if (!id) return null;
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

      ${
        dueToday.length === 0
          ? `<div class="empty-state">Nothing scheduled today. Head to <a href="#/habits">Habits</a> to create one.</div>`
          : `<ul class="list-card today-list">
              ${dueToday
                .map((habit) => {
                  const checkin = findCheckIn(checkins, habit.id, today);
                  const state = checkin?.completedFull ? "full" : checkin?.usedTwoMinuteVersion ? "two-minute" : "none";
                  const streak = computeCurrentStreak(habit, checkins);
                  const idLabel = identityLabel(habit.identityId);
                  const chained = habit.stackAnchor.type === "habit";
                  return `
                <li class="today-item state-${state} ${chained ? "chained" : ""}">
                  <button class="today-check" data-checkin="${habit.id}" data-mode="full" aria-label="Mark done">
                    ${state === "full" ? icons.checkFilled : icons.circle}
                  </button>
                  <div class="today-item-main">
                    <div class="today-item-title">
                      <span class="habit-name">${escapeHtml(habit.name)}</span>
                      ${streak > 0 ? `<span class="pill pill-streak">🔥 ${streak}</span>` : ""}
                    </div>
                    ${habit.response ? `<div class="today-item-response muted">${escapeHtml(habit.response)}</div>` : ""}
                    ${idLabel ? `<div class="today-item-identity muted">Vote for: I am ${escapeHtml(idLabel)}</div>` : ""}
                  </div>
                  ${
                    habit.twoMinuteVersion
                      ? `<button class="btn btn-plain btn-small today-two-min ${state === "two-minute" ? "active" : ""}" data-checkin="${habit.id}" data-mode="two-minute" title="${escapeHtml(habit.twoMinuteVersion)}">
                          2-min
                        </button>`
                      : ""
                  }
                </li>`;
                })
                .join("")}
            </ul>`
      }
    </section>
  `;

  container.querySelectorAll<HTMLButtonElement>("[data-checkin]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const habitId = btn.dataset["checkin"]!;
      const mode = btn.dataset["mode"] as "full" | "two-minute";
      const habit = activeHabits.find((h) => h.id === habitId);
      if (!habit) return;
      const checkin = findCheckIn(checkins, habitId, today);
      const currentState = checkin?.completedFull ? "full" : checkin?.usedTwoMinuteVersion ? "two-minute" : "none";
      setCheckIn(habitId, today, currentState === mode ? "clear" : mode);
    });
  });
}
