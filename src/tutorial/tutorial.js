import { LESSONS } from "./lessons.js";
import { t, tx, onLangChange, lang } from "../i18n.js";

/**
 * Mount the interactive tutorial panel and wire it to the robot API.
 * @param {object} api robot control surface from main.js
 */
export function initTutorial(api) {
  const panel = document.querySelector("#tutorial");
  const toggle = document.querySelector("#tutorial-toggle");
  const titleEl = document.querySelector("#tutorial-title");
  const bodyEl = document.querySelector("#tutorial-body");
  const slidersEl = document.querySelector("#tutorial-sliders");
  const presetsEl = document.querySelector("#tutorial-presets");
  const challengeEl = document.querySelector("#tutorial-challenge");
  const gaitEl = document.querySelector("#tutorial-gait");
  const notesLink = document.querySelector("#tutorial-notes");
  const prevBtn = document.querySelector("#tutorial-prev");
  const nextBtn = document.querySelector("#tutorial-next");
  const stepLabel = document.querySelector("#tutorial-step");

  if (!panel || !toggle) return;

  let index = 0;
  let active = false;
  /** @type {Record<string, HTMLInputElement>} */
  const sliderInputs = {};

  /**
   * @param {boolean} on
   */
  function setActive(on) {
    active = on;
    panel.hidden = !on;
    toggle.setAttribute("aria-pressed", String(on));
    toggle.textContent = on ? t("closeTutorial") : t("tutorial");

    if (on) {
      api.setTutorialMode(true);
      api.pauseIdle();
      api.resetPose();
      renderLesson();
    } else {
      api.clearHighlight();
      api.setGaitDemo(false);
      api.setTutorialMode(false);
      api.resetPose();
      api.resumeIdle();
    }
  }

  /**
   * Rebuild panel contents for the current lesson index.
   */
  function renderLesson() {
    const lesson = LESSONS[index];
    titleEl.textContent = tx(lesson.title);
    bodyEl.textContent = tx(lesson.body);
    notesLink.href = lesson.notesPath;
    stepLabel.textContent = `${index + 1} / ${LESSONS.length}`;
    prevBtn.disabled = index === 0;
    prevBtn.textContent = t("prev");
    notesLink.textContent = t("learnMore");

    api.resetPose();
    api.clearHighlight();
    api.setGaitDemo(false);

    if (lesson.robot === "reachy") api.focusRobot("reachy");
    else if (lesson.robot === "microduck") api.focusRobot("microduck");
    else api.focusRobot("both");

    if (lesson.highlightNames?.length) {
      api.highlightByName(lesson.highlightNames);
    }

    slidersEl.innerHTML = "";
    presetsEl.innerHTML = "";
    Object.keys(sliderInputs).forEach((k) => delete sliderInputs[k]);

    for (const slider of lesson.sliders || []) {
      const row = document.createElement("label");
      row.className = "tutorial-slider";
      const caption = document.createElement("span");
      caption.className = "tutorial-slider-label";
      const valueEl = document.createElement("strong");
      valueEl.textContent = "0°";
      const label = tx(slider.label);
      caption.append(label, " ", valueEl);

      const input = document.createElement("input");
      input.type = "range";
      input.min = String(slider.min);
      input.max = String(slider.max);
      input.step = String(slider.step ?? 1);
      input.value = "0";
      input.setAttribute("aria-label", label);

      input.addEventListener("input", () => {
        const deg = Number(input.value);
        valueEl.textContent = `${deg}°`;
        let rad = (deg * Math.PI) / 180;
        if (lesson.tinyHeadLook && slider.id === "head") {
          rad = Math.max(-0.14, Math.min(0.14, rad));
        }
        api.setJoint(slider.id, rad);
        updateChallenge();
      });

      row.append(caption, input);
      slidersEl.append(row);
      sliderInputs[slider.id] = input;
    }

    for (const preset of lesson.presets || []) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tutorial-preset";
      btn.textContent = tx(preset.label);
      btn.addEventListener("click", () => {
        for (const [id, deg] of Object.entries(preset.joints)) {
          api.setJoint(id, (deg * Math.PI) / 180);
          if (sliderInputs[id]) {
            sliderInputs[id].value = String(deg);
            const strong = sliderInputs[id].parentElement?.querySelector("strong");
            if (strong) strong.textContent = `${deg}°`;
          }
        }
        updateChallenge();
      });
      presetsEl.append(btn);
    }

    gaitEl.hidden = !lesson.showGait;
    if (lesson.showGait) {
      api.setGaitDemo(true);
    }

    updateChallenge();
  }

  /**
   * Enable Next when the optional challenge is satisfied.
   */
  function updateChallenge() {
    const lesson = LESSONS[index];
    const isLast = index >= LESSONS.length - 1;

    if (!lesson.challenge) {
      challengeEl.hidden = true;
      nextBtn.disabled = isLast;
      nextBtn.textContent = isLast ? t("done") : t("next");
      return;
    }

    challengeEl.hidden = false;
    const { jointId, targetDeg, toleranceDeg, hint } = lesson.challenge;
    const deg = api.getJointDegrees(jointId);
    const ok = Math.abs(deg - targetDeg) <= toleranceDeg;
    challengeEl.textContent = ok
      ? `${t("challengeOk")} (${deg.toFixed(0)}°).`
      : `${tx(hint)} — ${deg.toFixed(0)}°`;
    challengeEl.classList.toggle("ok", ok);
    nextBtn.disabled = isLast || !ok;
    nextBtn.textContent = isLast ? t("done") : t("next");
  }

  toggle.addEventListener("click", () => setActive(!active));
  prevBtn.addEventListener("click", () => {
    if (index > 0) {
      index -= 1;
      renderLesson();
    }
  });
  nextBtn.addEventListener("click", () => {
    if (index < LESSONS.length - 1) {
      index += 1;
      renderLesson();
    } else {
      setActive(false);
    }
  });

  onLangChange(() => {
    toggle.textContent = active ? t("closeTutorial") : t("tutorial");
    if (active) renderLesson();
  });

  // Gait phase readout while demo runs
  const phaseEl = document.querySelector("#tutorial-phase");
  api.onFrame(() => {
    if (!active || !LESSONS[index].showGait || !phaseEl) return;
    const phase = api.getGaitPhase();
    phaseEl.textContent =
      lang === "es"
        ? `Fase izq. ωt = ${phase.toFixed(2)} rad  ·  Der. = ${(phase + Math.PI).toFixed(2)}`
        : `Left phase ωt = ${phase.toFixed(2)} rad  ·  Right = ${(phase + Math.PI).toFixed(2)}`;
  });
}
