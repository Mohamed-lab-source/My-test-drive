import { getState, addScorecardEntry, removeScorecardEntry } from "../state/store.js";
import { escapeHtml } from "../utils/html.js";
import type { ScorecardRating } from "../domain/types.js";

const RATING_LABEL: Record<ScorecardRating, string> = {
  "+": "Positive",
  "-": "Negative",
  "=": "Neutral",
};

export function renderScorecard(container: HTMLElement): void {
  const { scorecard } = getState();

  const counts = { "+": 0, "-": 0, "=": 0 } as Record<ScorecardRating, number>;
  for (const e of scorecard) counts[e.rating]++;

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

      <form id="scorecard-form" class="card form-inline">
        <input type="text" name="activity" placeholder="e.g. Check phone right after waking up" required maxlength="140" />
        <div class="rating-picker">
          <button type="button" class="rating-btn rating-plus" data-rating="+">+</button>
          <button type="button" class="rating-btn rating-equal" data-rating="=">=</button>
          <button type="button" class="rating-btn rating-minus" data-rating="-">-</button>
        </div>
        <input type="hidden" name="rating" value="=" />
        <button type="submit" class="btn btn-primary">Add</button>
      </form>

      <div class="summary-row">
        <span class="pill pill-plus">${counts["+"]} positive</span>
        <span class="pill pill-equal">${counts["="]} neutral</span>
        <span class="pill pill-minus">${counts["-"]} negative</span>
      </div>

      <ul class="scorecard-list">
        ${scorecard
          .slice()
          .reverse()
          .map(
            (e) => `
          <li class="scorecard-item rating-${e.rating === "+" ? "plus" : e.rating === "-" ? "minus" : "equal"}">
            <span class="scorecard-badge" title="${RATING_LABEL[e.rating]}">${e.rating}</span>
            <span class="scorecard-activity">${escapeHtml(e.activity)}</span>
            <button class="icon-btn" data-remove="${e.id}" aria-label="Remove">&times;</button>
          </li>`
          )
          .join("") || `<li class="empty-state">No entries yet — add your first routine behavior above.</li>`}
      </ul>
    </section>
  `;

  const form = container.querySelector<HTMLFormElement>("#scorecard-form")!;
  const ratingInput = form.querySelector<HTMLInputElement>('input[name="rating"]')!;
  const ratingBtns = form.querySelectorAll<HTMLButtonElement>(".rating-btn");

  function selectRating(r: string): void {
    ratingInput.value = r;
    ratingBtns.forEach((b) => b.classList.toggle("selected", b.dataset["rating"] === r));
  }
  selectRating("=");

  ratingBtns.forEach((btn) => {
    btn.addEventListener("click", () => selectRating(btn.dataset["rating"]!));
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const activityInput = form.elements.namedItem("activity") as HTMLInputElement;
    const activity = activityInput.value.trim();
    if (!activity) return;
    addScorecardEntry(activity, ratingInput.value as ScorecardRating);
    form.reset();
    selectRating("=");
  });

  container.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => removeScorecardEntry(btn.dataset["remove"]!));
  });
}
