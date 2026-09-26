import { getState, exportAllData, isValidBackup, restoreFromBackup, resetAllData, setCheckIn, batch } from "../state/store.js";
import { hapticSuccess, hapticTap } from "../confetti.js";
import { getPrefs, setPref, type Theme } from "../prefs.js";
import { checkinsToCsv, previewCsvImport, type CsvImportPreview } from "../csv.js";
import { showToast } from "../toast.js";
import { positionSegmentedThumb } from "../segmented.js";
import { isInstallAvailable, promptInstall, onInstallAvailabilityChange } from "../pwa.js";
import { buildProgressSummary } from "../domain/summary.js";
import { animateModalClose, enableModalKeyboard } from "../modal.js";
import { openArchived } from "./archived.js";
import { openYearInReview } from "./yearInReview.js";
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  scheduleReminderCheck,
} from "../reminders.js";
import type { BackupFile } from "../db/repo.js";

let root: HTMLElement | null = null;

function getRoot(): HTMLElement {
  if (!root) {
    root = document.getElementById("modal-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "modal-root";
      document.body.appendChild(root);
    }
  }
  return root;
}

export function openSettings(): void {
  const container = getRoot();
  const unsubscribeInstall = onInstallAvailabilityChange(() => render());
  let disposeKeyboard: (() => void) | null = null;

  function close(): void {
    unsubscribeInstall();
    disposeKeyboard?.();
    disposeKeyboard = null;
    animateModalClose(container, () => {
      container.innerHTML = "";
      document.body.classList.remove("modal-open");
    });
  }

  function render(): void {
    const { identities, habits, checkins, scorecard } = getState();
    const activeHabits = habits.filter((h) => !h.archived).length;
    const activeIdentities = identities.filter((i) => !i.archived).length;

    container.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-sheet" role="dialog" aria-modal="true">
        <div class="modal-sheet-handle"></div>
        <div class="wizard-header">
          <button type="button" class="icon-btn" id="settings-close" aria-label="Close">&times;</button>
          <span class="wizard-header-title">Settings</span>
          <span></span>
        </div>
        <div class="wizard-body">
          <div class="stat-tile-row">
            ${[
              ["Habits", activeHabits],
              ["Identities", activeIdentities],
              ["Check-ins", checkins.length],
              ["Scorecard", scorecard.length],
            ]
              .map(
                ([label, value]) => `
              <div class="stat-tile">
                <div class="stat-tile-label">${label}</div>
                <div class="stat-tile-value detail-stat-value">${value}</div>
              </div>`
              )
              .join("")}
          </div>

          <div class="card">
            <h2 class="card-title">Preferences</h2>
            <div class="form-section-label">Appearance</div>
            <div class="form-card-row segmented-row">
              <div class="segmented-control segmented-control-3" id="pref-theme-control">
                ${(["system", "light", "dark"] as Theme[])
                  .map(
                    (t) => `
                  <input type="radio" id="pref-theme-${t}" name="pref-theme" value="${t}" ${getPrefs().theme === t ? "checked" : ""} class="segmented-input" />
                  <label for="pref-theme-${t}" class="segmented-label">${t[0]!.toUpperCase()}${t.slice(1)}</label>`
                  )
                  .join("")}
              </div>
            </div>
            <div class="form-card-row toggle-row">
              <span class="row-label">Sound</span>
              <label class="switch">
                <input type="checkbox" id="pref-sound" aria-label="Sound" ${getPrefs().sound ? "checked" : ""} />
                <span class="switch-track"></span>
              </label>
            </div>
            <div class="form-card-row toggle-row">
              <span class="row-label">Haptics</span>
              <label class="switch">
                <input type="checkbox" id="pref-haptics" aria-label="Haptics" ${getPrefs().haptics ? "checked" : ""} />
                <span class="switch-track"></span>
              </label>
            </div>
          </div>

          <div class="card">
            <h2 class="card-title">Reminders</h2>
            ${
              !isNotificationSupported()
                ? `<p class="muted">Reminders aren't supported in this browser.</p>`
                : `<p class="wizard-subtitle">A nudge if you still have habits due today. Only fires while the app is open in a tab or window — it can't wake up a fully closed app.</p>
                   ${
                     getNotificationPermission() !== "granted"
                       ? `<button type="button" class="btn btn-outline btn-block" id="enable-notifications-btn">Enable notifications</button>`
                       : `<div class="form-card-row">
                            <span class="row-label">Remind me at</span>
                            <input type="time" id="reminder-time-input" class="plain-input" value="${getPrefs().reminderTime ?? ""}" />
                          </div>`
                   }`
            }
          </div>

          <div class="card">
            <h2 class="card-title">Manage data</h2>
            <button type="button" class="btn btn-outline btn-block" id="open-archived-btn">
              Archived items (${habits.filter((h) => h.archived).length + identities.filter((i) => i.archived).length})
            </button>
          </div>

          <div class="card">
            <h2 class="card-title">App</h2>
            ${
              isInstallAvailable()
                ? `<button type="button" class="btn btn-outline btn-block" id="install-app-btn">📲 Install app</button>`
                : ""
            }
            <button type="button" class="btn btn-outline btn-block" id="share-progress-btn">Share my progress</button>
            <button type="button" class="btn btn-outline btn-block" id="open-year-review-btn">🎉 Year in Review</button>
          </div>

          <div class="card">
            <h2 class="card-title">Back up your data</h2>
            <p class="wizard-subtitle">Everything is stored only on this device. Copy this text somewhere safe (Notes, email, a cloud doc) — paste it back in anytime to restore.</p>
            <textarea id="export-text" class="backup-textarea" readonly rows="4"></textarea>
            <button type="button" class="btn btn-primary btn-block" id="copy-export-btn">Copy to clipboard</button>
          </div>

          <div class="card">
            <h2 class="card-title">Export check-ins as CSV</h2>
            <p class="wizard-subtitle">A spreadsheet-friendly log of every check-in, for your own analysis elsewhere.</p>
            <textarea id="csv-text" class="backup-textarea" readonly rows="4"></textarea>
            <button type="button" class="btn btn-outline btn-block" id="copy-csv-btn">Copy CSV to clipboard</button>
          </div>

          <div class="card">
            <h2 class="card-title">Import check-ins from CSV</h2>
            <p class="wizard-subtitle">Paste CSV in the same "habit,date,status" format as the export above. Matches rows to your current habits by name and adds those check-ins — existing data isn't touched.</p>
            <textarea id="csv-import-text" class="backup-textarea" rows="4" placeholder="habit,date,status"></textarea>
            <div id="csv-import-error" class="settings-error hidden"></div>
            <div id="csv-import-confirm" class="hidden">
              <p class="settings-warning" id="csv-import-summary"></p>
              <div class="wizard-nav">
                <button type="button" class="btn btn-plain" id="csv-import-cancel">Cancel</button>
                <button type="button" class="btn btn-primary" id="csv-import-confirm-btn">Import</button>
              </div>
            </div>
            <button type="button" class="btn btn-outline btn-block" id="csv-import-review-btn">Review CSV</button>
          </div>

          <div class="card">
            <h2 class="card-title">Restore from backup</h2>
            <p class="wizard-subtitle">Paste a previously exported backup below. This replaces everything currently on this device.</p>
            <textarea id="import-text" class="backup-textarea" rows="4" placeholder="Paste your backup here"></textarea>
            <div id="import-error" class="settings-error hidden"></div>
            <div id="import-confirm" class="hidden">
              <p class="settings-warning">This will permanently replace all current data with the pasted backup. This can't be undone.</p>
              <div class="wizard-nav">
                <button type="button" class="btn btn-plain" id="import-cancel">Cancel</button>
                <button type="button" class="btn btn-primary" id="import-confirm-btn">Replace my data</button>
              </div>
            </div>
            <button type="button" class="btn btn-outline btn-block" id="import-review-btn">Review backup</button>
          </div>

          <div class="card">
            <h2 class="card-title">Danger zone</h2>
            <div id="reset-confirm" class="hidden">
              <p class="settings-warning">This permanently deletes every habit, identity, check-in, and scorecard entry on this device. This can't be undone.</p>
              <div class="wizard-nav">
                <button type="button" class="btn btn-plain" id="reset-cancel">Cancel</button>
                <button type="button" class="btn btn-primary btn-danger-fill" id="reset-confirm-btn">Delete everything</button>
              </div>
            </div>
            <button type="button" class="btn btn-plain btn-danger" id="reset-start-btn">Reset all data</button>
          </div>
        </div>
      </div>
    `;

    container.querySelector("#settings-close")!.addEventListener("click", close);
    container.querySelector(".modal-backdrop")!.addEventListener("click", close);

    // ---- Preferences ----
    const themeControl = container.querySelector<HTMLElement>("#pref-theme-control")!;
    positionSegmentedThumb(themeControl);
    container.querySelectorAll<HTMLInputElement>('input[name="pref-theme"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        setPref("theme", radio.value as Theme);
        positionSegmentedThumb(themeControl);
        hapticTap();
      });
    });
    container.querySelector<HTMLInputElement>("#pref-sound")!.addEventListener("change", (e) => {
      setPref("sound", (e.target as HTMLInputElement).checked);
      hapticTap();
    });
    container.querySelector<HTMLInputElement>("#pref-haptics")!.addEventListener("change", (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      setPref("haptics", checked);
      if (checked) hapticTap();
    });

    // ---- Reminders ----
    container.querySelector("#enable-notifications-btn")?.addEventListener("click", async () => {
      hapticTap();
      await requestNotificationPermission();
      render();
    });
    container.querySelector<HTMLInputElement>("#reminder-time-input")?.addEventListener("change", (e) => {
      const value = (e.target as HTMLInputElement).value;
      setPref("reminderTime", value || null);
      scheduleReminderCheck();
      hapticTap();
    });

    // ---- Manage data ----
    container.querySelector("#open-archived-btn")!.addEventListener("click", () => {
      hapticTap();
      close();
      openArchived();
    });

    // ---- App: install + share ----
    container.querySelector("#install-app-btn")?.addEventListener("click", async () => {
      hapticTap();
      const accepted = await promptInstall();
      if (accepted) showToast("📲", "Installing…");
      render();
    });

    container.querySelector("#open-year-review-btn")!.addEventListener("click", () => {
      hapticTap();
      close();
      openYearInReview();
    });

    container.querySelector("#share-progress-btn")!.addEventListener("click", async () => {
      const text = buildProgressSummary(habits, checkins);
      if (navigator.share) {
        try {
          await navigator.share({ text, title: "My Atomic progress" });
          hapticSuccess();
        } catch {
          // User cancelled the share sheet — not an error.
        }
      } else {
        try {
          await navigator.clipboard.writeText(text);
          hapticSuccess();
          showToast("📋", "Progress copied to clipboard.");
        } catch {
          showToast("📋", "Couldn't share or copy — try again.");
        }
      }
    });

    // ---- Export ----
    exportAllData().then((backup) => {
      const textarea = container.querySelector<HTMLTextAreaElement>("#export-text");
      if (textarea) textarea.value = JSON.stringify(backup, null, 2);
    });

    container.querySelector("#copy-export-btn")!.addEventListener("click", async () => {
      const textarea = container.querySelector<HTMLTextAreaElement>("#export-text")!;
      const btn = container.querySelector<HTMLButtonElement>("#copy-export-btn")!;
      try {
        await navigator.clipboard.writeText(textarea.value);
        hapticSuccess();
        btn.textContent = "Copied ✓";
        setTimeout(() => (btn.textContent = "Copy to clipboard"), 1800);
      } catch {
        textarea.focus();
        textarea.select();
        showToast("📋", "Couldn't auto-copy — text is selected, copy it manually.");
      }
    });

    // ---- CSV export ----
    const csvTextarea = container.querySelector<HTMLTextAreaElement>("#csv-text")!;
    csvTextarea.value = checkinsToCsv(habits, checkins);
    container.querySelector("#copy-csv-btn")!.addEventListener("click", async () => {
      const btn = container.querySelector<HTMLButtonElement>("#copy-csv-btn")!;
      try {
        await navigator.clipboard.writeText(csvTextarea.value);
        hapticSuccess();
        btn.textContent = "Copied ✓";
        setTimeout(() => (btn.textContent = "Copy CSV to clipboard"), 1800);
      } catch {
        csvTextarea.focus();
        csvTextarea.select();
        showToast("📋", "Couldn't auto-copy — text is selected, copy it manually.");
      }
    });

    // ---- CSV import ----
    const csvImportText = container.querySelector<HTMLTextAreaElement>("#csv-import-text")!;
    const csvImportError = container.querySelector<HTMLElement>("#csv-import-error")!;
    const csvImportConfirm = container.querySelector<HTMLElement>("#csv-import-confirm")!;
    const csvImportSummary = container.querySelector<HTMLElement>("#csv-import-summary")!;
    const csvImportReviewBtn = container.querySelector<HTMLButtonElement>("#csv-import-review-btn")!;
    let pendingCsvImport: CsvImportPreview | null = null;

    csvImportReviewBtn.addEventListener("click", () => {
      csvImportError.classList.add("hidden");
      if (!csvImportText.value.trim()) {
        csvImportError.textContent = "Paste some CSV text first.";
        csvImportError.classList.remove("hidden");
        return;
      }
      const preview = previewCsvImport(habits, csvImportText.value);
      if (preview.toApply.length === 0) {
        csvImportError.textContent =
          preview.unmatchedNames.length > 0
            ? `No matching habits found for: ${preview.unmatchedNames.join(", ")}.`
            : "No valid rows found in that CSV.";
        csvImportError.classList.remove("hidden");
        return;
      }
      pendingCsvImport = preview;
      const parts = [`${preview.toApply.length} check-in${preview.toApply.length === 1 ? "" : "s"} will be added.`];
      if (preview.unmatchedNames.length > 0) {
        parts.push(`${preview.unmatchedNames.length} unmatched habit name(s) will be skipped: ${preview.unmatchedNames.join(", ")}.`);
      }
      if (preview.invalidRowCount > 0) {
        parts.push(`${preview.invalidRowCount} row(s) couldn't be parsed and will be skipped.`);
      }
      csvImportSummary.textContent = parts.join(" ");
      csvImportReviewBtn.classList.add("hidden");
      csvImportConfirm.classList.remove("hidden");
    });

    container.querySelector("#csv-import-cancel")!.addEventListener("click", () => {
      pendingCsvImport = null;
      csvImportConfirm.classList.add("hidden");
      csvImportReviewBtn.classList.remove("hidden");
    });

    container.querySelector("#csv-import-confirm-btn")!.addEventListener("click", async () => {
      if (!pendingCsvImport) return;
      await batch(async () => {
        for (const row of pendingCsvImport!.toApply) {
          await setCheckIn(row.habitId, row.date, row.mode);
        }
      });
      hapticSuccess();
      close();
      showToast("✅", `${pendingCsvImport.toApply.length} check-in(s) imported.`);
    });

    // ---- Import / restore ----
    const importText = container.querySelector<HTMLTextAreaElement>("#import-text")!;
    const importError = container.querySelector<HTMLElement>("#import-error")!;
    const importConfirm = container.querySelector<HTMLElement>("#import-confirm")!;
    const importReviewBtn = container.querySelector<HTMLButtonElement>("#import-review-btn")!;
    let pendingBackup: BackupFile | null = null;

    importReviewBtn.addEventListener("click", () => {
      importError.classList.add("hidden");
      let parsed: unknown;
      try {
        parsed = JSON.parse(importText.value);
      } catch {
        importError.textContent = "That doesn't look like valid backup text.";
        importError.classList.remove("hidden");
        return;
      }
      if (!isValidBackup(parsed)) {
        importError.textContent = "That doesn't look like an Atomic backup.";
        importError.classList.remove("hidden");
        return;
      }
      pendingBackup = parsed;
      importReviewBtn.classList.add("hidden");
      importConfirm.classList.remove("hidden");
    });

    container.querySelector("#import-cancel")!.addEventListener("click", () => {
      pendingBackup = null;
      importConfirm.classList.add("hidden");
      importReviewBtn.classList.remove("hidden");
    });

    container.querySelector("#import-confirm-btn")!.addEventListener("click", async () => {
      if (!pendingBackup) return;
      await restoreFromBackup(pendingBackup);
      hapticSuccess();
      close();
      showToast("✅", "Backup restored.");
    });

    // ---- Reset ----
    const resetStartBtn = container.querySelector<HTMLButtonElement>("#reset-start-btn")!;
    const resetConfirm = container.querySelector<HTMLElement>("#reset-confirm")!;
    resetStartBtn.addEventListener("click", () => {
      hapticTap();
      resetStartBtn.classList.add("hidden");
      resetConfirm.classList.remove("hidden");
    });
    container.querySelector("#reset-cancel")!.addEventListener("click", () => {
      resetConfirm.classList.add("hidden");
      resetStartBtn.classList.remove("hidden");
    });
    container.querySelector("#reset-confirm-btn")!.addEventListener("click", async () => {
      await resetAllData();
      close();
      showToast("🗑️", "All data cleared.");
    });

    disposeKeyboard?.();
    disposeKeyboard = enableModalKeyboard(container, close);
  }

  document.body.classList.add("modal-open");
  render();
}
