import { getState, addHabit, saveHabit, archiveHabit } from "../state/store.js";
import { escapeHtml } from "../utils/html.js";
import { WEEKDAY_LABELS } from "../utils/date.js";
function stackDescription(habit, allHabits) {
    const anchor = habit.stackAnchor;
    if (anchor.type === "custom") {
        return anchor.text ? `After ${anchor.text}` : null;
    }
    if (anchor.type === "habit") {
        const anchorHabit = allHabits.find((h) => h.id === anchor.habitId);
        return anchorHabit ? `After "${anchorHabit.name}"` : null;
    }
    return null;
}
function frequencyLabel(f) {
    if (f.type === "daily")
        return "Every day";
    if (f.days.length === 0)
        return "No days selected";
    return f.days.map((d) => WEEKDAY_LABELS[d]).join(", ");
}
function renderChainTree(habit, allHabits, identityLabel, depth) {
    const children = allHabits.filter((h) => !h.archived && h.stackAnchor.type === "habit" && h.stackAnchor.habitId === habit.id);
    const desc = stackDescription(habit, allHabits);
    return `
    <div class="habit-node" style="margin-left: ${depth * 28}px">
      <div class="habit-card">
        <div class="habit-card-head">
          <span class="habit-name">${depth > 0 ? "↳ " : ""}${escapeHtml(habit.name)}</span>
          <span class="pill pill-identity">${escapeHtml(identityLabel(habit.identityId))}</span>
        </div>
        ${desc ? `<div class="habit-stack-desc muted">${escapeHtml(desc)}</div>` : ""}
        <div class="habit-four-laws">
          <div><span class="law-tag">Obvious</span> ${escapeHtml(habit.cue) || "—"}</div>
          <div><span class="law-tag">Attractive</span> ${escapeHtml(habit.craving) || "—"}</div>
          <div><span class="law-tag">Easy</span> ${escapeHtml(habit.response) || "—"}</div>
          <div><span class="law-tag">Satisfying</span> ${escapeHtml(habit.reward) || "—"}</div>
        </div>
        <div class="habit-card-foot">
          <span class="muted">${frequencyLabel(habit.frequency)}</span>
          ${habit.twoMinuteVersion ? `<span class="pill pill-two-min">2-min: ${escapeHtml(habit.twoMinuteVersion)}</span>` : ""}
          <div class="identity-actions">
            <button class="btn btn-plain" data-edit="${habit.id}">Edit</button>
            <button class="btn btn-plain btn-danger" data-archive-habit="${habit.id}">Archive</button>
          </div>
        </div>
      </div>
      ${children.map((c) => renderChainTree(c, allHabits, identityLabel, depth + 1)).join("")}
    </div>
  `;
}
export function renderHabits(container) {
    const { habits, identities } = getState();
    const activeHabits = habits.filter((h) => !h.archived);
    const activeIdentities = identities.filter((i) => !i.archived);
    const identityLabel = (id) => {
        if (!id)
            return "no identity";
        const found = activeIdentities.find((i) => i.id === id);
        return found ? found.statement : "no identity";
    };
    // Roots = habits not chained after another still-active habit (so a chain
    // renders as a tree; if the anchor habit was archived, this falls back to root).
    const trueRoots = activeHabits.filter((h) => {
        const anchor = h.stackAnchor;
        if (anchor.type !== "habit")
            return true;
        return !activeHabits.some((p) => p.id === anchor.habitId);
    });
    const prefillIdentity = sessionStorage.getItem("prefill-identity");
    if (prefillIdentity)
        sessionStorage.removeItem("prefill-identity");
    container.innerHTML = `
    <section class="view">
      <header class="view-header">
        <h1>Habits</h1>
        <p class="view-subtitle">Design each habit with the Four Laws, scale it down with the 2-minute rule, and stack it onto something you already do.</p>
      </header>

      <form id="habit-form" class="form-card">
        <input type="hidden" name="editingId" value="" />

        <div class="form-card-row">
          <span class="row-label">Habit name</span>
          <input type="text" name="name" class="plain-input" required maxlength="80" placeholder="Read before bed" />
        </div>
        <div class="form-card-row">
          <span class="row-label">Identity vote</span>
          <select name="identityId" class="plain-select">
            <option value="">No identity</option>
            ${activeIdentities
        .map((i) => `<option value="${i.id}" ${prefillIdentity === i.id ? "selected" : ""}>I am ${escapeHtml(i.statement)}</option>`)
        .join("")}
          </select>
        </div>

        <div class="form-section-label">Frequency</div>
        <div class="form-card-row segmented-row">
          <div class="segmented-control">
            <input type="radio" id="freq-daily" name="freqType" value="daily" checked class="segmented-input" />
            <label for="freq-daily" class="segmented-label">Every day</label>
            <input type="radio" id="freq-weekdays" name="freqType" value="weekdays" class="segmented-input" />
            <label for="freq-weekdays" class="segmented-label">Specific days</label>
          </div>
        </div>
        <div id="weekday-picker" class="form-card-row weekday-picker hidden">
          ${WEEKDAY_LABELS.map((label, i) => `
            <input type="checkbox" id="weekday-${i}" name="weekday" value="${i}" class="chip-input" />
            <label for="weekday-${i}" class="weekday-chip">${label}</label>`).join("")}
        </div>

        <div class="form-section-label">The Four Laws</div>
        <div class="form-card-row">
          <span class="row-label">1. Make it Obvious — cue</span>
          <input type="text" name="cue" class="plain-input" placeholder="My phone is on the nightstand at 9pm" />
        </div>
        <div class="form-card-row">
          <span class="row-label">2. Make it Attractive — craving</span>
          <input type="text" name="craving" class="plain-input" placeholder="I get to unwind before sleep" />
        </div>
        <div class="form-card-row">
          <span class="row-label">3. Make it Easy — response</span>
          <input type="text" name="response" class="plain-input" placeholder="Read one page" />
        </div>
        <div class="form-card-row">
          <span class="row-label">4. Make it Satisfying — reward</span>
          <input type="text" name="reward" class="plain-input" placeholder="Check it off, feel proud" />
        </div>
        <div class="form-card-row">
          <span class="row-label">2-minute version (Law 3, taken further)</span>
          <input type="text" name="twoMinuteVersion" class="plain-input" placeholder="Read one sentence" />
        </div>

        <div class="form-section-label">Habit stacking — "After [ANCHOR], I will [this habit]."</div>
        <div class="form-card-row segmented-row">
          <div class="segmented-control segmented-control-3">
            <input type="radio" id="stack-none" name="stackType" value="none" checked class="segmented-input" />
            <label for="stack-none" class="segmented-label">None</label>
            <input type="radio" id="stack-habit" name="stackType" value="habit" class="segmented-input" />
            <label for="stack-habit" class="segmented-label">A habit</label>
            <input type="radio" id="stack-custom" name="stackType" value="custom" class="segmented-input" />
            <label for="stack-custom" class="segmented-label">Custom</label>
          </div>
        </div>
        <div id="stack-detail-row" class="form-card-row hidden">
          <select id="stack-habit-select" name="stackHabitId" class="plain-select hidden">
            ${activeHabits.map((h) => `<option value="${h.id}">${escapeHtml(h.name)}</option>`).join("")}
          </select>
          <input id="stack-custom-input" type="text" name="stackCustom" class="plain-input hidden" placeholder="I pour my morning coffee" />
        </div>

        <div class="form-card-row form-actions">
          <button type="submit" class="btn btn-primary btn-block" id="habit-submit-btn">Add habit</button>
          <button type="button" class="btn btn-plain hidden" id="habit-cancel-edit">Cancel edit</button>
        </div>
      </form>

      <div class="habit-list">
        ${trueRoots.length === 0
        ? `<div class="empty-state">No habits yet. Create your first one above.</div>`
        : trueRoots.map((h) => renderChainTree(h, activeHabits, identityLabel, 0)).join("")}
      </div>
    </section>
  `;
    wireHabitForm(container, habits);
}
function wireHabitForm(container, allHabits) {
    const form = container.querySelector("#habit-form");
    const weekdayPicker = container.querySelector("#weekday-picker");
    const stackDetailRow = container.querySelector("#stack-detail-row");
    const stackHabitSelect = container.querySelector("#stack-habit-select");
    const stackCustomInput = container.querySelector("#stack-custom-input");
    const submitBtn = container.querySelector("#habit-submit-btn");
    const cancelBtn = container.querySelector("#habit-cancel-edit");
    const editingIdInput = form.elements.namedItem("editingId");
    form.querySelectorAll('input[name="freqType"]').forEach((radio) => {
        radio.addEventListener("change", () => {
            weekdayPicker.classList.toggle("hidden", radio.value !== "weekdays" || !radio.checked);
        });
    });
    form.querySelectorAll('input[name="stackType"]').forEach((radio) => {
        radio.addEventListener("change", () => {
            stackHabitSelect.classList.toggle("hidden", !(radio.value === "habit" && radio.checked));
            stackCustomInput.classList.toggle("hidden", !(radio.value === "custom" && radio.checked));
            stackDetailRow.classList.toggle("hidden", radio.value === "none" || !radio.checked);
        });
    });
    function resetForm() {
        form.reset();
        editingIdInput.value = "";
        weekdayPicker.classList.add("hidden");
        stackDetailRow.classList.add("hidden");
        stackHabitSelect.classList.add("hidden");
        stackCustomInput.classList.add("hidden");
        submitBtn.textContent = "Add habit";
        cancelBtn.classList.add("hidden");
    }
    cancelBtn.addEventListener("click", resetForm);
    function loadHabitIntoForm(habit) {
        editingIdInput.value = habit.id;
        form.elements.namedItem("name").value = habit.name;
        form.elements.namedItem("identityId").value = habit.identityId ?? "";
        form.elements.namedItem("cue").value = habit.cue;
        form.elements.namedItem("craving").value = habit.craving;
        form.elements.namedItem("response").value = habit.response;
        form.elements.namedItem("reward").value = habit.reward;
        form.elements.namedItem("twoMinuteVersion").value = habit.twoMinuteVersion;
        const freqRadio = form.querySelector(`input[name="freqType"][value="${habit.frequency.type}"]`);
        if (freqRadio)
            freqRadio.checked = true;
        weekdayPicker.classList.toggle("hidden", habit.frequency.type !== "weekdays");
        if (habit.frequency.type === "weekdays") {
            form.querySelectorAll('input[name="weekday"]').forEach((cb) => {
                cb.checked = habit.frequency.type === "weekdays" && habit.frequency.days.includes(Number(cb.value));
            });
        }
        const stackRadio = form.querySelector(`input[name="stackType"][value="${habit.stackAnchor.type}"]`);
        if (stackRadio)
            stackRadio.checked = true;
        stackHabitSelect.classList.toggle("hidden", habit.stackAnchor.type !== "habit");
        stackCustomInput.classList.toggle("hidden", habit.stackAnchor.type !== "custom");
        stackDetailRow.classList.toggle("hidden", habit.stackAnchor.type === "none");
        if (habit.stackAnchor.type === "habit")
            stackHabitSelect.value = habit.stackAnchor.habitId;
        if (habit.stackAnchor.type === "custom")
            stackCustomInput.value = habit.stackAnchor.text;
        submitBtn.textContent = "Save changes";
        cancelBtn.classList.remove("hidden");
        form.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    container.querySelectorAll("[data-edit]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const habit = allHabits.find((h) => h.id === btn.dataset["edit"]);
            if (habit)
                loadHabitIntoForm(habit);
        });
    });
    container.querySelectorAll("[data-archive-habit]").forEach((btn) => {
        btn.addEventListener("click", () => archiveHabit(btn.dataset["archiveHabit"]));
    });
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const name = String(fd.get("name") ?? "").trim();
        if (!name)
            return;
        const freqType = String(fd.get("freqType"));
        const frequency = freqType === "weekdays"
            ? { type: "weekdays", days: fd.getAll("weekday").map((v) => Number(v)) }
            : { type: "daily" };
        const stackType = String(fd.get("stackType"));
        const stackAnchor = stackType === "habit"
            ? { type: "habit", habitId: String(fd.get("stackHabitId")) }
            : stackType === "custom"
                ? { type: "custom", text: String(fd.get("stackCustom") ?? "").trim() }
                : { type: "none" };
        const identityIdRaw = String(fd.get("identityId") ?? "");
        const input = {
            name,
            identityId: identityIdRaw || null,
            frequency,
            cue: String(fd.get("cue") ?? "").trim(),
            craving: String(fd.get("craving") ?? "").trim(),
            response: String(fd.get("response") ?? "").trim(),
            reward: String(fd.get("reward") ?? "").trim(),
            twoMinuteVersion: String(fd.get("twoMinuteVersion") ?? "").trim(),
            stackAnchor,
        };
        const editingId = editingIdInput.value;
        if (editingId) {
            const existing = allHabits.find((h) => h.id === editingId);
            if (existing) {
                saveHabit({ ...existing, ...input });
            }
        }
        else {
            addHabit(input);
        }
        resetForm();
    });
}
//# sourceMappingURL=habits.js.map