import { getState } from "../state/store.js";
import { lastNDates } from "../utils/date.js";
import { escapeHtml } from "../utils/html.js";
import { computeCurrentStreak, computeLongestStreak, completionRate, dailyConsistency, identityVoteCount, identityVoteSeries, totalVotesAllTime, isVote, } from "../domain/analytics.js";
import { statTile, heatmapSVG, barList } from "../charts/svg.js";
import { positionSegmentedThumb } from "../segmented.js";
import { openSettings } from "./settings.js";
import { openAchievements } from "./achievements.js";
import { computeBadges } from "../domain/achievements.js";
let heatmapDays = 84;
function weeklyInsight(thisWeek, prevWeek, perfectWeek, perfectToday) {
    if (perfectWeek) {
        return { icon: "🏅", text: "Perfect week — every due habit, every day. Incredible consistency." };
    }
    if (thisWeek === 0 && prevWeek === 0)
        return null;
    if (prevWeek === 0) {
        return { icon: "🌱", text: `${thisWeek} vote${thisWeek === 1 ? "" : "s"} logged this week — a fresh start.` };
    }
    const change = Math.round(((thisWeek - prevWeek) / prevWeek) * 100);
    if (change >= 10)
        return { icon: "📈", text: `You're up ${change}% from last week. Keep it going.` };
    if (change <= -10)
        return { icon: "📉", text: `Down ${Math.abs(change)}% from last week — small steps still count.` };
    if (perfectToday)
        return { icon: "✨", text: "Perfect day today — every due habit done." };
    return { icon: "⚖️", text: "Holding steady with last week." };
}
export function renderDashboard(container) {
    const { habits, checkins, identities } = getState();
    const activeHabits = habits.filter((h) => !h.archived);
    const activeIdentities = identities.filter((i) => !i.archived);
    const heatmapDates = lastNDates(heatmapDays);
    const last30 = lastNDates(30);
    const totalVotes = totalVotesAllTime(checkins);
    const bestCurrentStreak = activeHabits.reduce((max, h) => Math.max(max, computeCurrentStreak(h, checkins)), 0);
    const longestStreakEver = habits.reduce((max, h) => Math.max(max, computeLongestStreak(h, checkins)), 0);
    const consistencyCells = dailyConsistency(activeHabits, checkins, heatmapDates);
    const barData = activeHabits
        .map((h) => ({
        label: h.name,
        value: completionRate(h, checkins, last30),
    }))
        .sort((a, b) => b.value - a.value);
    const last7 = lastNDates(7);
    const prev7 = lastNDates(14).slice(0, 7);
    const votesThisWeek = checkins.filter((c) => isVote(c) && last7.includes(c.date)).length;
    const votesPrevWeek = checkins.filter((c) => isVote(c) && prev7.includes(c.date)).length;
    const week7Full = dailyConsistency(activeHabits, checkins, last7);
    const week7Due = week7Full.filter((c) => c.due > 0);
    const perfectWeek = week7Due.length > 0 && week7Due.every((c) => c.ratio === 1);
    const todayCell = week7Full[week7Full.length - 1];
    const perfectToday = !!todayCell && todayCell.due > 0 && todayCell.ratio === 1;
    const insight = weeklyInsight(votesThisWeek, votesPrevWeek, perfectWeek, perfectToday);
    const badges = computeBadges(habits, checkins);
    const earnedCount = badges.filter((b) => b.earned).length;
    container.innerHTML = `
    <section class="view">
      <header class="view-header view-header-with-action">
        <div>
          <h1>Dashboard</h1>
          <p class="view-subtitle">The data behind the 1% — small, consistent votes compounding over time.</p>
        </div>
        <div class="header-action-group">
          <button type="button" class="icon-btn" id="open-achievements" aria-label="Achievements">🏆</button>
          <button type="button" class="icon-btn settings-gear" id="open-settings" aria-label="Settings">⚙️</button>
        </div>
      </header>

      <button type="button" class="card achievements-teaser" id="open-achievements-card">
        <span class="achievements-teaser-icon">🏆</span>
        <div class="achievements-teaser-copy">
          <div class="achievements-teaser-title">Achievements</div>
          <div class="achievements-teaser-sub muted">${earnedCount} of ${badges.length} badges earned</div>
        </div>
        <span class="achievements-teaser-chevron">›</span>
      </button>

      ${insight ? `<div class="insight-card ${perfectWeek ? "insight-card-perfect" : ""}"><span class="insight-icon">${insight.icon}</span><span>${insight.text}</span></div>` : ""}

      <div class="stat-tile-row">
        ${statTile({ label: "Votes cast", value: String(totalVotes), sublabel: "all time" })}
        ${statTile({ label: "Current best streak", value: String(bestCurrentStreak), sublabel: "days" })}
        ${statTile({ label: "Longest streak ever", value: String(longestStreakEver), sublabel: "days" })}
        ${statTile({ label: "Habits tracked", value: String(activeHabits.length) })}
      </div>

      <div class="card">
        <h2 class="card-title">Consistency</h2>
        <div class="segmented-control segmented-control-2" id="heatmap-range-control">
          <input type="radio" id="range-12w" name="range" value="84" ${heatmapDays === 84 ? "checked" : ""} class="segmented-input" />
          <label for="range-12w" class="segmented-label">12 weeks</label>
          <input type="radio" id="range-1y" name="range" value="364" ${heatmapDays === 364 ? "checked" : ""} class="segmented-input" />
          <label for="range-1y" class="segmented-label">Full year</label>
        </div>
        <div class="heatmap-range-spacer"></div>
        ${consistencyCells.length === 0 || activeHabits.length === 0
        ? `<div class="empty-state">No habits yet.</div>`
        : `<div class="heatmap-wrap">${heatmapSVG(consistencyCells)}</div>
               <div class="heatmap-legend muted">Each square = one day. More filled = more of that day's habits done.</div>`}
      </div>

      <div class="card">
        <h2 class="card-title">Completion rate — last 30 days</h2>
        ${barData.length === 0
        ? `<div class="empty-state">No habits yet.</div>`
        : barList(barData)}
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
    container.querySelector("#open-settings").addEventListener("click", () => openSettings());
    container.querySelector("#open-achievements").addEventListener("click", () => openAchievements());
    container.querySelector("#open-achievements-card").addEventListener("click", () => openAchievements());
    const rangeControl = container.querySelector("#heatmap-range-control");
    positionSegmentedThumb(rangeControl);
    container.querySelectorAll('input[name="range"]').forEach((radio) => {
        radio.addEventListener("change", () => {
            heatmapDays = Number(radio.value);
            renderDashboard(container);
        });
    });
}
//# sourceMappingURL=dashboard.js.map