import { getState, addIdentity, archiveIdentity } from "../state/store.js";
import { escapeHtml } from "../utils/html.js";
import { lastNDates } from "../utils/date.js";
import { identityVoteCount, identityVoteSeries } from "../domain/analytics.js";
import { sparklineSVG } from "../charts/svg.js";
import { openHabitWizard } from "./habitWizard.js";
import { openIdentityDetail } from "./identityDetail.js";
import { openQuickActions } from "./quickActions.js";
import { enableLongPress } from "../longPress.js";

export function renderIdentities(container: HTMLElement): void {
  const { identities, habits, checkins } = getState();
  const active = identities.filter((i) => !i.archived);
  const last30 = lastNDates(30);

  container.innerHTML = `
    <section class="view">
      <header class="view-header">
        <h1>Identities</h1>
        <p class="view-subtitle">
          "Every action is a vote for the type of person you wish to become."
          Define who you're trying to be, then attach habits to it.
        </p>
      </header>

      <form id="identity-form" class="form-card">
        <div class="form-card-row prefix-row">
          <span class="row-label">I am</span>
          <input type="text" name="statement" class="plain-input" placeholder="a healthy person" required maxlength="80" />
        </div>
        <div class="form-card-row">
          <button type="submit" class="btn btn-primary btn-block">Add identity</button>
        </div>
      </form>

      <div class="card-grid">
        ${
          active.length === 0
            ? `<div class="empty-state">
                <div class="empty-illustration">🧭</div>
                <p>No identities yet. Add one above — try something like "a runner" or "a writer".</p>
              </div>`
            : active
                .map((identity, i) => {
                  const habitCount = habits.filter(
                    (h) => h.identityId === identity.id && !h.archived
                  ).length;
                  const totalVotes = identityVoteCount(identity.id, habits, checkins);
                  const votes30 = identityVoteCount(identity.id, habits, checkins, last30);
                  const series = identityVoteSeries(identity.id, habits, checkins, last30);
                  return `
                <div class="card identity-card stagger-in" style="--stagger-index: ${i}">
                  <div class="identity-card-main" data-open-identity="${identity.id}">
                    <div class="identity-statement"><span class="habit-icon">${escapeHtml(identity.icon || "🧭")}</span> I am <strong>${escapeHtml(identity.statement)}</strong></div>
                    <div class="identity-stats">
                      <div>
                        <div class="stat-tile-value">${totalVotes}</div>
                        <div class="stat-tile-label">votes cast</div>
                      </div>
                      <div>
                        <div class="stat-tile-value">${votes30}</div>
                        <div class="stat-tile-label">last 30 days</div>
                      </div>
                      <div class="identity-sparkline">${sparklineSVG(series)}</div>
                    </div>
                  </div>
                  <div class="identity-footer">
                    <span class="muted">${habitCount} habit${habitCount === 1 ? "" : "s"} linked</span>
                    <div class="identity-actions">
                      <button class="btn btn-plain" data-add-habit="${identity.id}">+ Habit</button>
                      <button class="btn btn-plain btn-danger" data-archive="${identity.id}">Archive</button>
                    </div>
                  </div>
                </div>`;
                })
                .join("")
        }
      </div>
    </section>
  `;

  const form = container.querySelector<HTMLFormElement>("#identity-form")!;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = form.elements.namedItem("statement") as HTMLInputElement;
    const value = input.value.trim();
    if (!value) return;
    addIdentity(value);
    form.reset();
  });

  container.querySelectorAll<HTMLElement>("[data-open-identity]").forEach((el) => {
    el.addEventListener("click", () => {
      const identity = active.find((i) => i.id === el.dataset["openIdentity"]);
      if (identity) openIdentityDetail(identity);
    });
  });

  container.querySelectorAll<HTMLButtonElement>("[data-archive]").forEach((btn) => {
    btn.addEventListener("click", () => archiveIdentity(btn.dataset["archive"]!));
  });

  container.querySelectorAll<HTMLButtonElement>("[data-add-habit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openHabitWizard({ identityId: btn.dataset["addHabit"]! });
    });
  });

  enableLongPress(container, "[data-open-identity]", (el) => {
    const identity = active.find((i) => i.id === el.dataset["openIdentity"]);
    if (!identity) return;
    openQuickActions(`I am ${identity.statement}`, [
      { label: "View & edit", onSelect: () => openIdentityDetail(identity) },
      { label: "+ Habit", onSelect: () => openHabitWizard({ identityId: identity.id }) },
      { label: "Archive", danger: true, onSelect: () => archiveIdentity(identity.id) },
    ]);
  });
}
