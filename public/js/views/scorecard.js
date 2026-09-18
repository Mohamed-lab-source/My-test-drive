import { getState, addScorecardEntry, removeScorecardEntry } from "../state/store.js";
import { escapeHtml } from "../utils/html.js";
const RATING_LABEL = {
    "+": "Positive",
    "-": "Negative",
    "=": "Neutral",
};
export function renderScorecard(container) {
    const { scorecard } = getState();
    const counts = { "+": 0, "-": 0, "=": 0 };
    for (const e of scorecard)
        counts[e.rating]++;
    container.innerHTML = `
    <section class="view">
      <header class="view-header">
        <h1>Habit Scorecard</h1>
        <p class="view-subtitle">
          From <em>Atomic Habits</em>: write down your daily routine, point by point,
          and mark each behavior as <strong>+</strong> (good), <strong>-</strong> (bad),
          or <strong>=</strong> (neutral). Awareness comes before change.
        </p>
      </header>

      <form id="scorecard-form" class="form-card">
        <div class="form-card-row">
          <input type="text" name="activity" class="plain-input" placeholder="e.g. Check phone right after waking up" required maxlength="140" />
        </div>
        <div class="form-card-row rating-row">
          <span class="row-label">Rating</span>
          <div class="rating-picker">
            <button type="button" class="rating-btn rating-minus" data-rating="-">&minus;</button>
            <button type="button" class="rating-btn rating-equal" data-rating="=">=</button>
            <button type="button" class="rating-btn rating-plus" data-rating="+">+</button>
          </div>
        </div>
        <input type="hidden" name="rating" value="=" />
        <div class="form-card-row">
          <button type="submit" class="btn btn-primary btn-block">Add to scorecard</button>
        </div>
      </form>

      <div class="summary-row">
        <span class="pill pill-plus">${counts["+"]} positive</span>
        <span class="pill pill-equal">${counts["="]} neutral</span>
        <span class="pill pill-minus">${counts["-"]} negative</span>
      </div>

      ${scorecard.length === 0
        ? `<div class="empty-state">No entries yet — add your first routine behavior above.</div>`
        : `<ul class="list-card">
              ${scorecard
            .slice()
            .reverse()
            .map((e) => `
                <li class="scorecard-item rating-${e.rating === "+" ? "plus" : e.rating === "-" ? "minus" : "equal"}">
                  <span class="scorecard-badge" title="${RATING_LABEL[e.rating]}">${e.rating}</span>
                  <span class="scorecard-activity">${escapeHtml(e.activity)}</span>
                  <button class="icon-btn" data-remove="${e.id}" aria-label="Remove">&times;</button>
                </li>`)
            .join("")}
            </ul>`}
    </section>
  `;
    const form = container.querySelector("#scorecard-form");
    const ratingInput = form.querySelector('input[name="rating"]');
    const ratingBtns = form.querySelectorAll(".rating-btn");
    function selectRating(r) {
        ratingInput.value = r;
        ratingBtns.forEach((b) => b.classList.toggle("selected", b.dataset["rating"] === r));
    }
    selectRating("=");
    ratingBtns.forEach((btn) => {
        btn.addEventListener("click", () => selectRating(btn.dataset["rating"]));
    });
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const activityInput = form.elements.namedItem("activity");
        const activity = activityInput.value.trim();
        if (!activity)
            return;
        addScorecardEntry(activity, ratingInput.value);
        form.reset();
        selectRating("=");
    });
    container.querySelectorAll("[data-remove]").forEach((btn) => {
        btn.addEventListener("click", () => removeScorecardEntry(btn.dataset["remove"]));
    });
}
//# sourceMappingURL=scorecard.js.map