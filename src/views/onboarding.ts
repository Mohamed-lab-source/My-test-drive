import { hapticTap } from "../confetti.js";

const STORAGE_KEY = "atomic-onboarded";

export function shouldShowOnboarding(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "1";
  } catch {
    return false;
  }
}

interface Slide {
  icon: string;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    icon: "⚛️",
    title: "Atomic",
    body: "Small habits, compounded. Every check-in here is a 1% improvement — tiny, and remarkable over time.",
  },
  {
    icon: "🗳️",
    title: "Every action is a vote",
    body: "Define who you want to become — \"a healthy person,\" \"a writer\" — then link habits to it. Each check-in casts a vote for that identity.",
  },
  {
    icon: "🎯",
    title: "The Four Laws",
    body: "Every habit you build here captures a cue, a craving, a response, and a reward — the four levers that make behavior change stick.",
  },
  {
    icon: "⏱️",
    title: "Start absurdly small",
    body: "Every habit gets a 2-minute version. \"Read before bed\" becomes \"read one page.\" Showing up beats doing it perfectly.",
  },
];

export function renderOnboarding(onComplete: () => void): void {
  let root = document.getElementById("modal-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "modal-root";
    document.body.appendChild(root);
  }

  let slide = 0;

  function finish(): void {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // storage unavailable — proceed anyway
    }
    root!.innerHTML = "";
    document.body.classList.remove("modal-open");
    onComplete();
  }

  function render(): void {
    const s = SLIDES[slide]!;
    const isLast = slide === SLIDES.length - 1;
    root!.innerHTML = `
      <div class="onboarding-screen">
        <button type="button" class="onboarding-skip" id="onboarding-skip">Skip</button>
        <div class="onboarding-content">
          <div class="onboarding-icon">${s.icon}</div>
          <h1 class="onboarding-title">${s.title}</h1>
          <p class="onboarding-body">${s.body}</p>
        </div>
        <div class="onboarding-footer">
          <div class="wizard-progress">
            ${SLIDES.map((_, i) => `<span class="wizard-dot ${i === slide ? "active" : i < slide ? "done" : ""}"></span>`).join("")}
          </div>
          <button type="button" class="btn btn-primary btn-block" id="onboarding-next">${isLast ? "Get Started" : "Next"}</button>
        </div>
      </div>
    `;
    root!.querySelector("#onboarding-skip")!.addEventListener("click", finish);
    root!.querySelector("#onboarding-next")!.addEventListener("click", () => {
      hapticTap();
      if (isLast) {
        finish();
      } else {
        slide++;
        render();
      }
    });
  }

  document.body.classList.add("modal-open");
  render();
}
