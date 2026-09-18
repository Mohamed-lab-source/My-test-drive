import { getState, addHabit, saveHabit, archiveHabit } from "../state/store.js";
import { escapeHtml } from "../utils/html.js";
import { WEEKDAY_LABELS } from "../utils/date.js";
import type { Habit, Frequency, StackAnchor, Weekday } from "../domain/types.js";
import type { NewHabitInput } from "../db/repo.js";

function stackDescription(habit: Habit, allHabits: Habit[]): string | null {
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

function frequencyLabel(f: Frequency): string {
  if (f.type === "daily") return "Every day";
  if (f.days.length === 0) return "No days selected";
  return f.days.map((d) => WEEKDAY_LABELS[d]).join(", ");
}

function renderChainTree(
  habit: Habit,
  allHabits: Habit[],
  identityLabel: (id: string | null) => string,
  depth: number
): string {
  const children = allHabits.filter(
    (h) => !h.archived && h.stackAnchor.type === "habit" && h.stackAnchor.habitId === habit.id
  );
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
            <button class="btn btn-link" data-edit="${habit.id}">edit</button>
            <button class="btn btn-link btn-danger" data-archive-habit="${habit.id}">archive</button>
          </div>
        </div>
      </div>
      ${children.map((c) => renderChainTree(c, allHabits, identityLabel, depth + 1)).join("")}
    </div>
  `;
}

export function renderHabits(container: HTMLElement): void {
  const { habits, identities } = getState();
  const activeHabits = habits.filter((h) => !h.archived);
  const activeIdentities = identities.filter((i) => !i.archived);

  const identityLabel = (id: string | null): string => {
    if (!id) return "no identity";
    const found = activeIdentities.find((i) => i.id === id);
    return found ? found.statement : "no identity";
  };

  // Roots = habits not chained after another still-active habit (so a chain
  // renders as a tree; if the anchor habit was archived, this falls back to root).
  const trueRoots = activeHabits.filter((h) => {
    const anchor = h.stackAnchor;
    if (anchor.type !== "habit") return true;
    return !activeHabits.some((p) => p.id === anchor.habitId);
  });

  const prefillIdentity = sessionStorage.getItem("prefill-identity");
  if (prefillIdentity) sessionStorage.removeItem("prefill-identity");

  container.innerHTML = `
    <section class="view">
      <header class="view-header">
        <h1>Habits</h1>
        <p class="view-subtitle">Design each habit with the Four Laws, scale it down with the 2-minute rule, and stack it onto something you already do.</p>
      </header>

      <form id="habit-form" class="card habit-form">
        <input type="hidden" name="editingId" value="" />

        <div class="form-row">
          <label>Habit name
            <input type="text" name="name" required maxlength="80" placeholder="Read before bed" />
          </label>
          <label>Identity vote
            <select name="identityId">
              <option value="">No identity</option>
              ${activeIdentities
                .map(
                  (i) =>
                    `<option value="${i.id}" ${prefillIdentity === i.id ? "selected" : ""}>I am ${escapeHtml(i.statement)}</option>`
                )
                .join("")}
            </select>
          </label>
        </div>

        <fieldset class="form-row">
          <legend>Frequency</legend>
          <label class="radio-label"><input type="radio" name="freqType" value="daily" checked /> Every day</label>
          <label class="radio-label"><input type="radio" name="freqType" value="weekdays" /> Specific days</label>
          <div id="weekday-picker" class="weekday-picker hidden">
            ${WEEKDAY_LABELS.map(
              (label, i) => `
              <label class="weekday-chip">
                <input type="checkbox" name="weekday" value="${i}" /> ${label}
              </label>`
            ).join("")}
          </div>
        </fieldset>

        <div class="form-row four-laws-grid">
          <label>1. Make it Obvious — cue
            <input type="text" name="cue" placeholder="My phone is on the nightstand at 9pm" />
          </label>
          <label>2. Make it Attractive — craving
            <input type="text" name="craving" placeholder="I get to unwind before sleep" />
          </label>
          <label>3. Make it Easy — response
            <input type="text" name="response" placeholder="Read one page" />
          </label>
          <label>4. Make it Satisfying — reward
            <input type="text" name="reward" placeholder="Check it off, feel proud" />
          </label>
        </div>

        <div class="form-row">
          <label>2-minute version (Law 3, taken further)
            <input type="text" name="twoMinuteVersion" placeholder="Read one sentence" />
          </label>
        </div>

        <fieldset class="form-row">
          <legend>Habit stacking — "After [ANCHOR], I will [this habit]."</legend>
          <label class="radio-label"><input type="radio" name="stackType" value="none" checked /> No anchor</label>
          <label class="radio-label"><input type="radio" name="stackType" value="habit" /> After an existing habit</label>
          <label class="radio-label"><input type="radio" name="stackType" value="custom" /> After something custom</label>

          <select id="stack-habit-select" name="stackHabitId" class="hidden">
            ${activeHabits.map((h) => `<option value="${h.id}">${escapeHtml(h.name)}</option>`).join("")}
          </select>
          <input id="stack-custom-input" type="text" name="stackCustom" class="hidden" placeholder="I pour my morning coffee" />
        </fieldset>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary" id="habit-submit-btn">Add habit</button>
          <button type="button" class="btn btn-link hidden" id="habit-cancel-edit">Cancel edit</button>
        </div>
      </form>

      <div class="habit-list">
        ${
          trueRoots.length === 0
            ? `<div class="empty-state">No habits yet. Create your first one above.</div>`
            : trueRoots.map((h) => renderChainTree(h, activeHabits, identityLabel, 0)).join("")
        }
      </div>
    </section>
  `;

  wireHabitForm(container, habits);
}

function wireHabitForm(container: HTMLElement, allHabits: Habit[]): void {
  const form = container.querySelector<HTMLFormElement>("#habit-form")!;
  const weekdayPicker = container.querySelector<HTMLDivElement>("#weekday-picker")!;
  const stackHabitSelect = container.querySelector<HTMLSelectElement>("#stack-habit-select")!;
  const stackCustomInput = container.querySelector<HTMLInputElement>("#stack-custom-input")!;
  const submitBtn = container.querySelector<HTMLButtonElement>("#habit-submit-btn")!;
  const cancelBtn = container.querySelector<HTMLButtonElement>("#habit-cancel-edit")!;
  const editingIdInput = form.elements.namedItem("editingId") as HTMLInputElement;

  form.querySelectorAll<HTMLInputElement>('input[name="freqType"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      weekdayPicker.classList.toggle("hidden", radio.value !== "weekdays" || !radio.checked);
    });
  });

  form.querySelectorAll<HTMLInputElement>('input[name="stackType"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      stackHabitSelect.classList.toggle("hidden", !(radio.value === "habit" && radio.checked));
      stackCustomInput.classList.toggle("hidden", !(radio.value === "custom" && radio.checked));
    });
  });

  function resetForm(): void {
    form.reset();
    editingIdInput.value = "";
    weekdayPicker.classList.add("hidden");
    stackHabitSelect.classList.add("hidden");
    stackCustomInput.classList.add("hidden");
    submitBtn.textContent = "Add habit";
    cancelBtn.classList.add("hidden");
  }

  cancelBtn.addEventListener("click", resetForm);

  function loadHabitIntoForm(habit: Habit): void {
    editingIdInput.value = habit.id;
    (form.elements.namedItem("name") as HTMLInputElement).value = habit.name;
    (form.elements.namedItem("identityId") as HTMLSelectElement).value = habit.identityId ?? "";
    (form.elements.namedItem("cue") as HTMLInputElement).value = habit.cue;
    (form.elements.namedItem("craving") as HTMLInputElement).value = habit.craving;
    (form.elements.namedItem("response") as HTMLInputElement).value = habit.response;
    (form.elements.namedItem("reward") as HTMLInputElement).value = habit.reward;
    (form.elements.namedItem("twoMinuteVersion") as HTMLInputElement).value = habit.twoMinuteVersion;

    const freqRadio = form.querySelector<HTMLInputElement>(
      `input[name="freqType"][value="${habit.frequency.type}"]`
    );
    if (freqRadio) freqRadio.checked = true;
    weekdayPicker.classList.toggle("hidden", habit.frequency.type !== "weekdays");
    if (habit.frequency.type === "weekdays") {
      form.querySelectorAll<HTMLInputElement>('input[name="weekday"]').forEach((cb) => {
        cb.checked = habit.frequency.type === "weekdays" && habit.frequency.days.includes(Number(cb.value) as Weekday);
      });
    }

    const stackRadio = form.querySelector<HTMLInputElement>(
      `input[name="stackType"][value="${habit.stackAnchor.type}"]`
    );
    if (stackRadio) stackRadio.checked = true;
    stackHabitSelect.classList.toggle("hidden", habit.stackAnchor.type !== "habit");
    stackCustomInput.classList.toggle("hidden", habit.stackAnchor.type !== "custom");
    if (habit.stackAnchor.type === "habit") stackHabitSelect.value = habit.stackAnchor.habitId;
    if (habit.stackAnchor.type === "custom") stackCustomInput.value = habit.stackAnchor.text;

    submitBtn.textContent = "Save changes";
    cancelBtn.classList.remove("hidden");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  container.querySelectorAll<HTMLButtonElement>("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const habit = allHabits.find((h) => h.id === btn.dataset["edit"]);
      if (habit) loadHabitIntoForm(habit);
    });
  });

  container.querySelectorAll<HTMLButtonElement>("[data-archive-habit]").forEach((btn) => {
    btn.addEventListener("click", () => archiveHabit(btn.dataset["archiveHabit"]!));
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) return;

    const freqType = String(fd.get("freqType"));
    const frequency: Frequency =
      freqType === "weekdays"
        ? { type: "weekdays", days: fd.getAll("weekday").map((v) => Number(v) as Weekday) }
        : { type: "daily" };

    const stackType = String(fd.get("stackType"));
    const stackAnchor: StackAnchor =
      stackType === "habit"
        ? { type: "habit", habitId: String(fd.get("stackHabitId")) }
        : stackType === "custom"
        ? { type: "custom", text: String(fd.get("stackCustom") ?? "").trim() }
        : { type: "none" };

    const identityIdRaw = String(fd.get("identityId") ?? "");

    const input: NewHabitInput = {
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
    } else {
      addHabit(input);
    }
    resetForm();
  });
}
