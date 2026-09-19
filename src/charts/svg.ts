import { escapeHtml } from "../utils/html.js";
import { formatDisplay } from "../utils/date.js";

export interface StatTileData {
  label: string;
  value: string;
  sublabel?: string;
  trend?: number[];
}

export function statTile(data: StatTileData): string {
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

export function activityRing(done: number, total: number): string {
  const size = 88;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const ratio = total === 0 ? 0 : Math.min(1, done / total);
  const offset = circumference * (1 - ratio);
  const complete = total > 0 && done >= total;
  const pct = Math.round(ratio * 100);

  return `
    <div class="activity-ring-svg-wrap">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${pct}% of today's habits done">
        <circle class="activity-ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" />
        <circle class="activity-ring-fill ${complete ? "complete" : ""}" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
          stroke-width="${stroke}" stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" />
      </svg>
      <div class="activity-ring-label">${complete ? "🎉" : `${pct}%`}</div>
    </div>
  `;
}

export function sparklineSVG(values: number[], width = 96, height = 28): string {
  const max = Math.max(1, ...values);
  const step = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - (v / max) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const lastX = (values.length - 1) * step;
  const lastY = height - (values[values.length - 1]! / max) * (height - 4) - 2;
  return `
    <svg class="viz-root" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="trend sparkline">
      <polyline points="${points.join(" ")}" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="3" fill="var(--series-1)" stroke="var(--surface-1)" stroke-width="1.5" />
    </svg>
  `;
}

export interface HeatmapCell {
  date: string;
  ratio: number;
  due: number;
  done: number;
}

const HEAT_BUCKETS = ["--heat-0", "--heat-1", "--heat-2", "--heat-3", "--heat-4"];

function heatColorVar(cell: HeatmapCell): string {
  if (cell.due === 0) return "var(--gridline)";
  if (cell.ratio <= 0) return `var(${HEAT_BUCKETS[0]})`;
  if (cell.ratio < 0.5) return `var(${HEAT_BUCKETS[1]})`;
  if (cell.ratio < 0.75) return `var(${HEAT_BUCKETS[2]})`;
  if (cell.ratio < 1) return `var(${HEAT_BUCKETS[3]})`;
  return `var(${HEAT_BUCKETS[4]})`;
}

/**
 * GitHub-style contribution heatmap: weeks as columns, Sun-Sat as rows.
 * When `interactive` is set, due-but-not-today cells get a `data-date` and a
 * tappable class so a caller can wire up backdating past check-ins.
 */
export function heatmapSVG(cells: HeatmapCell[], interactive = false): string {
  if (cells.length === 0) return "";
  const size = 11;
  const gap = 3;
  const cellStep = size + gap;

  const firstWeekday = new Date(cells[0]!.date + "T00:00:00").getDay();
  const totalSlots = firstWeekday + cells.length;
  const weeks = Math.ceil(totalSlots / 7);

  const width = weeks * cellStep + gap;
  const height = 7 * cellStep + gap;

  const rects: string[] = [];
  cells.forEach((cell, i) => {
    const slot = firstWeekday + i;
    const week = Math.floor(slot / 7);
    const day = slot % 7;
    const x = week * cellStep + gap;
    const y = day * cellStep + gap;
    const pct = Math.round(cell.ratio * 100);
    const title =
      cell.due === 0
        ? `${formatDisplay(cell.date)}: no habits due`
        : `${formatDisplay(cell.date)}: ${cell.done}/${cell.due} done (${pct}%)`;
    const tappable = interactive && cell.due > 0;
    rects.push(
      `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="2" fill="${heatColorVar(cell)}"${
        tappable ? ` class="heat-cell-tappable" data-date="${cell.date}"` : ""
      }><title>${escapeHtml(title)}</title></rect>`
    );
  });

  return `
    <svg class="viz-root" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily consistency heatmap">
      ${rects.join("")}
    </svg>
  `;
}

export interface BarDatum {
  label: string;
  value: number; // 0..1
  detail?: string;
}

/**
 * Horizontal bar list, one hue. Built with HTML/CSS (not SVG) so text stays
 * crisp and the bars reflow to any container width instead of overflowing it.
 */
export function barList(data: BarDatum[]): string {
  if (data.length === 0) return "";
  const rows = data.map((d) => {
    const pct = Math.round(d.value * 100);
    const title = d.detail ?? `${d.label}: ${pct}%`;
    return `
      <div class="bar-row" title="${escapeHtml(title)}">
        <span class="bar-row-label">${escapeHtml(d.label)}</span>
        <span class="bar-row-track"><span class="bar-row-fill" style="width:${Math.max(2, pct)}%"></span></span>
        <span class="bar-row-value">${pct}%</span>
      </div>
    `;
  });
  return `<div class="bar-list" role="img" aria-label="Completion rate by habit">${rows.join("")}</div>`;
}
