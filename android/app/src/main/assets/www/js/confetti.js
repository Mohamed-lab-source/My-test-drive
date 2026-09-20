// Confetti burst driven by the Web Animations API rather than a single CSS
// keyframe — each piece gets its own randomized duration/delay/easing, which
// reads as a natural scatter instead of two dozen identical clones moving in
// lockstep, and cleanup runs off each animation's own `finished` promise
// instead of one blanket setTimeout guessing the longest piece's lifetime.
import { getPrefs } from "./prefs.js";
const COLORS = ["#007AFF", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#FFD60A"];
/**
 * Accepts a live element (its current position is read at call time) or a
 * plain {x, y} point — pass a point when the origin was captured earlier,
 * e.g. before an `await` that might detach the original element from the DOM.
 */
export function celebrate(origin) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        return;
    let originX = window.innerWidth / 2;
    let originY = window.innerHeight / 3;
    if (origin instanceof HTMLElement) {
        const rect = origin.getBoundingClientRect();
        originX = rect.left + rect.width / 2;
        originY = rect.top + rect.height / 2;
    }
    else if (origin) {
        originX = origin.x;
        originY = origin.y;
    }
    const layer = document.createElement("div");
    layer.className = "confetti-layer";
    document.body.appendChild(layer);
    const count = 24;
    const finishes = [];
    for (let i = 0; i < count; i++) {
        const piece = document.createElement("span");
        piece.className = "confetti-piece";
        piece.style.left = `${originX}px`;
        piece.style.top = `${originY}px`;
        piece.style.background = COLORS[i % COLORS.length];
        layer.appendChild(piece);
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
        const distance = 70 + Math.random() * 100;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance - 40;
        const rotation = Math.random() * 720 - 360;
        const duration = 700 + Math.random() * 400;
        const delay = Math.random() * 80;
        const animation = piece.animate([
            { transform: "translate(0, 0) rotate(0deg) scale(1)", opacity: 1 },
            {
                transform: `translate(${dx.toFixed(1)}px, ${(dy + 140).toFixed(1)}px) rotate(${rotation.toFixed(0)}deg) scale(0.6)`,
                opacity: 0,
            },
        ], { duration, delay, easing: "cubic-bezier(0.2, 0.8, 0.3, 1)", fill: "forwards" });
        finishes.push(animation.finished.catch(() => { }));
    }
    Promise.all(finishes).then(() => layer.remove());
}
export function hapticTap() {
    if (!getPrefs().haptics)
        return;
    try {
        navigator.vibrate?.(10);
    }
    catch {
        // vibration not supported — ignore
    }
}
export function hapticSuccess() {
    if (!getPrefs().haptics)
        return;
    try {
        navigator.vibrate?.([10, 40, 20]);
    }
    catch {
        // vibration not supported — ignore
    }
}
//# sourceMappingURL=confetti.js.map