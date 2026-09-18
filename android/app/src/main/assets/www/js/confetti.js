// Lightweight CSS-driven confetti burst — no canvas, no deps. A handful of
// colored divs animated with a CSS keyframe, removed once they finish.
const COLORS = ["#007AFF", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#FFD60A"];
export function celebrate(originEl) {
    const rect = originEl?.getBoundingClientRect();
    const originX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const originY = rect ? rect.top + rect.height / 2 : window.innerHeight / 3;
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
        piece.style.background = COLORS[i % COLORS.length];
        layer.appendChild(piece);
    }
    setTimeout(() => layer.remove(), 900);
}
export function hapticTap() {
    try {
        navigator.vibrate?.(10);
    }
    catch {
        // vibration not supported — ignore
    }
}
export function hapticSuccess() {
    try {
        navigator.vibrate?.([10, 40, 20]);
    }
    catch {
        // vibration not supported — ignore
    }
}
//# sourceMappingURL=confetti.js.map