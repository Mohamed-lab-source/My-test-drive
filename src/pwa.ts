// Service worker registration + install-prompt capture. Both are wrapped in
// feature checks and fail silently — this same code path runs both in a
// real browser (where PWA install is meaningful) and inside the Android
// WebView wrapper (which has no beforeinstallprompt and may not fully
// support service workers), and neither environment should see an error.

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installAvailable = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Offline caching just won't be available — the app still works.
    });
  });
}

export function listenForInstallPrompt(): void {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    installAvailable = true;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installAvailable = false;
    notify();
  });
}

export function isInstallAvailable(): boolean {
  return installAvailable;
}

export function onInstallAvailabilityChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Returns true if the user accepted the install prompt. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  installAvailable = false;
  notify();
  return choice.outcome === "accepted";
}
