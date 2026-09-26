import { getState, addHabit, saveHabit } from "../state/store.js";
import { escapeHtml } from "../utils/html.js";
import { WEEKDAY_LABELS } from "../utils/date.js";
import { HABIT_TEMPLATES, ICON_CHOICES } from "../domain/templates.js";
import { celebrate, hapticSuccess, hapticTap } from "../confetti.js";
import { positionSegmentedThumb } from "../segmented.js";
import { animateModalClose, enableModalKeyboard } from "../modal.js";
import { findHabitById } from "../domain/analytics.js";
import type { Habit, Frequency, StackAnchor, Weekday, TimeOfDay } from "../domain/types.js";

interface WizardState {
  name: string;
  icon: string;
  identityId: string;
  freqType: "daily" | "weekdays";
  weekdays: Set<Weekday>;
  timeOfDay: TimeOfDay;
  cue: string;
  craving: string;
  response: string;
  reward: string;
  twoMinuteVersion: string;
  stackType: "none" | "habit" | "custom";
  stackHabitId: string;
  stackCustom: string;
  tags: string;
}

function blankState(): WizardState {
  return {
    name: "",
    icon: "⭐",
    identityId: "",
    freqType: "daily",
    weekdays: new Set(),
    timeOfDay: "anytime",
    cue: "",
    craving: "",
    response: "",
    reward: "",
    twoMinuteVersion: "",
    stackType: "none",
    stackHabitId: "",
    stackCustom: "",
    tags: "",
  };
}

/**
 * Would setting `anchorId` as the stack anchor for `editingId` create a
 * cycle (A after B, B after A, or a longer loop)? Walks up the chain of
 * anchors starting at `anchorId`; if it ever reaches `editingId`, stacking
 * there would close a loop. New habits (no `editingId` yet) can never be
 * part of an existing chain, so they're always safe.
 */
function wouldCreateCycle(anchorId: string, editingId: string | undefined, habits: Habit[]): boolean {
  if (!editingId) return false;
  let cursor: string | undefined = anchorId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === editingId) return true;
    if (seen.has(cursor)) return false;
    seen.add(cursor);
    const h = findHabitById(habits, cursor);
    cursor = h && h.stackAnchor.type === "habit" ? h.stackAnchor.habitId : undefined;
  }
  return false;
}

function stateFromHabit(habit: Habit): WizardState {
  return {
    name: habit.name,
    icon: habit.icon || "⭐",
    identityId: habit.identityId ?? "",
    freqType: habit.frequency.type,
    weekdays: new Set(habit.frequency.type === "weekdays" ? habit.frequency.days : []),
    timeOfDay: habit.timeOfDay ?? "anytime",
    cue: habit.cue,
    craving: habit.craving,
    response: habit.response,
    reward: habit.reward,
    twoMinuteVersion: habit.twoMinuteVersion,
    stackType: habit.stackAnchor.type,
    stackHabitId: habit.stackAnchor.type === "habit" ? habit.stackAnchor.habitId : "",
    stackCustom: habit.stackAnchor.type === "custom" ? habit.stackAnchor.text : "",
    tags: habit.tags.join(", "),
  };
}

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

export interface WizardOptions {
  editHabit?: Habit;
  identityId?: string;
  /** Prefill from this habit but create a brand new one — used by the "Duplicate" action. */
  duplicateFrom?: Habit;
}

export function openHabitWizard(options: WizardOptions = {}): void {
  const { editHabit, identityId, duplicateFrom } = options;
  const container = getRoot();
  const editing = !!editHabit;
  const state = editing
    ? stateFromHabit(editHabit)
    : duplicateFrom
    ? { ...stateFromHabit(duplicateFrom), name: `${duplicateFrom.name} copy` }
    : blankState();
  if (!editing && identityId) state.identityId = identityId;
  const skipTemplate = editing || !!duplicateFrom;
  const steps = skipTemplate ? ["name", "when", "stick", "review"] : ["template", "name", "when", "stick", "review"];
  let step = 0;
  let disposeKeyboard: (() => void) | null = null;

  function close(): void {
    disposeKeyboard?.();
    disposeKeyboard = null;
    animateModalClose(container, () => {
      container.innerHTML = "";
      document.body.classList.remove("modal-open");
    });
  }

  function frequency(): Frequency {
    return state.freqType === "weekdays"
      ? { type: "weekdays", days: Array.from(state.weekdays) }
      : { type: "daily" };
  }

  function stackAnchor(): StackAnchor {
    if (state.stackType === "habit" && state.stackHabitId) {
      return { type: "habit", habitId: state.stackHabitId };
    }
    if (state.stackType === "custom" && state.stackCustom.trim()) {
      return { type: "custom", text: state.stackCustom.trim() };
    }
    return { type: "none" };
  }

  function mount(): void {
    container.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-sheet" role="dialog" aria-modal="true">
        <div class="modal-sheet-handle"></div>
        <div class="wizard-header">
          <button type="button" class="icon-btn" id="wizard-close" aria-label="Close">&times;</button>
          <div class="wizard-progress" id="wizard-progress"></div>
          <span class="wizard-step-count" id="wizard-step-count"></span>
        </div>
        <div class="wizard-body" id="wizard-body"></div>
      </div>
    `;
    container.querySelector("#wizard-close")!.addEventListener("click", close);
    container.querySelector(".modal-backdrop")!.addEventListener("click", close);
    updateStep(false);
  }

  function updateStep(animateForward = true): void {
    const stepName = steps[step]!;
    const total = steps.length;
    container.querySelector("#wizard-progress")!.innerHTML = steps
      .map((_, i) => `<span class="wizard-dot ${i === step ? "active" : i < step ? "done" : ""}"></span>`)
      .join("");
    container.querySelector("#wizard-step-count")!.textContent = `${step + 1}/${total}`;

    const body = container.querySelector<HTMLElement>("#wizard-body")!;
    body.classList.remove("step-enter-fwd", "step-enter-back");
    // Force reflow so the animation class re-triggers even for the same class on rapid nav.
    void body.offsetWidth;
    renderStep(stepName, body);
    body.classList.add(animateForward ? "step-enter-fwd" : "step-enter-back");

    disposeKeyboard?.();
    disposeKeyboard = enableModalKeyboard(container, close);
  }

  function goTo(newStep: number): void {
    hapticTap();
    const forward = newStep > step;
    step = Math.max(0, Math.min(steps.length - 1, newStep));
    updateStep(forward);
  }

  function renderStep(name: string, body: HTMLElement): void {
    if (name === "template") return renderTemplateStep(body);
    if (name === "name") return renderNameStep(body);
    if (name === "when") return renderWhenStep(body);
    if (name === "stick") return renderStickStep(body);
    renderReviewStep(body);
  }

  // ---- Step: template picker ----

  function renderTemplateStep(body: HTMLElement): void {
    body.innerHTML = `
      <h2 class="wizard-title">What do you want to build?</h2>
      <p class="wizard-subtitle">Pick a starting point — you can change everything after.</p>
      <div class="template-grid">
        ${HABIT_TEMPLATES.map(
          (t, i) => `
          <button type="button" class="template-tile" data-template="${i}">
            <span class="template-icon">${t.icon}</span>
            <span class="template-name">${escapeHtml(t.name)}</span>
          </button>`
        ).join("")}
        <button type="button" class="template-tile template-tile-custom" id="template-custom">
          <span class="template-icon">✨</span>
          <span class="template-name">Custom habit</span>
        </button>
      </div>
    `;
    body.querySelectorAll<HTMLButtonElement>("[data-template]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const t = HABIT_TEMPLATES[Number(btn.dataset["template"])]!;
        state.name = t.name;
        state.icon = t.icon;
        state.cue = t.cue;
        state.craving = t.craving;
        state.response = t.response;
        state.reward = t.reward;
        state.twoMinuteVersion = t.twoMinuteVersion;
        goTo(step + 1);
      });
    });
    body.querySelector("#template-custom")!.addEventListener("click", () => goTo(step + 1));
  }

  // ---- Step: name + icon ----

  function renderNameStep(body: HTMLElement): void {
    body.innerHTML = `
      <h2 class="wizard-title">Name it</h2>
      <p class="wizard-subtitle">What's the habit called?</p>
      <div class="icon-preview">${state.icon}</div>
      <input type="text" id="wizard-name" class="wizard-big-input" maxlength="80" placeholder="Read before bed" value="${escapeHtml(state.name)}" />
      <div class="icon-picker" role="group" aria-label="Choose an icon">
        ${ICON_CHOICES.map(
          (icon) =>
            `<button type="button" class="icon-choice ${icon === state.icon ? "selected" : ""}" data-icon="${icon}" aria-label="Icon ${icon}" aria-pressed="${icon === state.icon}">${icon}</button>`
        ).join("")}
      </div>
      ${wizardNav({ canBack: step > 0, nextLabel: "Next", nextEnabled: state.name.trim().length > 0 })}
    `;
    const nameInput = body.querySelector<HTMLInputElement>("#wizard-name")!;
    const nextBtn = body.querySelector<HTMLButtonElement>("#wizard-next")!;
    nameInput.addEventListener("input", () => {
      state.name = nameInput.value;
      nextBtn.disabled = state.name.trim().length === 0;
    });
    body.querySelectorAll<HTMLButtonElement>("[data-icon]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.icon = btn.dataset["icon"]!;
        body.querySelectorAll(".icon-choice").forEach((b) => {
          b.classList.remove("selected");
          b.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("selected");
        btn.setAttribute("aria-pressed", "true");
        body.querySelector(".icon-preview")!.textContent = state.icon;
        hapticTap();
      });
    });
    wireNav(body, () => state.name.trim().length > 0);
    requestAnimationFrame(() => nameInput.focus());
  }

  // ---- Step: when & why (identity, frequency, stacking) ----

  function renderWhenStep(body: HTMLElement): void {
    const { identities, habits } = getState();
    const activeIdentities = identities.filter((i) => !i.archived);
    const otherHabits = habits.filter((h) => !h.archived && h.id !== editHabit?.id);
    const stackableHabits = otherHabits.filter((h) => !wouldCreateCycle(h.id, editHabit?.id, habits));
    // If the currently-set anchor would now be invalid (e.g. reachable state
    // from data made before cycle prevention existed), don't silently keep it.
    if (state.stackType === "habit" && state.stackHabitId && !stackableHabits.some((h) => h.id === state.stackHabitId)) {
      state.stackHabitId = "";
    }

    body.innerHTML = `
      <h2 class="wizard-title">When & why</h2>
      <p class="wizard-subtitle">Optional context that makes the habit stick.</p>

      <div class="form-card">
        <div class="form-card-row">
          <span class="row-label">Identity vote</span>
          <select id="wizard-identity" class="plain-select">
            <option value="">No identity</option>
            ${activeIdentities
              .map((i) => `<option value="${i.id}" ${i.id === state.identityId ? "selected" : ""}>I am ${escapeHtml(i.statement)}</option>`)
              .join("")}
          </select>
        </div>

        <div class="form-section-label">Frequency</div>
        <div class="form-card-row segmented-row">
          <div class="segmented-control" id="wizard-freq-control">
            <input type="radio" id="w-freq-daily" name="w-freq" value="daily" ${state.freqType === "daily" ? "checked" : ""} class="segmented-input" />
            <label for="w-freq-daily" class="segmented-label">Every day</label>
            <input type="radio" id="w-freq-weekdays" name="w-freq" value="weekdays" ${state.freqType === "weekdays" ? "checked" : ""} class="segmented-input" />
            <label for="w-freq-weekdays" class="segmented-label">Specific days</label>
          </div>
        </div>
        <div id="wizard-weekday-picker" class="form-card-row weekday-picker ${state.freqType === "weekdays" ? "" : "hidden"}">
          ${WEEKDAY_LABELS.map(
            (label, i) => `
            <input type="checkbox" id="w-weekday-${i}" class="chip-input" data-weekday="${i}" ${state.weekdays.has(i as Weekday) ? "checked" : ""} />
            <label for="w-weekday-${i}" class="weekday-chip">${label}</label>`
          ).join("")}
        </div>

        <div class="form-section-label">Time of day</div>
        <div class="form-card-row segmented-row">
          <div class="segmented-control segmented-control-4" id="wizard-time-control">
            ${(["anytime", "morning", "afternoon", "evening"] as TimeOfDay[])
              .map(
                (t) => `
              <input type="radio" id="w-time-${t}" name="w-time" value="${t}" ${state.timeOfDay === t ? "checked" : ""} class="segmented-input" />
              <label for="w-time-${t}" class="segmented-label">${t[0]!.toUpperCase()}${t.slice(1)}</label>`
              )
              .join("")}
          </div>
        </div>

        <div class="form-section-label">Habit stacking</div>
        <div class="form-card-row segmented-row">
          <div class="segmented-control segmented-control-3" id="wizard-stack-control">
            <input type="radio" id="w-stack-none" name="w-stack" value="none" ${state.stackType === "none" ? "checked" : ""} class="segmented-input" />
            <label for="w-stack-none" class="segmented-label">None</label>
            <input type="radio" id="w-stack-habit" name="w-stack" value="habit" ${state.stackType === "habit" ? "checked" : ""} class="segmented-input" />
            <label for="w-stack-habit" class="segmented-label">A habit</label>
            <input type="radio" id="w-stack-custom" name="w-stack" value="custom" ${state.stackType === "custom" ? "checked" : ""} class="segmented-input" />
            <label for="w-stack-custom" class="segmented-label">Custom</label>
          </div>
        </div>
        <div id="wizard-stack-detail" class="form-card-row ${state.stackType === "none" ? "hidden" : ""}">
          ${
            stackableHabits.length === 0
              ? `<p class="muted stack-empty-note ${state.stackType === "habit" ? "" : "hidden"}" id="wizard-stack-empty">No other habits available to stack after${otherHabits.length > 0 ? " without creating a loop" : ""}.</p>`
              : ""
          }
          <select id="wizard-stack-habit" class="plain-select ${state.stackType === "habit" && stackableHabits.length > 0 ? "" : "hidden"}">
            ${stackableHabits.map((h) => `<option value="${h.id}" ${h.id === state.stackHabitId ? "selected" : ""}>${escapeHtml(h.icon)} ${escapeHtml(h.name)}</option>`).join("")}
          </select>
          <input id="wizard-stack-custom" type="text" class="plain-input ${state.stackType === "custom" ? "" : "hidden"}" placeholder="I pour my morning coffee" value="${escapeHtml(state.stackCustom)}" />
        </div>
      </div>

      ${wizardNav({ canBack: true, nextLabel: "Next", nextEnabled: true })}
    `;

    body.querySelector<HTMLSelectElement>("#wizard-identity")!.addEventListener("change", (e) => {
      state.identityId = (e.target as HTMLSelectElement).value;
    });

    const weekdayPicker = body.querySelector<HTMLElement>("#wizard-weekday-picker")!;
    body.querySelectorAll<HTMLInputElement>('input[name="w-freq"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        state.freqType = radio.value as "daily" | "weekdays";
        weekdayPicker.classList.toggle("hidden", state.freqType !== "weekdays");
        positionSegmentedThumb(body.querySelector("#wizard-freq-control")!);
      });
    });
    body.querySelectorAll<HTMLInputElement>("[data-weekday]").forEach((cb) => {
      cb.addEventListener("change", () => {
        const day = Number(cb.dataset["weekday"]) as Weekday;
        if (cb.checked) state.weekdays.add(day);
        else state.weekdays.delete(day);
      });
    });

    body.querySelectorAll<HTMLInputElement>('input[name="w-time"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        state.timeOfDay = radio.value as TimeOfDay;
        positionSegmentedThumb(body.querySelector("#wizard-time-control")!);
      });
    });

    const stackHabitSelect = body.querySelector<HTMLSelectElement>("#wizard-stack-habit")!;
    const stackCustomInput = body.querySelector<HTMLInputElement>("#wizard-stack-custom")!;
    const stackDetailRow = body.querySelector<HTMLElement>("#wizard-stack-detail")!;
    const stackEmptyNote = body.querySelector<HTMLElement>("#wizard-stack-empty");
    body.querySelectorAll<HTMLInputElement>('input[name="w-stack"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        state.stackType = radio.value as "none" | "habit" | "custom";
        stackDetailRow.classList.toggle("hidden", state.stackType === "none");
        stackHabitSelect.classList.toggle("hidden", state.stackType !== "habit" || stackableHabits.length === 0);
        stackCustomInput.classList.toggle("hidden", state.stackType !== "custom");
        stackEmptyNote?.classList.toggle("hidden", state.stackType !== "habit");
        positionSegmentedThumb(body.querySelector("#wizard-stack-control")!);
      });
    });
    stackHabitSelect.addEventListener("change", () => (state.stackHabitId = stackHabitSelect.value));
    stackCustomInput.addEventListener("input", () => (state.stackCustom = stackCustomInput.value));

    wireNav(body, () => true);
    positionSegmentedThumb(body.querySelector("#wizard-freq-control")!);
    positionSegmentedThumb(body.querySelector("#wizard-time-control")!);
    positionSegmentedThumb(body.querySelector("#wizard-stack-control")!);
  }

  // ---- Step: make it stick (four laws + 2-min) ----

  function renderStickStep(body: HTMLElement): void {
    body.innerHTML = `
      <h2 class="wizard-title">Make it stick</h2>
      <p class="wizard-subtitle">Optional — the Four Laws of Behavior Change. Skip anytime.</p>

      <div class="form-card">
        <div class="form-card-row">
          <span class="row-label">1. Make it Obvious — cue</span>
          <input type="text" id="w-cue" class="plain-input" placeholder="My phone is on the nightstand at 9pm" value="${escapeHtml(state.cue)}" />
        </div>
        <div class="form-card-row">
          <span class="row-label">2. Make it Attractive — craving</span>
          <input type="text" id="w-craving" class="plain-input" placeholder="I get to unwind before sleep" value="${escapeHtml(state.craving)}" />
        </div>
        <div class="form-card-row">
          <span class="row-label">3. Make it Easy — response</span>
          <input type="text" id="w-response" class="plain-input" placeholder="Read one page" value="${escapeHtml(state.response)}" />
        </div>
        <div class="form-card-row">
          <span class="row-label">4. Make it Satisfying — reward</span>
          <input type="text" id="w-reward" class="plain-input" placeholder="Check it off, feel proud" value="${escapeHtml(state.reward)}" />
        </div>
        <div class="form-card-row">
          <span class="row-label">2-minute version</span>
          <input type="text" id="w-two-min" class="plain-input" placeholder="Read one sentence" value="${escapeHtml(state.twoMinuteVersion)}" />
        </div>
        <div class="form-card-row">
          <span class="row-label">Tags</span>
          <input type="text" id="w-tags" class="plain-input" placeholder="health, morning" value="${escapeHtml(state.tags)}" />
        </div>
      </div>

      ${wizardNav({ canBack: true, nextLabel: "Review", nextEnabled: true })}
    `;
    const bind = (id: string, key: keyof WizardState) => {
      const el = body.querySelector<HTMLInputElement>(`#${id}`)!;
      el.addEventListener("input", () => {
        (state[key] as string) = el.value;
      });
    };
    bind("w-cue", "cue");
    bind("w-craving", "craving");
    bind("w-response", "response");
    bind("w-reward", "reward");
    bind("w-two-min", "twoMinuteVersion");
    bind("w-tags", "tags");
    wireNav(body, () => true);
  }

  // ---- Step: review ----

  function renderReviewStep(body: HTMLElement): void {
    const { identities, habits } = getState();
    const identityLabel = identities.find((i) => i.id === state.identityId)?.statement;
    const anchor = stackAnchor();
    const anchorLabel =
      anchor.type === "habit"
        ? `After "${findHabitById(habits, anchor.habitId)?.name ?? "…"}"`
        : anchor.type === "custom"
        ? `After ${anchor.text}`
        : null;
    const freqLabel =
      state.freqType === "daily"
        ? "Every day"
        : Array.from(state.weekdays)
            .sort()
            .map((d) => WEEKDAY_LABELS[d])
            .join(", ") || "No days selected";

    body.innerHTML = `
      <h2 class="wizard-title">Review</h2>
      <div class="review-card">
        <div class="review-icon">${state.icon}</div>
        <div class="review-name">${escapeHtml(state.name)}</div>
        ${identityLabel ? `<div class="pill pill-identity">I am ${escapeHtml(identityLabel)}</div>` : ""}
        <div class="review-line">${freqLabel}${state.timeOfDay !== "anytime" ? ` · ${state.timeOfDay[0]!.toUpperCase()}${state.timeOfDay.slice(1)}` : ""}</div>
        ${anchorLabel ? `<div class="review-line muted">${escapeHtml(anchorLabel)}</div>` : ""}
        ${state.twoMinuteVersion ? `<div class="pill pill-two-min">2-min: ${escapeHtml(state.twoMinuteVersion)}</div>` : ""}
        ${
          state.tags.trim()
            ? `<div class="review-tags">${state.tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
                .map((t) => `<span class="pill pill-tag">${escapeHtml(t)}</span>`)
                .join("")}</div>`
            : ""
        }
      </div>
      ${wizardNav({ canBack: true, nextLabel: editing ? "Save Changes" : "Create Habit", nextEnabled: true, primary: true })}
    `;
    const nextBtn = body.querySelector<HTMLButtonElement>("#wizard-next")!;
    nextBtn.addEventListener("click", async () => {
      nextBtn.disabled = true;
      const input = {
        name: state.name.trim(),
        icon: state.icon,
        identityId: state.identityId || null,
        frequency: frequency(),
        timeOfDay: state.timeOfDay,
        cue: state.cue.trim(),
        craving: state.craving.trim(),
        response: state.response.trim(),
        reward: state.reward.trim(),
        twoMinuteVersion: state.twoMinuteVersion.trim(),
        stackAnchor: stackAnchor(),
        tags: state.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };
      if (editing && editHabit) {
        await saveHabit({ ...editHabit, ...input });
      } else {
        await addHabit(input);
      }
      hapticSuccess();
      celebrate(nextBtn);
      nextBtn.textContent = editing ? "Saved ✓" : "Created ✓";
      setTimeout(close, 650);
    });
    body.querySelector<HTMLButtonElement>("#wizard-back")?.addEventListener("click", () => goTo(step - 1));
  }

  // ---- Shared nav / thumb helpers ----

  function wizardNav(opts: { canBack: boolean; nextLabel: string; nextEnabled: boolean; primary?: boolean }): string {
    return `
      <div class="wizard-nav">
        ${opts.canBack ? `<button type="button" class="btn btn-plain" id="wizard-back">Back</button>` : "<span></span>"}
        <button type="button" class="btn btn-primary" id="wizard-next" ${opts.nextEnabled ? "" : "disabled"}>${opts.nextLabel}</button>
      </div>
    `;
  }

  function wireNav(body: HTMLElement, canAdvance: () => boolean): void {
    body.querySelector<HTMLButtonElement>("#wizard-back")?.addEventListener("click", () => goTo(step - 1));
    const nextBtn = body.querySelector<HTMLButtonElement>("#wizard-next");
    if (nextBtn && nextBtn.id === "wizard-next" && steps[step] !== "review") {
      nextBtn.addEventListener("click", () => {
        if (canAdvance()) goTo(step + 1);
      });
    }
  }

  document.body.classList.add("modal-open");
  mount();
}
