// A small transient banner for milestone celebrations — slides down from the
// top, holds briefly, fades out. Independent of the confetti burst so both
// can fire together for a big moment.
let root = null;
function getRoot() {
    if (!root) {
        root = document.createElement("div");
        root.id = "toast-root";
        document.body.appendChild(root);
    }
    return root;
}
export function showToast(icon, message) {
    const container = getRoot();
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("toast-in"));
    setTimeout(() => {
        toast.classList.remove("toast-in");
        toast.classList.add("toast-out");
        setTimeout(() => toast.remove(), 350);
    }, 2200);
}
//# sourceMappingURL=toast.js.map