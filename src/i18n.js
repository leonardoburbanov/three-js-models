/**
 * Tiny EN/ES i18n for the explorer UI and bilingual lesson fields.
 * @typedef {"en"|"es"} Lang
 * @typedef {{ en: string, es: string }} Bilingual
 */

/** @type {Lang} */
export let lang =
  typeof localStorage !== "undefined" && localStorage.getItem("robot-explorer-lang") === "es"
    ? "es"
    : "en";

/**
 * Mark a bilingual string.
 * @param {string} en
 * @param {string} es
 * @returns {Bilingual}
 */
export function b(en, es) {
  return { en, es };
}

/**
 * Resolve a plain or bilingual string for the active language.
 * @param {string | Bilingual | null | undefined} value
 * @returns {string}
 */
export function tx(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return value[lang] ?? value.en ?? "";
}

/** @type {Record<Lang, Record<string, string>>} */
const UI = {
  en: {
    title: "Robot Explorer",
    subtitle: "Reachy Mini + Microduck",
    badge: "OFFICIAL CAD MESHES",
    inspectorEyebrow: "PART INSPECTOR",
    hoverPrompt: "Hover over a robot",
    robot: "Robot",
    parentJoint: "Parent joint",
    jointType: "Joint type",
    hint: "Hover or tap a part to inspect it.",
    lessonEyebrow: "LESSON",
    lesson: "Lesson",
    phaseEllipsis: "Phase…",
    prev: "Prev",
    next: "Next",
    done: "Done",
    learnMore: "Learn more",
    orbitHint: "Drag to orbit · Scroll to zoom",
    tutorial: "Tutorial",
    closeTutorial: "Close tutorial",
    physics: "Physics",
    physicsOn: "Physics on",
    pause: "Pause",
    play: "Play",
    resetView: "Reset view",
    loading: "Loading robot models…",
    challengeOk: "Challenge complete",
    langSwitch: "ES",
    viewportAria: "Interactive 3D robot explorer",
    errorPrefix: "Unable to start the 3D scene: "
  },
  es: {
    title: "Explorador de robots",
    subtitle: "Reachy Mini + Microduck",
    badge: "MALLAS CAD OFICIALES",
    inspectorEyebrow: "INSPECTOR DE PIEZAS",
    hoverPrompt: "Pasa el cursor sobre un robot",
    robot: "Robot",
    parentJoint: "Articulación padre",
    jointType: "Tipo de articulación",
    hint: "Pasa el cursor o toca una pieza para inspeccionarla.",
    lessonEyebrow: "LECCIÓN",
    lesson: "Lección",
    phaseEllipsis: "Fase…",
    prev: "Ant",
    next: "Sig",
    done: "Listo",
    learnMore: "Saber más",
    orbitHint: "Arrastra para orbitar · Rueda para zoom",
    tutorial: "Tutorial",
    closeTutorial: "Cerrar tutorial",
    physics: "Física",
    physicsOn: "Física activa",
    pause: "Pausa",
    play: "Play",
    resetView: "Reset vista",
    loading: "Cargando modelos…",
    challengeOk: "Reto completado",
    langSwitch: "EN",
    viewportAria: "Explorador 3D interactivo de robots",
    errorPrefix: "No se pudo iniciar la escena 3D: "
  }
};

/**
 * Translate a UI string key.
 * @param {string} key
 * @returns {string}
 */
export function t(key) {
  return UI[lang][key] ?? UI.en[key] ?? key;
}

/** @type {Set<(l: Lang) => void>} */
const listeners = new Set();

/**
 * Subscribe to language changes.
 * @param {(l: Lang) => void} fn
 * @returns {() => void}
 */
export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Apply data-i18n / data-i18n-aria attributes on the document.
 */
export function applyDom() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    if (key) el.setAttribute("aria-label", t(key));
  });
  const langBtn = document.querySelector("#lang-toggle");
  if (langBtn) langBtn.textContent = t("langSwitch");
}

/**
 * Switch UI language and notify listeners.
 * @param {Lang} next
 */
export function setLang(next) {
  lang = next === "es" ? "es" : "en";
  try {
    localStorage.setItem("robot-explorer-lang", lang);
  } catch {
    /* ignore */
  }
  applyDom();
  for (const fn of listeners) fn(lang);
}

/** Toggle between English and Spanish. */
export function toggleLang() {
  setLang(lang === "en" ? "es" : "en");
}
