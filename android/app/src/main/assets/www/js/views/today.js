import { getState, setCheckIn } from "../state/store.js";
import { escapeHtml } from "../utils/html.js";
import { todayISO, isDue } from "../utils/date.js";
import { findCheckIn, isVote, computeCurrentStreak } from "../domain/analytics.js";
import { icons } from "../icons.js";
import { activityRing } from "../charts/svg.js";
import { celebrate, hapticSuccess, hapticTap } from "../confetti.js";
import { playChime } from "../prefs.js";
import { showToast } from "../toast.js";
import { enableSwipeToReveal } from "../swipe.js";
import { openHabitDetail } from "./habitDetail.js";
import { undoableArchive } from "./undoArchive.js";
import { quoteOfTheDay } from "../domain/quotes.js";
const STREAK_MILESTONES = [7, 14, 30, 50, 100, 200, 365];
const TIME_SECTIONS = [
    { key: "morning", label: "Morning", icon: "🌅" },
    { key: "afternoon", label: "Afternoon", icon: "☀️" },
    { key: "evening", label: "Evening", icon: "🌙" },
    { key: "anytime", label: "Anytime", icon: "⭐" },
];
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
function renderTodayItem(habit, index, checkins, today, identityLabel) {
    const checkin = findCheckIn(checkins, habit.id, today);
    const state = checkin?.completedFull ? "full" : checkin?.usedTwoMinuteVersion ? "two-minute" : "none";
    const streak = computeCurrentStreak(habit, checkins);
    const idLabel = identityLabel(habit.identityId);
    const chained = habit.stackAnchor.type === "habit";
    return `
    <li class="today-item swipe-row state-${state} ${chained ? "chained" : ""} stagger-in" style="--stagger-index: ${index}">
      <div class="swipe-actions">
        <button class="swipe-action swipe-action-archive" data-archive-habit="${habit.id}">Archive</button>
      </div>
      <div class="swipe-content today-item-content">
        <button class="today-check" data-checkin="${habit.id}" data-mode="full" aria-label="Mark done">
          ${state === "full" ? icons.checkFilled : icons.circle}
        </button>
        <div class="today-item-main" data-open-detail="${habit.id}">
          <div class="today-item-title">
            <span class="habit-icon">${escapeHtml(habit.icon || "⭐")}</span>
            <span class="habit-name">${escapeHtml(habit.name)}</span>
            ${streak > 0 ? `<span class="pill pill-streak">🔥 ${streak}</span>` : ""}
          </div>
          ${habit.response ? `<div class="today-item-response muted">${escapeHtml(habit.response)}</div>` : ""}
          ${idLabel ? `<div class="today-item-identity muted">Vote for: I am ${escapeHtml(idLabel)}</div>` : ""}
        </div>
        ${habit.twoMinuteVersion
        ? `<button class="btn btn-plain btn-small today-two-min ${state === "two-minute" ? "active" : ""}" data-checkin="${habit.id}" data-mode="two-minute" title="${escapeHtml(habit.twoMinuteVersion)}">
                2-min
              </button>`
        : ""}
      </div>
    </li>`;
}
export function renderToday(container) {
    const { habits, checkins, identities } = getState();
    const today = todayISO();
    const activeHabits = habits.filter((h) => !h.archived);
    const dueToday = orderDueHabits(activeHabits.filter((h) => isDue(h.frequency, today)));
    const notDueCount = activeHabits.length - dueToday.length;
    const doneCount = dueToday.filter((h) => isVote(findCheckIn(checkins, h.id, today))).length;
    const quote = quoteOfTheDay();
    const identityLabel = (id) => {
        if (!id)
            return null;
        const found = identities.find((i) => i.id === id);
        return found ? found.statement : null;
    };
    const buckets = TIME_SECTIONS.map((section) => ({
        ...section,
        items: orderDueHabits(dueToday.filter((h) => (h.timeOfDay ?? "anytime") === section.key)),
    })).filter((b) => b.items.length > 0);
    const useSections = buckets.length > 1;
    let rowIndex = 0;
    const listHtml = useSections
        ? buckets
            .map((b) => `
        <div class="today-section">
          <div class="today-section-label"><span>${b.icon}</span> ${b.label}</div>
          <ul class="list-card today-list">
            ${b.items.map((h) => renderTodayItem(h, rowIndex++, checkins, today, identityLabel)).join("")}
          </ul>
        </div>`)
            .join("")
        : `<ul class="list-card today-list">
        ${dueToday.map((h) => renderTodayItem(h, rowIndex++, checkins, today, identityLabel)).join("")}
      </ul>`;
    container.innerHTML = `
    <section class="view">
      <header class="view-header">
        <h1>Today</h1>
        <p class="view-subtitle">
          ${new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          ${notDueCount > 0 ? `&middot; ${notDueCount} not scheduled today` : ""}
        </p>
      </header>

      <div class="quote-card">
        <div class="quote-mark">&ldquo;</div>
        <p class="quote-text">${escapeHtml(quote.text)}</p>
        <p class="quote-attribution">— ${escapeHtml(quote.attribution)}</p>
      </div>

      ${dueToday.length > 0
        ? `<div class="activity-ring-wrap">
              ${activityRing(doneCount, dueToday.length)}
              <div>
                <div class="activity-ring-copy-title">${doneCount}/${dueToday.length} done</div>
                <div class="activity-ring-copy-sub">${doneCount === dueToday.length
            ? "Every habit voted for today. Nice."
            : "Every vote counts toward who you're becoming."}</div>
              </div>
            </div>`
        : ""}

      ${dueToday.length === 0
        ? `<div class="empty-state">
              <div class="empty-illustration">☀️</div>
              <p>Nothing scheduled today. Head to <a href="#/habits">Habits</a> to create one.</p>
            </div>`
        : listHtml}
    </section>
  `;
    const prevDoneKey = `prev-done-${today}`;
    const prevDone = Number(sessionStorage.getItem(prevDoneKey) ?? "0");
    if (dueToday.length > 0 && doneCount === dueToday.length && prevDone < dueToday.length) {
        hapticSuccess();
        celebrate(container.querySelector(".activity-ring-svg-wrap") ?? undefined);
    }
    sessionStorage.setItem(prevDoneKey, String(doneCount));
    container.querySelectorAll("[data-checkin]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const habitId = btn.dataset["checkin"];
            const mode = btn.dataset["mode"];
            const habit = activeHabits.find((h) => h.id === habitId);
            if (!habit)
                return;
            const checkin = findCheckIn(checkins, habitId, today);
            const currentState = checkin?.completedFull ? "full" : checkin?.usedTwoMinuteVersion ? "two-minute" : "none";
            const nextMode = currentState === mode ? "clear" : mode;
            const streakBefore = computeCurrentStreak(habit, checkins);
            const btnRect = btn.getBoundingClientRect();
            const origin = { x: btnRect.left + btnRect.width / 2, y: btnRect.top + btnRect.height / 2 };
            hapticTap();
            await setCheckIn(habitId, today, nextMode);
            if (nextMode !== "clear") {
                playChime();
                const streakAfter = computeCurrentStreak(habit, getState().checkins);
                const milestone = STREAK_MILESTONES.find((m) => streakBefore < m && streakAfter >= m);
                if (milestone) {
                    hapticSuccess();
                    celebrate(origin);
                    showToast("🔥", `${milestone}-day streak on "${habit.name}"!`);
                }
            }
        });
    });
    container.querySelectorAll("[data-archive-habit]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const habit = activeHabits.find((h) => h.id === btn.dataset["archiveHabit"]);
            if (habit)
                undoableArchive(habit);
        });
    });
    container.querySelectorAll("[data-open-detail]").forEach((el) => {
        el.addEventListener("click", () => {
            const habit = activeHabits.find((h) => h.id === el.dataset["openDetail"]);
            if (habit)
                openHabitDetail(habit);
        });
    });
    enableSwipeToReveal(container);
}
//# sourceMappingURL=today.js.map