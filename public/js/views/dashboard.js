import { getState } from "../state/store.js";
import { lastNDates } from "../utils/date.js";
import { escapeHtml } from "../utils/html.js";
import { computeCurrentStreak, computeLongestStreak, completionRate, dailyConsistency, identityVoteCount, identityVoteSeries, totalVotesAllTime, } from "../domain/analytics.js";
import { statTile, heatmapSVG, horizontalBarChartSVG } from "../charts/svg.js";
export function renderDashboard(container) {
    const { habits, checkins, identities } = getState();
    const activeHabits = habits.filter((h) => !h.archived);
    const activeIdentities = identities.filter((i) => !i.archived);
    const last84 = lastNDates(84);
    const last30 = lastNDates(30);
    const totalVotes = totalVotesAllTime(checkins);
    const bestCurrentStreak = activeHabits.reduce((max, h) => Math.max(max, computeCurrentStreak(h, checkins)), 0);
    const longestStreakEver = habits.reduce((max, h) => Math.max(max, computeLongestStreak(h, checkins)), 0);
    const consistencyCells = dailyConsistency(activeHabits, checkins, last84);
    const barData = activeHabits
        .map((h) => ({
        label: h.name,
        value: completionRate(h, checkins, last30),
    }))
        .sort((a, b) => b.value - a.value);
    container.innerHTML = `
    <section class="view">
      <header class="view-header">
        <h1>Dashboard</h1>
        <p class="view-subtitle">The data behind the 1% — small, consistent votes compounding over time.</p>
      </header>

      <div class="stat-tile-row">
        ${statTile({ label: "Votes cast", value: String(totalVotes), sublabel: "all time" })}
        ${statTile({ label: "Current best streak", value: String(bestCurrentStreak), sublabel: "days" })}
        ${statTile({ label: "Longest streak ever", value: String(longestStreakEver), sublabel: "days" })}
        ${statTile({ label: "Habits tracked", value: String(activeHabits.length) })}
      </div>

      <div class="card">
        <h2 class="card-title">Consistency — last 12 weeks</h2>
        ${consistencyCells.length === 0 || activeHabits.length === 0
        ? `<div class="empty-state">No habits yet.</div>`
        : `<div class="heatmap-wrap">${heatmapSVG(consistencyCells)}</div>
               <div class="heatmap-legend muted">Each square = one day. More filled = more of that day's habits done.</div>`}
      </div>

      <div class="card">
        <h2 class="card-title">Completion rate — last 30 days</h2>
        ${barData.length === 0
        ? `<div class="empty-state">No habits yet.</div>`
        : horizontalBarChartSVG(barData)}
      </div>

      <div class="card">
        <h2 class="card-title">Identity votes</h2>
        ${activeIdentities.length === 0
        ? `<div class="empty-state">No identities yet — see the Identities tab.</div>`
        : `<div class="card-grid">
                ${activeIdentities
            .map((identity) => {
            const series = identityVoteSeries(identity.id, habits, checkins, last30);
            const votes30 = identityVoteCount(identity.id, habits, checkins, last30);
            return `
                    <div class="card identity-card">
                      <div class="identity-statement">I am <strong>${escapeHtml(identity.statement)}</strong></div>
                      ${statTile({ label: "votes, last 30 days", value: String(votes30), trend: series })}
                    </div>`;
        })
            .join("")}
              </div>`}
      </div>
    </section>
  `;
}
//# sourceMappingURL=dashboard.js.map