import { getState, archiveHabit, setCheckIn } from "../state/store.js";
import { escapeHtml } from "../utils/html.js";
import { lastNDates, todayISO, WEEKDAY_LABELS } from "../utils/date.js";
import { computeCurrentStreak, computeLongestStreak, dailyConsistency, findCheckIn, identityVoteCount, isVote } from "../domain/analytics.js";
import { heatmapSVG } from "../charts/svg.js";
import { hapticTap } from "../confetti.js";
import { showToast } from "../toast.js";
import { openHabitWizard } from "./habitWizard.js";
import type { Habit, Frequency } from "../domain/types.js";

function frequencyLabel(f: Frequency): string {
  if (f.type === "daily") return "Every day";
  if (f.days.length === 0) return "No days selected";
  return f.days.map((d) => WEEKDAY_LABELS[d]).join(", ");
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

  function close(): void {
    container.innerHTML = "";
    document.body.classList.remove("modal-open");
  }

  function render(): void {
    const { checkins, identities, habits } = getState();
    // Re-read the habit fresh each render in case it changed underneath us.
    const current = habits.find((h) => h.id === habit.id) ?? habit;
    const identity = identities.find((i) => i.id === current.identityId);
    const streak = computeCurrentStreak(current, checkins);
    const longest = computeLongestStreak(current, checkins);
    const votes = current.identityId ? identityVoteCount(current.identityId, habits, checkins) : 0;
    const cells = dailyConsistency([current], checkins, lastNDates(84));

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

    const today = todayISO();
    container.querySelectorAll<SVGRectElement>(".heat-cell-tappable").forEach((rect) => {
      const date = rect.dataset["date"]!;
      if (date >= today) return; // today is handled from the Today tab; future days aren't loggable
      rect.addEventListener("click", async () => {
        const wasVote = isVote(findCheckIn(getState().checkins, current.id, date));
        hapticTap();
        await setCheckIn(current.id, date, wasVote ? "clear" : "full");
        showToast(wasVote ? "↩️" : "✅", wasVote ? "Check-in cleared." : "Logged for that day.");
        render();
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
  }

  document.body.classList.add("modal-open");
  render();
}
