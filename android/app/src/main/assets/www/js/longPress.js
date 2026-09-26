// Reusable long-press detection for list cards: hold ~450ms without moving
// more than a few pixels to trigger, mirroring iOS's context-menu gesture.
// Cancels itself the moment a drag is detected, so it coexists with
// enableSwipeToReveal's own pointer handlers on the same row without either
// gesture stealing the other's touch.
import { hapticTap } from "./confetti.js";
const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 10;
export function enableLongPress(container, selector, onLongPress) {
    container.querySelectorAll(selector).forEach((el) => {
        let timer = null;
        let startX = 0;
        let startY = 0;
        let fired = false;
        const clearTimer = () => {
            if (timer)
                clearTimeout(timer);
            timer = null;
        };
        el.addEventListener("pointerdown", (e) => {
            if (e.pointerType === "mouse" && e.button !== 0)
                return;
            fired = false;
            startX = e.clientX;
            startY = e.clientY;
            timer = setTimeout(() => {
                timer = null;
                fired = true;
                hapticTap();
                onLongPress(el);
            }, LONG_PRESS_MS);
        });
        el.addEventListener("pointermove", (e) => {
            if (!timer)
                return;
            if (Math.abs(e.clientX - startX) > MOVE_CANCEL_PX || Math.abs(e.clientY - startY) > MOVE_CANCEL_PX) {
                clearTimer();
            }
        });
        el.addEventListener("pointerup", clearTimer);
        el.addEventListener("pointercancel", clearTimer);
        el.addEventListener("pointerleave", clearTimer);
        // A fired long-press shouldn't also register as the card's normal tap.
        el.addEventListener("click", (e) => {
            if (fired) {
                e.stopPropagation();
                e.preventDefault();
                fired = false;
            }
        }, true);
    });
}
//# sourceMappingURL=longPress.js.map