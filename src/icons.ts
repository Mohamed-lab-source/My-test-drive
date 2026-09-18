// Minimal SF Symbols-style line icons (24x24, ~1.7px stroke) for the tab bar.
// Hand-drawn to avoid a font/icon-set dependency.

function icon(paths: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

export const icons = {
  today: icon(
    `<path d="M8 3v3M16 3v3M4 9h16"/><rect x="4" y="5" width="16" height="16" rx="4"/><path d="M8.5 13.5l2.3 2.3L15.5 11"/>`
  ),
  habits: icon(`<path d="M13 2 4.5 13.5H11L10 22l9-12.5h-6.5L13 2z"/>`),
  identities: icon(
    `<path d="M12 3.5l2.47 5.18 5.53.68-4.06 3.98 1.02 5.66L12 16.2l-4.96 2.8 1.02-5.66-4.06-3.98 5.53-.68L12 3.5z"/>`
  ),
  scorecard: icon(
    `<rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="M8 8.5h8M8 12h8M8 15.5h5"/>`
  ),
  dashboard: icon(
    `<rect x="4" y="12" width="4" height="8" rx="1"/><rect x="10" y="8" width="4" height="12" rx="1"/><rect x="16" y="4.5" width="4" height="15.5" rx="1"/>`
  ),
  chevronRight: icon(`<path d="M9 5l7 7-7 7"/>`),
  checkFilled: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 12.5l2.5 2.5L16.5 9" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  circle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9.2"/></svg>`,
};
