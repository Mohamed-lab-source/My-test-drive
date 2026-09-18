/** Positions the sliding thumb of a .segmented-control based on which radio is checked. */
export function positionSegmentedThumb(control) {
    if (!control)
        return;
    const inputs = Array.from(control.querySelectorAll(".segmented-input"));
    const index = Math.max(0, inputs.findIndex((i) => i.checked));
    control.style.setProperty("--segment-count", String(inputs.length));
    control.style.setProperty("--segment-index", String(index));
}
//# sourceMappingURL=segmented.js.map