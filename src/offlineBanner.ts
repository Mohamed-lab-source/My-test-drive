// A small persistent banner confirming the app still works offline — this
// is a local-first app (IndexedDB), so "offline" isn't actually degraded
// mode, and the banner exists to say so rather than to warn of a problem.

let bannerEl: HTMLElement | null = null;

function getBanner(): HTMLElement {
  if (!bannerEl) {
    bannerEl = document.createElement("div");
    bannerEl.id = "offline-banner";
    bannerEl.className = "offline-banner";
    bannerEl.textContent = "📴 Offline — your data is on this device, so everything still works.";
    document.body.appendChild(bannerEl);
  }
  return bannerEl;
}

function updateVisibility(): void {
  getBanner().classList.toggle("visible", !navigator.onLine);
}

export function initOfflineBanner(): void {
  updateVisibility();
  window.addEventListener("online", updateVisibility);
  window.addEventListener("offline", updateVisibility);
}
