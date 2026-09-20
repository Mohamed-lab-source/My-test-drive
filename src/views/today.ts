import { getState, setCheckIn } from "../state/store.js";
import { escapeHtml } from "../utils/html.js";
import { todayISO, isDue, lastNDates } from "../utils/date.js";
import {
  findCheckIn,
  isVote,
  isSkipped,
  isNeutralized,
  computeCurrentStreak,
  computeLongestStreak,
  completionRate,
} from "../domain/analytics.js";
import { icons } from "../icons.js";
import { activityRing } from "../charts/svg.js";
import { celebrate, hapticSuccess, hapticTap } from "../confetti.js";
import { playChime } from "../prefs.js";
import { showToast } from "../toast.js";
import { enableSwipeToReveal } from "../swipe.js";
import { openHabitDetail } from "./habitDetail.js";
import { undoableArchive } from "./undoArchive.js";
import { quoteOfTheDay } from "../domain/quotes.js";
import { challengeOfTheDay } from "../domain/challenges.js";
import type { Habit, TimeOfDay } from "../domain/types.js";

const STREAK_MILESTONES = [7, 14, 30, 50, 100, 200, 365];

const TIME_SECTIONS: { key: TimeOfDay; label: string; icon: string }[] = [
  { key: "morning", label: "Morning", icon: "🌅" },
  { key: "afternoon", label: "Afternoon", icon: "☀️" },
  { key: "evening", label: "Evening", icon: "🌙" },
  { key: "anytime", label: "Anytime", icon: "⭐" },
];

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

/**
 * Picks the single due-not-done habit worth calling out today: the one
 * you've historically struggled with most, so the nudge is grounded in your
 * own data rather than an arbitrary pick. Returns null when nothing clears
 * the noise threshold (too little history, or nothing's actually struggling).
 */
function pickFocusHabit(
  due: Habit[],
  checkins: ReturnType<typeof getState>["checkins"],
  today: string
): { habit: Habit; rate: number } | null {
  const last30 = lastNDates(30);
  const notDoneToday = due.filter((h) => {
    const checkin = findCheckIn(checkins, h.id, today);
    return !isVote(checkin) && !isNeutralized(checkin);
  });
  const candidates = notDoneToday
    .map((h) => ({
      habit: h,
      dueCount: last30.filter((d) => isDue(h.frequency, d)).length,
      rate: completionRate(h, checkins, last30),
    }))
    .filter((c) => c.dueCount >= 3 && c.rate < 0.7);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.rate - b.rate);
  const top = candidates[0]!;
  return { habit: top.habit, rate: top.rate };
}

function renderTodayItem(
  habit: Habit,
  index: number,
  checkins: ReturnType<typeof getState>["checkins"],
  today: string,
  identityLabel: (id: string | null) => string | null
): string {
  const checkin = findCheckIn(checkins, habit.id, today);
  const state = checkin?.completedFull
    ? "full"
    : checkin?.usedTwoMinuteVersion
    ? "two-minute"
    : isSkipped(checkin)
    ? "skipped"
    : "none";
  const streak = computeCurrentStreak(habit, checkins);
  const idLabel = identityLabel(habit.identityId);
  const chained = habit.stackAnchor.type === "habit";
  return `
    <li class="today-item swipe-row state-${state} ${chained ? "chained" : ""} stagger-in" style="--stagger-index: ${index}">
      <div class="swipe-actions">
        <button class="swipe-action swipe-action-skip" data-skip-habit="${habit.id}">${state === "skipped" ? "Unskip" : "Skip"}</button>
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
            ${state === "skipped" ? `<span class="pill pill-skipped">⏭️ Skipped</span>` : ""}
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
      </div>
    </li>`;
}

export function renderToday(container: HTMLElement): void {
  const { habits, checkins, identities } = getState();
  const today = todayISO();
  const activeHabits = habits.filter((h) => !h.archived);
  const dueToday = orderDueHabits(activeHabits.filter((h) => isDue(h.frequency, today)));
  const notDueCount = activeHabits.length - dueToday.length;

  // Skipped-today habits are excused from the ring — they neither count as
  // done nor drag the total down.
  const ringHabits = dueToday.filter((h) => !isSkipped(findCheckIn(checkins, h.id, today)));
  const doneCount = ringHabits.filter((h) => isVote(findCheckIn(checkins, h.id, today))).length;
  const quote = quoteOfTheDay();
  const focus = pickFocusHabit(dueToday, checkins, today);
  const challenge = challengeOfTheDay();

  const identityLabel = (id: string | null): string | null => {
    if (!id) return null;
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
        .map(
          (b) => `
        <div class="today-section">
          <div class="today-section-label"><span>${b.icon}</span> ${b.label}</div>
          <ul class="list-card today-list">
            ${b.items.map((h) => renderTodayItem(h, rowIndex++, checkins, today, identityLabel)).join("")}
          </ul>
        </div>`
        )
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

      <div class="challenge-card">
        <span class="challenge-icon">${challenge.icon}</span>
        <span class="challenge-text">${escapeHtml(challenge.text)}</span>
      </div>

      ${
        focus
          ? `<div class="focus-card" data-open-detail="${focus.habit.id}">
              <span class="focus-icon">🎯</span>
              <div class="focus-copy">
                <div class="focus-title">Focus today: ${escapeHtml(focus.habit.name)}</div>
                <div class="focus-sub muted">Only ${Math.round(focus.rate * 100)}% completion this month — small steps count.${
              focus.habit.twoMinuteVersion ? ` Try: ${escapeHtml(focus.habit.twoMinuteVersion)}` : ""
            }</div>
              </div>
            </div>`
          : ""
      }

      ${
        ringHabits.length > 0
          ? `<div class="activity-ring-wrap">
              ${activityRing(doneCount, ringHabits.length)}
              <div>
                <div class="activity-ring-copy-title">${doneCount}/${ringHabits.length} done</div>
                <div class="activity-ring-copy-sub">${
                  doneCount === ringHabits.length
                    ? "Every habit voted for today. Nice."
                    : "Every vote counts toward who you're becoming."
                }</div>
              </div>
            </div>`
          : ""
      }

      ${
        dueToday.length === 0
          ? `<div class="empty-state">
              <div class="empty-illustration">☀️</div>
              <p>Nothing scheduled today. Head to <a href="#/habits">Habits</a> to create one.</p>
            </div>`
          : listHtml
      }
    </section>
  `;

  const prevDoneKey = `prev-done-${today}`;
  const prevDone = Number(sessionStorage.getItem(prevDoneKey) ?? "0");
  if (ringHabits.length > 0 && doneCount === ringHabits.length && prevDone < ringHabits.length) {
    hapticSuccess();
    celebrate(container.querySelector<HTMLElement>(".activity-ring-svg-wrap") ?? undefined);
  }
  sessionStorage.setItem(prevDoneKey, String(doneCount));

  container.querySelectorAll<HTMLButtonElement>("[data-checkin]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const habitId = btn.dataset["checkin"]!;
      const mode = btn.dataset["mode"] as "full" | "two-minute";
      const habit = activeHabits.find((h) => h.id === habitId);
      if (!habit) return;
      const checkin = findCheckIn(checkins, habitId, today);
      const currentState = checkin?.completedFull ? "full" : checkin?.usedTwoMinuteVersion ? "two-minute" : "none";
      const nextMode = currentState === mode ? "clear" : mode;
      const streakBefore = computeCurrentStreak(habit, checkins);
      const longestBefore = computeLongestStreak(habit, checkins);
      const btnRect = btn.getBoundingClientRect();
      const origin = { x: btnRect.left + btnRect.width / 2, y: btnRect.top + btnRect.height / 2 };

      hapticTap();
      await setCheckIn(habitId, today, nextMode);

      if (nextMode !== "clear") {
        playChime();
        const streakAfter = computeCurrentStreak(habit, getState().checkins);
        const isNewPersonalBest = streakAfter > longestBefore && streakAfter > 1;
        const milestone = STREAK_MILESTONES.find((m) => streakBefore < m && streakAfter >= m);
        if (isNewPersonalBest) {
          hapticSuccess();
          celebrate(origin);
          showToast("🏆", `New personal best on "${habit.name}" — ${streakAfter} days!`);
        } else if (milestone) {
          hapticSuccess();
          celebrate(origin);
          showToast("🔥", `${milestone}-day streak on "${habit.name}"!`);
        }
      }
    });
  });

  container.querySelectorAll<HTMLButtonElement>("[data-archive-habit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const habit = activeHabits.find((h) => h.id === btn.dataset["archiveHabit"]);
      if (habit) undoableArchive(habit);
    });
  });

  container.querySelectorAll<HTMLButtonElement>("[data-skip-habit]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const habitId = btn.dataset["skipHabit"]!;
      const checkin = findCheckIn(checkins, habitId, today);
      hapticTap();
      await setCheckIn(habitId, today, isSkipped(checkin) ? "clear" : "skip");
    });
  });

  container.querySelectorAll<HTMLElement>("[data-open-detail]").forEach((el) => {
    el.addEventListener("click", () => {
      const habit = activeHabits.find((h) => h.id === el.dataset["openDetail"]);
      if (habit) openHabitDetail(habit);
    });
  });

  enableSwipeToReveal(container);
}
