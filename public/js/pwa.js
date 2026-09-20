// Service worker registration + install-prompt capture. Both are wrapped in
// feature checks and fail silently — this same code path runs both in a
// real browser (where PWA install is meaningful) and inside the Android
// WebView wrapper (which has no beforeinstallprompt and may not fully
// support service workers), and neither environment should see an error.
let deferredPrompt = null;
let installAvailable = false;
const listeners = new Set();
function notify() {
    for (const fn of listeners)
        fn();
}
export function registerServiceWorker() {
    if (!("serviceWorker" in navigator))
        return;
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch(() => {
            // Offline caching just won't be available — the app still works.
        });
    });
}
export function listenForInstallPrompt() {
    window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installAvailable = true;
        notify();
    });
    window.addEventListener("appinstalled", () => {
        deferredPrompt = null;
        installAvailable = false;
        notify();
    });
}
export function isInstallAvailable() {
    return installAvailable;
}
export function onInstallAvailabilityChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
/** Returns true if the user accepted the install prompt. */
export async function promptInstall() {
    if (!deferredPrompt)
        return false;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    installAvailable = false;
    notify();
    return choice.outcome === "accepted";
}
//# sourceMappingURL=pwa.js.map