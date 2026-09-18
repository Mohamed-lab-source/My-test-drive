import { getState, addHabit, saveHabit } from "../state/store.js";
import { escapeHtml } from "../utils/html.js";
import { WEEKDAY_LABELS } from "../utils/date.js";
import { HABIT_TEMPLATES, ICON_CHOICES } from "../domain/templates.js";
import { celebrate, hapticSuccess, hapticTap } from "../confetti.js";
import type { Habit, Frequency, StackAnchor, Weekday } from "../domain/types.js";

interface WizardState {
  name: string;
  icon: string;
  identityId: string;
  freqType: "daily" | "weekdays";
  weekdays: Set<Weekday>;
  cue: string;
  craving: string;
  response: string;
  reward: string;
  twoMinuteVersion: string;
  stackType: "none" | "habit" | "custom";
  stackHabitId: string;
  stackCustom: string;
}

function blankState(): WizardState {
  return {
    name: "",
    icon: "⭐",
    identityId: "",
    freqType: "daily",
    weekdays: new Set(),
    cue: "",
    craving: "",
    response: "",
    reward: "",
    twoMinuteVersion: "",
    stackType: "none",
    stackHabitId: "",
    stackCustom: "",
  };
}

function stateFromHabit(habit: Habit): WizardState {
  return {
    name: habit.name,
    icon: habit.icon || "⭐",
    identityId: habit.identityId ?? "",
    freqType: habit.frequency.type,
    weekdays: new Set(habit.frequency.type === "weekdays" ? habit.frequency.days : []),
    cue: habit.cue,
    craving: habit.craving,
    response: habit.response,
    reward: habit.reward,
    twoMinuteVersion: habit.twoMinuteVersion,
    stackType: habit.stackAnchor.type,
    stackHabitId: habit.stackAnchor.type === "habit" ? habit.stackAnchor.habitId : "",
    stackCustom: habit.stackAnchor.type === "custom" ? habit.stackAnchor.text : "",
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
}

export function openHabitWizard(options: WizardOptions = {}): void {
  const { editHabit, identityId } = options;
  const container = getRoot();
  const editing = !!editHabit;
  const state = editing ? stateFromHabit(editHabit) : blankState();
  if (!editing && identityId) state.identityId = identityId;
  const steps = editing ? ["name", "when", "stick", "review"] : ["template", "name", "when", "stick", "review"];
  let step = 0;

  function close(): void {
    container.innerHTML = "";
    document.body.classList.remove("modal-open");
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
      <div class="icon-picker">
        ${ICON_CHOICES.map(
          (icon) => `<button type="button" class="icon-choice ${icon === state.icon ? "selected" : ""}" data-icon="${icon}">${icon}</button>`
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
        body.querySelectorAll(".icon-choice").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
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
          <select id="wizard-stack-habit" class="plain-select ${state.stackType === "habit" ? "" : "hidden"}">
            ${otherHabits.map((h) => `<option value="${h.id}" ${h.id === state.stackHabitId ? "selected" : ""}>${escapeHtml(h.icon)} ${escapeHtml(h.name)}</option>`).join("")}
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
        positionThumb(body.querySelector("#wizard-freq-control")!);
      });
    });
    body.querySelectorAll<HTMLInputElement>("[data-weekday]").forEach((cb) => {
      cb.addEventListener("change", () => {
        const day = Number(cb.dataset["weekday"]) as Weekday;
        if (cb.checked) state.weekdays.add(day);
        else state.weekdays.delete(day);
      });
    });

    const stackHabitSelect = body.querySelector<HTMLSelectElement>("#wizard-stack-habit")!;
    const stackCustomInput = body.querySelector<HTMLInputElement>("#wizard-stack-custom")!;
    const stackDetailRow = body.querySelector<HTMLElement>("#wizard-stack-detail")!;
    body.querySelectorAll<HTMLInputElement>('input[name="w-stack"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        state.stackType = radio.value as "none" | "habit" | "custom";
        stackDetailRow.classList.toggle("hidden", state.stackType === "none");
        stackHabitSelect.classList.toggle("hidden", state.stackType !== "habit");
        stackCustomInput.classList.toggle("hidden", state.stackType !== "custom");
        positionThumb(body.querySelector("#wizard-stack-control")!);
      });
    });
    stackHabitSelect.addEventListener("change", () => (state.stackHabitId = stackHabitSelect.value));
    stackCustomInput.addEventListener("input", () => (state.stackCustom = stackCustomInput.value));

    wireNav(body, () => true);
    positionThumb(body.querySelector("#wizard-freq-control")!);
    positionThumb(body.querySelector("#wizard-stack-control")!);
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
    wireNav(body, () => true);
  }

  // ---- Step: review ----

  function renderReviewStep(body: HTMLElement): void {
    const { identities, habits } = getState();
    const identityLabel = identities.find((i) => i.id === state.identityId)?.statement;
    const anchor = stackAnchor();
    const anchorLabel =
      anchor.type === "habit"
        ? `After "${habits.find((h) => h.id === anchor.habitId)?.name ?? "…"}"`
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
        <div class="review-line">${freqLabel}</div>
        ${anchorLabel ? `<div class="review-line muted">${escapeHtml(anchorLabel)}</div>` : ""}
        ${state.twoMinuteVersion ? `<div class="pill pill-two-min">2-min: ${escapeHtml(state.twoMinuteVersion)}</div>` : ""}
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
        cue: state.cue.trim(),
        craving: state.craving.trim(),
        response: state.response.trim(),
        reward: state.reward.trim(),
        twoMinuteVersion: state.twoMinuteVersion.trim(),
        stackAnchor: stackAnchor(),
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

  function positionThumb(control: HTMLElement | null): void {
    if (!control) return;
    const inputs = Array.from(control.querySelectorAll<HTMLInputElement>(".segmented-input"));
    const index = Math.max(0, inputs.findIndex((i) => i.checked));
    control.style.setProperty("--segment-count", String(inputs.length));
    control.style.setProperty("--segment-index", String(index));
  }

  document.body.classList.add("modal-open");
  mount();
}
