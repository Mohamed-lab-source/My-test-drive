import { escapeHtml } from "../utils/html.js";
import { formatDisplay } from "../utils/date.js";
export function statTile(data) {
    const trend = data.trend && data.trend.length >= 2 ? sparklineSVG(data.trend) : "";
    return `
    <div class="stat-tile">
      <div class="stat-tile-label">${escapeHtml(data.label)}</div>
      <div class="stat-tile-value">${escapeHtml(data.value)}</div>
      ${data.sublabel ? `<div class="stat-tile-sublabel">${escapeHtml(data.sublabel)}</div>` : ""}
      ${trend ? `<div class="stat-tile-trend">${trend}</div>` : ""}
    </div>
  `;
}
export function sparklineSVG(values, width = 96, height = 28) {
    const max = Math.max(1, ...values);
    const step = width / (values.length - 1);
    const points = values.map((v, i) => {
        const x = i * step;
        const y = height - (v / max) * (height - 4) - 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const lastX = (values.length - 1) * step;
    const lastY = height - (values[values.length - 1] / max) * (height - 4) - 2;
    return `
    <svg class="viz-root" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="trend sparkline">
      <polyline points="${points.join(" ")}" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="3" fill="var(--series-1)" stroke="var(--surface-1)" stroke-width="1.5" />
    </svg>
  `;
}
const HEAT_BUCKETS = ["--heat-0", "--heat-1", "--heat-2", "--heat-3", "--heat-4"];
function heatColorVar(cell) {
    if (cell.due === 0)
        return "var(--gridline)";
    if (cell.ratio <= 0)
        return `var(${HEAT_BUCKETS[0]})`;
    if (cell.ratio < 0.5)
        return `var(${HEAT_BUCKETS[1]})`;
    if (cell.ratio < 0.75)
        return `var(${HEAT_BUCKETS[2]})`;
    if (cell.ratio < 1)
        return `var(${HEAT_BUCKETS[3]})`;
    return `var(${HEAT_BUCKETS[4]})`;
}
/** GitHub-style contribution heatmap: weeks as columns, Sun-Sat as rows. */
export function heatmapSVG(cells) {
    if (cells.length === 0)
        return "";
    const size = 11;
    const gap = 3;
    const cellStep = size + gap;
    const firstWeekday = new Date(cells[0].date + "T00:00:00").getDay();
    const totalSlots = firstWeekday + cells.length;
    const weeks = Math.ceil(totalSlots / 7);
    const width = weeks * cellStep + gap;
    const height = 7 * cellStep + gap;
    const rects = [];
    cells.forEach((cell, i) => {
        const slot = firstWeekday + i;
        const week = Math.floor(slot / 7);
        const day = slot % 7;
        const x = week * cellStep + gap;
        const y = day * cellStep + gap;
        const pct = Math.round(cell.ratio * 100);
        const title = cell.due === 0
            ? `${formatDisplay(cell.date)}: no habits due`
            : `${formatDisplay(cell.date)}: ${cell.done}/${cell.due} done (${pct}%)`;
        rects.push(`<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="2" fill="${heatColorVar(cell)}"><title>${escapeHtml(title)}</title></rect>`);
    });
    return `
    <svg class="viz-root" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily consistency heatmap">
      ${rects.join("")}
    </svg>
  `;
}
/** Horizontal bar chart, one hue, sorted low->high by the caller if desired. */
export function horizontalBarChartSVG(data, width = 480) {
    if (data.length === 0)
        return "";
    const rowHeight = 32;
    const barHeight = 16;
    const labelWidth = 140;
    const trackWidth = width - labelWidth - 48;
    const height = data.length * rowHeight + 8;
    const rows = data.map((d, i) => {
        const y = i * rowHeight + 8;
        const barW = Math.max(2, d.value * trackWidth);
        const pct = Math.round(d.value * 100);
        const title = d.detail ?? `${d.label}: ${pct}%`;
        return `
      <g>
        <title>${escapeHtml(title)}</title>
        <text x="${labelWidth - 8}" y="${y + barHeight / 2}" text-anchor="end" dominant-baseline="middle" class="viz-label">${escapeHtml(d.label)}</text>
        <rect x="${labelWidth}" y="${y}" width="${trackWidth}" height="${barHeight}" rx="4" fill="var(--gridline)" />
        <rect x="${labelWidth}" y="${y}" width="${barW}" height="${barHeight}" rx="4" fill="var(--series-1)" />
        <text x="${labelWidth + trackWidth + 8}" y="${y + barHeight / 2}" dominant-baseline="middle" class="viz-value">${pct}%</text>
      </g>
    `;
    });
    return `
    <svg class="viz-root" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Completion rate by habit">
      ${rows.join("")}
    </svg>
  `;
}
//# sourceMappingURL=svg.js.map