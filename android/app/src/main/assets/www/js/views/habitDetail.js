import { getState, archiveHabit, setCheckIn, setCheckInNote } from "../state/store.js";
import { escapeHtml } from "../utils/html.js";
import { lastNDates, todayISO, formatDisplay, WEEKDAY_LABELS } from "../utils/date.js";
import { computeCurrentStreak, computeLongestStreak, dailyConsistency, findCheckIn, identityVoteCount, isVote } from "../domain/analytics.js";
import { heatmapSVG } from "../charts/svg.js";
import { hapticTap, hapticSuccess } from "../confetti.js";
import { showToast } from "../toast.js";
import { openHabitWizard } from "./habitWizard.js";
function frequencyLabel(f) {
    if (f.type === "daily")
        return "Every day";
    if (f.days.length === 0)
        return "No days selected";
    return f.days.map((d) => WEEKDAY_LABELS[d]).join(", ");
}
function getRoot() {
    let root = document.getElementById("modal-root");
    if (!root) {
        root = document.createElement("div");
        root.id = "modal-root";
        document.body.appendChild(root);
    }
    return root;
}
export function openHabitDetail(habit) {
    const container = getRoot();
    function close() {
        container.innerHTML = "";
        document.body.classList.remove("modal-open");
    }
    function render() {
        const { checkins, identities, habits } = getState();
        // Re-read the habit fresh each render in case it changed underneath us.
        const current = habits.find((h) => h.id === habit.id) ?? habit;
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
            .map((s) => `
              <div class="stat-tile">
                <div class="stat-tile-label">${escapeHtml(s.label)}</div>
                <div class="stat-tile-value detail-stat-value">${escapeHtml(s.value)}</div>
                ${s.sub ? `<div class="stat-tile-sublabel">${escapeHtml(s.sub)}</div>` : ""}
              </div>`)
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

          <div class="card">
            <h2 class="card-title">Journal</h2>
            <textarea id="journal-note" class="backup-textarea journal-textarea" rows="2" maxlength="500" placeholder="How did it go today?">${escapeHtml(todayNote)}</textarea>
            <button type="button" class="btn btn-outline btn-block" id="journal-save">Save today's note</button>
            ${pastNotes.length > 0
            ? `<div class="journal-history">
                    ${pastNotes
                .map((c) => `
                      <div class="journal-entry">
                        <div class="journal-entry-date muted">${formatDisplay(c.date)}</div>
                        <div class="journal-entry-text">${escapeHtml(c.note)}</div>
                      </div>`)
                .join("")}
                  </div>`
            : ""}
          </div>

          <div class="wizard-nav detail-nav-row">
            <button type="button" class="btn btn-plain btn-danger" id="detail-archive">Archive habit</button>
            <button type="button" class="btn btn-plain" id="detail-duplicate">Duplicate</button>
            <button type="button" class="btn btn-primary" id="detail-edit">Edit</button>
          </div>
        </div>
      </div>
    `;
        container.querySelector("#detail-close").addEventListener("click", close);
        container.querySelector(".modal-backdrop").addEventListener("click", close);
        container.querySelector("#journal-save").addEventListener("click", async () => {
            const textarea = container.querySelector("#journal-note");
            await setCheckInNote(current.id, today, textarea.value);
            hapticSuccess();
            showToast("📝", "Note saved.");
            render();
        });
        container.querySelectorAll(".heat-cell-tappable").forEach((rect) => {
            const date = rect.dataset["date"];
            if (date >= today)
                return; // today is handled from the Today tab; future days aren't loggable
            rect.addEventListener("click", async () => {
                const wasVote = isVote(findCheckIn(getState().checkins, current.id, date));
                hapticTap();
                await setCheckIn(current.id, date, wasVote ? "clear" : "full");
                showToast(wasVote ? "↩️" : "✅", wasVote ? "Check-in cleared." : "Logged for that day.");
                render();
            });
        });
        container.querySelector("#detail-edit").addEventListener("click", () => {
            close();
            openHabitWizard({ editHabit: current });
        });
        container.querySelector("#detail-duplicate").addEventListener("click", () => {
            close();
            openHabitWizard({ duplicateFrom: current });
        });
        container.querySelector("#detail-archive").addEventListener("click", () => {
            archiveHabit(current.id);
            close();
        });
    }
    document.body.classList.add("modal-open");
    render();
}
//# sourceMappingURL=habitDetail.js.map