import { getState, exportAllData, isValidBackup, restoreFromBackup, resetAllData } from "../state/store.js";
import { hapticSuccess, hapticTap } from "../confetti.js";
import { getPrefs, setPref } from "../prefs.js";
import { checkinsToCsv } from "../csv.js";
import { showToast } from "../toast.js";
let root = null;
function getRoot() {
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
export function openSettings() {
    const container = getRoot();
    function close() {
        container.innerHTML = "";
        document.body.classList.remove("modal-open");
    }
    function render() {
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
            .map(([label, value]) => `
              <div class="stat-tile">
                <div class="stat-tile-label">${label}</div>
                <div class="stat-tile-value detail-stat-value">${value}</div>
              </div>`)
            .join("")}
          </div>

          <div class="card">
            <h2 class="card-title">Preferences</h2>
            <div class="form-card-row toggle-row">
              <span class="row-label">Sound</span>
              <label class="switch">
                <input type="checkbox" id="pref-sound" ${getPrefs().sound ? "checked" : ""} />
                <span class="switch-track"></span>
              </label>
            </div>
            <div class="form-card-row toggle-row">
              <span class="row-label">Haptics</span>
              <label class="switch">
                <input type="checkbox" id="pref-haptics" ${getPrefs().haptics ? "checked" : ""} />
                <span class="switch-track"></span>
              </label>
            </div>
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
        container.querySelector("#settings-close").addEventListener("click", close);
        container.querySelector(".modal-backdrop").addEventListener("click", close);
        // ---- Preferences ----
        container.querySelector("#pref-sound").addEventListener("change", (e) => {
            setPref("sound", e.target.checked);
            hapticTap();
        });
        container.querySelector("#pref-haptics").addEventListener("change", (e) => {
            const checked = e.target.checked;
            setPref("haptics", checked);
            if (checked)
                hapticTap();
        });
        // ---- Export ----
        exportAllData().then((backup) => {
            const textarea = container.querySelector("#export-text");
            if (textarea)
                textarea.value = JSON.stringify(backup, null, 2);
        });
        container.querySelector("#copy-export-btn").addEventListener("click", async () => {
            const textarea = container.querySelector("#export-text");
            const btn = container.querySelector("#copy-export-btn");
            try {
                await navigator.clipboard.writeText(textarea.value);
                hapticSuccess();
                btn.textContent = "Copied ✓";
                setTimeout(() => (btn.textContent = "Copy to clipboard"), 1800);
            }
            catch {
                textarea.focus();
                textarea.select();
                showToast("📋", "Couldn't auto-copy — text is selected, copy it manually.");
            }
        });
        // ---- CSV export ----
        const csvTextarea = container.querySelector("#csv-text");
        csvTextarea.value = checkinsToCsv(habits, checkins);
        container.querySelector("#copy-csv-btn").addEventListener("click", async () => {
            const btn = container.querySelector("#copy-csv-btn");
            try {
                await navigator.clipboard.writeText(csvTextarea.value);
                hapticSuccess();
                btn.textContent = "Copied ✓";
                setTimeout(() => (btn.textContent = "Copy CSV to clipboard"), 1800);
            }
            catch {
                csvTextarea.focus();
                csvTextarea.select();
                showToast("📋", "Couldn't auto-copy — text is selected, copy it manually.");
            }
        });
        // ---- Import / restore ----
        const importText = container.querySelector("#import-text");
        const importError = container.querySelector("#import-error");
        const importConfirm = container.querySelector("#import-confirm");
        const importReviewBtn = container.querySelector("#import-review-btn");
        let pendingBackup = null;
        importReviewBtn.addEventListener("click", () => {
            importError.classList.add("hidden");
            let parsed;
            try {
                parsed = JSON.parse(importText.value);
            }
            catch {
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
        container.querySelector("#import-cancel").addEventListener("click", () => {
            pendingBackup = null;
            importConfirm.classList.add("hidden");
            importReviewBtn.classList.remove("hidden");
        });
        container.querySelector("#import-confirm-btn").addEventListener("click", async () => {
            if (!pendingBackup)
                return;
            await restoreFromBackup(pendingBackup);
            hapticSuccess();
            close();
            showToast("✅", "Backup restored.");
        });
        // ---- Reset ----
        const resetStartBtn = container.querySelector("#reset-start-btn");
        const resetConfirm = container.querySelector("#reset-confirm");
        resetStartBtn.addEventListener("click", () => {
            hapticTap();
            resetStartBtn.classList.add("hidden");
            resetConfirm.classList.remove("hidden");
        });
        container.querySelector("#reset-cancel").addEventListener("click", () => {
            resetConfirm.classList.add("hidden");
            resetStartBtn.classList.remove("hidden");
        });
        container.querySelector("#reset-confirm-btn").addEventListener("click", async () => {
            await resetAllData();
            close();
            showToast("🗑️", "All data cleared.");
        });
    }
    document.body.classList.add("modal-open");
    render();
}
//# sourceMappingURL=settings.js.map