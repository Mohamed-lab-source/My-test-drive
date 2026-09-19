// Lightweight CSS-driven confetti burst — no canvas, no deps. A handful of
// colored divs animated with a CSS keyframe, removed once they finish.

import { getPrefs } from "./prefs.js";

const COLORS = ["#007AFF", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#FFD60A"];

export interface Point {
  x: number;
  y: number;
}

/**
 * Accepts a live element (its current position is read at call time) or a
 * plain {x, y} point — pass a point when the origin was captured earlier,
 * e.g. before an `await` that might detach the original element from the DOM.
 */
export function celebrate(origin?: HTMLElement | Point): void {
  let originX = window.innerWidth / 2;
  let originY = window.innerHeight / 3;
  if (origin instanceof HTMLElement) {
    const rect = origin.getBoundingClientRect();
    originX = rect.left + rect.width / 2;
    originY = rect.top + rect.height / 2;
  } else if (origin) {
    originX = origin.x;
    originY = origin.y;
  }

  const layer = document.createElement("div");
  layer.className = "confetti-layer";
  document.body.appendChild(layer);

  const count = 24;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const distance = 80 + Math.random() * 90;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 40;
    piece.style.setProperty("--dx", `${dx}px`);
    piece.style.setProperty("--dy", `${dy}px`);
    piece.style.setProperty("--rot", `${(Math.random() * 720 - 360).toFixed(0)}deg`);
    piece.style.left = `${originX}px`;
    piece.style.top = `${originY}px`;
    piece.style.background = COLORS[i % COLORS.length]!;
    layer.appendChild(piece);
  }

  setTimeout(() => layer.remove(), 900);
}

export function hapticTap(): void {
  if (!getPrefs().haptics) return;
  try {
    navigator.vibrate?.(10);
  } catch {
    // vibration not supported — ignore
  }
}

export function hapticSuccess(): void {
  if (!getPrefs().haptics) return;
  try {
    navigator.vibrate?.([10, 40, 20]);
  } catch {
    // vibration not supported — ignore
  }
}
