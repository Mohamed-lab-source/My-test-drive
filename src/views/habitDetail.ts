import { getState, archiveHabit, setCheckIn, setCheckInNote } from "../state/store.js";
import { escapeHtml } from "../utils/html.js";
import { lastNDates, todayISO, addDays, isDue, formatDisplay, WEEKDAY_LABELS } from "../utils/date.js";
import {
  computeCurrentStreak,
  computeLongestStreak,
  dailyConsistency,
  findCheckIn,
  findHabitById,
  identityVoteCount,
  isVote,
  isNeutralized,
  weekdayBreakdown,
} from "../domain/analytics.js";
import { freezeTokenBalance } from "../domain/gamification.js";
import { heatmapSVG } from "../charts/svg.js";
import { hapticTap, hapticSuccess } from "../confetti.js";
import { showToast } from "../toast.js";
import { openHabitWizard } from "./habitWizard.js";
import { animateModalClose, enableModalKeyboard } from "../modal.js";
import type { Habit, Frequency, CheckIn } from "../domain/types.js";

function frequencyLabel(f: Frequency): string {
  if (f.type === "daily") return "Every day";
  if (f.days.length === 0) return "No days selected";
  return f.days.map((d) => WEEKDAY_LABELS[d]).join(", ");
}

/**
 * A coaching tip comparing the habit's best vs worst weekday, when there's
 * enough history to trust the comparison and the gap is large enough to be
 * worth mentioning rather than noise.
 */
function weekdayTip(habit: Habit, checkins: CheckIn[]): string | null {
  const stats = weekdayBreakdown(habit, checkins).filter((s) => s.dueCount >= 3);
  if (stats.length < 2) return null;
  const best = stats.reduce((a, b) => (b.rate > a.rate ? b : a));
  const worst = stats.reduce((a, b) => (b.rate < a.rate ? b : a));
  if (best.weekday === worst.weekday || best.rate - worst.rate < 0.3) return null;
  return `You're most consistent on ${WEEKDAY_LABELS[best.weekday]}s (${Math.round(best.rate * 100)}%) and least on ${WEEKDAY_LABELS[worst.weekday]}s (${Math.round(worst.rate * 100)}%). A stronger cue on ${WEEKDAY_LABELS[worst.weekday]}s could help.`;
}

/** Most recent due day, before today, with no vote and no excuse — a true gap. */
function findMostRecentMiss(habit: Habit, checkins: CheckIn[], today: string): string | null {
  const createdDate = habit.createdAt.slice(0, 10);
  let cursor = addDays(today, -1);
  for (let i = 0; i < 84; i++) {
    if (cursor < createdDate) break;
    if (isDue(habit.frequency, cursor)) {
      const checkin = findCheckIn(checkins, habit.id, cursor);
      if (!isVote(checkin) && !isNeutralized(checkin)) return cursor;
    }
    cursor = addDays(cursor, -1);
  }
  return null;
}

function getRoot(): HTMLElement {
  let root = document.getElementById("modal-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "modal-root";
    document.body.appendChild(root);
  }
  return root;
}

export function openHabitDetail(habit: Habit): void {
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

  function render(): void {
    const { checkins, identities, habits } = getState();
    // Re-read the habit fresh each render in case it changed underneath us.
    const current = findHabitById(habits, habit.id) ?? habit;
    const identity = identities.find((i) => i.id === current.identityId);
    const streak = computeCurrentStreak(current, checkins);
    const longest = computeLongestStreak(current, checkins);
    const votes = current.identityId ? identityVoteCount(current.identityId, habits, checkins) : 0;
    const cells = dailyConsistency([current], checkins, lastNDates(84));
    const today = todayISO();
    const todayNote = findCheckIn(checkins, current.id, today)?.note ?? "";
    const pastNotes = checkins
      .filter((c) => c.habitId === current.id && c.date !== today && c.note.trim())
      .sort((a, b) => b.date.localeCompare(a.date));
    const freezeBalance = freezeTokenBalance(checkins);
    const mostRecentMiss = findMostRecentMiss(current, checkins, today);
    const tip = weekdayTip(current, checkins);

    container.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-sheet" role="dialog" aria-modal="true">
        <div class="modal-sheet-handle"></div>
        <div class="wizard-header">
          <button type="button" class="icon-btn" id="detail-close" aria-label="Close">&times;</button>
          <span></span>
          <span></span>
        </div>
        <div class="wizard-body">
          <div class="detail-hero">
            <div class="detail-hero-icon">${escapeHtml(current.icon || "⭐")}</div>
            <div class="detail-hero-name">${escapeHtml(current.name)}</div>
            ${identity ? `<div class="pill pill-identity">I am ${escapeHtml(identity.statement)}</div>` : ""}
          </div>

          <div class="stat-tile-row detail-stats">
            ${[
              { label: "Current streak", value: String(streak), sub: "days" },
              { label: "Longest streak", value: String(longest), sub: "days" },
              { label: "Frequency", value: frequencyLabel(current.frequency) },
              { label: "Identity votes", value: String(votes) },
            ]
              .map(
                (s) => `
              <div class="stat-tile">
                <div class="stat-tile-label">${escapeHtml(s.label)}</div>
                <div class="stat-tile-value detail-stat-value">${escapeHtml(s.value)}</div>
                ${s.sub ? `<div class="stat-tile-sublabel">${escapeHtml(s.sub)}</div>` : ""}
              </div>`
              )
              .join("")}
          </div>

          <div class="card">
            <h2 class="card-title">Last 12 weeks</h2>
            <div class="heatmap-wrap">${heatmapSVG(cells, true)}</div>
            <p class="muted heatmap-hint">Tap a past day to log or clear a check-in.</p>
          </div>

          <div class="card">
            <h2 class="card-title">The Four Laws</h2>
            <div class="habit-four-laws detail-four-laws">
              <div><span class="law-tag">Obvious</span> ${escapeHtml(current.cue) || "—"}</div>
              <div><span class="law-tag">Attractive</span> ${escapeHtml(current.craving) || "—"}</div>
              <div><span class="law-tag">Easy</span> ${escapeHtml(current.response) || "—"}</div>
              <div><span class="law-tag">Satisfying</span> ${escapeHtml(current.reward) || "—"}</div>
            </div>
            ${current.twoMinuteVersion ? `<div class="pill pill-two-min detail-two-min">2-min: ${escapeHtml(current.twoMinuteVersion)}</div>` : ""}
          </div>

          ${
            tip
              ? `<div class="coaching-tip-card">
                  <span class="coaching-tip-icon">🧠</span>
                  <span>${escapeHtml(tip)}</span>
                </div>`
              : ""
          }

          <div class="card">
            <h2 class="card-title">Streak Freezes</h2>
            <p class="wizard-subtitle">Earn one every 20 votes cast, across all habits. Use one to protect a streak on a day you missed.</p>
            <div class="freeze-balance">❄️ ${freezeBalance} available</div>
            ${
              mostRecentMiss
                ? `<button type="button" class="btn btn-outline btn-block" id="apply-freeze-btn" ${freezeBalance === 0 ? "disabled" : ""}>
                    Protect ${escapeHtml(formatDisplay(mostRecentMiss))}
                  </button>`
                : `<p class="muted">No missed days to protect right now.</p>`
            }
          </div>

          <div class="card">
            <h2 class="card-title">Journal</h2>
            <textarea id="journal-note" class="backup-textarea journal-textarea" rows="2" maxlength="500" placeholder="How did it go today?">${escapeHtml(todayNote)}</textarea>
            <button type="button" class="btn btn-outline btn-block" id="journal-save">Save today's note</button>
            ${
              pastNotes.length > 0
                ? `<div class="journal-history">
                    ${pastNotes
                      .map(
                        (c) => `
                      <div class="journal-entry">
                        <div class="journal-entry-date muted">${formatDisplay(c.date)}</div>
                        <div class="journal-entry-text">${escapeHtml(c.note)}</div>
                      </div>`
                      )
                      .join("")}
                  </div>`
                : ""
            }
          </div>

          <div class="wizard-nav detail-nav-row">
            <button type="button" class="btn btn-plain btn-danger" id="detail-archive">Archive habit</button>
            <button type="button" class="btn btn-plain" id="detail-duplicate">Duplicate</button>
            <button type="button" class="btn btn-primary" id="detail-edit">Edit</button>
          </div>
        </div>
      </div>
    `;

    container.querySelector("#detail-close")!.addEventListener("click", close);
    container.querySelector(".modal-backdrop")!.addEventListener("click", close);

    container.querySelector("#apply-freeze-btn")?.addEventListener("click", async () => {
      if (!mostRecentMiss) return;
      hapticSuccess();
      await setCheckIn(current.id, mostRecentMiss, "freeze");
      showToast("❄️", `Streak protected for ${formatDisplay(mostRecentMiss)}.`);
      render();
    });

    container.querySelector("#journal-save")!.addEventListener("click", async () => {
      const textarea = container.querySelector<HTMLTextAreaElement>("#journal-note")!;
      await setCheckInNote(current.id, today, textarea.value);
      hapticSuccess();
      showToast("📝", "Note saved.");
      render();
    });

    container.querySelectorAll<SVGRectElement>(".heat-cell-tappable").forEach((rect) => {
      const date = rect.dataset["date"]!;
      if (date >= today) return; // today is handled from the Today tab; future days aren't loggable
      const toggle = async (): Promise<void> => {
        const wasVote = isVote(findCheckIn(getState().checkins, current.id, date));
        hapticTap();
        await setCheckIn(current.id, date, wasVote ? "clear" : "full");
        showToast(wasVote ? "↩️" : "✅", wasVote ? "Check-in cleared." : "Logged for that day.");
        render();
      };
      rect.addEventListener("click", toggle);
      rect.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });
    });

    container.querySelector("#detail-edit")!.addEventListener("click", () => {
      close();
      openHabitWizard({ editHabit: current });
    });
    container.querySelector("#detail-duplicate")!.addEventListener("click", () => {
      close();
      openHabitWizard({ duplicateFrom: current });
    });
    container.querySelector("#detail-archive")!.addEventListener("click", () => {
      archiveHabit(current.id);
      close();
    });

    disposeKeyboard?.();
    disposeKeyboard = enableModalKeyboard(container, close);
  }

  document.body.classList.add("modal-open");
  render();
}
