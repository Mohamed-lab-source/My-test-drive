import { getState } from "../state/store.js";
import { escapeHtml } from "../utils/html.js";
import { computeYearInReview, buildYearInReviewSummary } from "../domain/summary.js";
import { hapticSuccess } from "../confetti.js";
import { showToast } from "../toast.js";
import { animateModalClose, enableModalKeyboard } from "../modal.js";

function getRoot(): HTMLElement {
  let root = document.getElementById("modal-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "modal-root";
    document.body.appendChild(root);
  }
  return root;
}

export function openYearInReview(): void {
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

  const { habits, checkins } = getState();
  const review = computeYearInReview(habits, checkins);

  container.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-sheet" role="dialog" aria-modal="true">
      <div class="modal-sheet-handle"></div>
      <div class="wizard-header">
        <button type="button" class="icon-btn" id="year-review-close" aria-label="Close">&times;</button>
        <span class="wizard-header-title">${review.year} in Review</span>
        <span></span>
      </div>
      <div class="wizard-body">
        <div class="year-review-stat">
          <div class="year-review-value">${review.totalVotes}</div>
          <div class="year-review-label">votes cast this year</div>
        </div>

        <div class="stat-tile-row">
          ${
            review.bestMonth
              ? `<div class="stat-tile">
                  <div class="stat-tile-label">Best month</div>
                  <div class="stat-tile-value detail-stat-value">${escapeHtml(review.bestMonth.name)}</div>
                  <div class="stat-tile-sublabel">${review.bestMonth.votes} votes</div>
                </div>`
              : ""
          }
          <div class="stat-tile">
            <div class="stat-tile-label">Longest streak</div>
            <div class="stat-tile-value detail-stat-value">${review.bestStreakEver}</div>
            <div class="stat-tile-sublabel">days</div>
          </div>
        </div>

        ${
          review.mostImproved
            ? `<div class="card">
                <h2 class="card-title">Most improved</h2>
                <div class="spotlight-row">
                  <span class="spotlight-icon">📈</span>
                  <span><strong>${escapeHtml(review.mostImproved.habit.name)}</strong> — ${Math.round(review.mostImproved.before * 100)}% → ${Math.round(review.mostImproved.after * 100)}% completion, first half vs second half of the year.</span>
                </div>
              </div>`
            : ""
        }

        <button type="button" class="btn btn-primary btn-block" id="year-review-share">Share my year</button>
      </div>
    </div>
  `;

  container.querySelector("#year-review-close")!.addEventListener("click", close);
  container.querySelector(".modal-backdrop")!.addEventListener("click", close);

  container.querySelector("#year-review-share")!.addEventListener("click", async () => {
    const text = buildYearInReviewSummary(habits, checkins);
    if (navigator.share) {
      try {
        await navigator.share({ text, title: `My ${review.year} in Atomic Habits` });
        hapticSuccess();
      } catch {
        // User cancelled the share sheet — not an error.
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        hapticSuccess();
        showToast("📋", "Year in review copied to clipboard.");
      } catch {
        showToast("📋", "Couldn't share or copy — try again.");
      }
    }
  });

  document.body.classList.add("modal-open");
  disposeKeyboard = enableModalKeyboard(container, close);
}
