/** Subject themes — CSS-only skin (same routes, different data-subject). */

export const DEFAULT_LOGO = "/maram-real.png";

const LOCK_KEY = "zad_locked_subject_theme";
export const SUBJECT_THEME_EVENT = "zad-subject-theme";

export const SUBJECT_THEMES = {
  math: {
    key: "math",
    label: "رياضيات",
    logo: "/subjects/math.png",
    color: "var(--math-c)",
    dark: "var(--math-dark)",
    soft: "var(--math-light)",
    match: ["رياضيات", "رياضة"],
  },
  physics: {
    key: "physics",
    label: "فيزياء",
    logo: "/subjects/physics.png",
    color: "var(--physics-c)",
    dark: "var(--physics-dark)",
    soft: "var(--physics-light)",
    match: ["فيزياء"],
  },
  chem: {
    key: "chem",
    label: "كيمياء",
    logo: "/subjects/chem.png",
    color: "var(--chem-c)",
    dark: "var(--chem-dark)",
    soft: "var(--chem-light)",
    match: ["كيمياء"],
  },
  bio: {
    key: "bio",
    label: "أحياء",
    logo: "/subjects/bio.png",
    color: "var(--bio-c)",
    dark: "var(--bio-dark)",
    soft: "var(--bio-light)",
    match: ["أحياء"],
  },
  /** Multi-subject personal simulator — blue skin */
  multi: {
    key: "multi",
    label: "عدة مواد",
    logo: DEFAULT_LOGO,
    color: "var(--blue)",
    dark: "var(--navy)",
    soft: "var(--primary-light)",
    match: ["عدة مواد"],
  },
};

function notifyThemeChange(key) {
  try {
    window.dispatchEvent(new CustomEvent(SUBJECT_THEME_EVENT, { detail: { key } }));
  } catch {
    /* ignore */
  }
}

const SLUG_THEME = {
  math: "math",
  physics: "physics",
  phys: "physics",
  chemistry: "chem",
  chem: "chem",
  biology: "bio",
  bio: "bio",
};

export function subjectClass(key) {
  if (key === "physics" || key === "phys") return "s-phys";
  if (key === "chem" || key === "chemistry") return "s-chem";
  if (key === "bio" || key === "biology") return "s-bio";
  if (key === "math") return "s-math";
  return "s-brand";
}

export function resolveSubjectKey(nameOrSubject = "") {
  if (nameOrSubject && typeof nameOrSubject === "object") {
    const themeKey = nameOrSubject.theme_key || nameOrSubject.subject_theme_key || "";
    if (SUBJECT_THEMES[themeKey]) return themeKey;
    const slug = String(nameOrSubject.slug || "").toLowerCase();
    if (SLUG_THEME[slug]) return SLUG_THEME[slug];
    return resolveSubjectKey(nameOrSubject.name || nameOrSubject.subject_name || "");
  }
  const n = String(nameOrSubject);
  for (const theme of Object.values(SUBJECT_THEMES)) {
    if (theme.key === "multi") continue;
    if (theme.match.some((m) => n.includes(m))) return theme.key;
  }
  return null;
}

/** Theme for an exam: blue when questions span more than one subject. */
export function resolveExamThemeKey(exam, questions = []) {
  const names = new Set();
  for (const q of questions || []) {
    if (q?.subject_name) names.add(String(q.subject_name).trim());
  }
  if (names.size > 1) return "multi";
  if (names.size === 1) return resolveSubjectKey([...names][0]);
  return resolveSubjectKey(exam?.subject_name || "");
}

export function getSubjectTheme(key) {
  return key ? SUBJECT_THEMES[key] || null : null;
}

export function applySubjectTheme(key) {
  const root = document.documentElement;
  if (key && SUBJECT_THEMES[key]) {
    root.dataset.subject = key;
  } else {
    delete root.dataset.subject;
  }
}

export function clearSubjectTheme() {
  delete document.documentElement.dataset.subject;
}

/** Keep subject skin across /exam and /results (Layout has no subjectId in URL). */
export function lockSubjectTheme(key) {
  if (key && SUBJECT_THEMES[key]) {
    try {
      sessionStorage.setItem(LOCK_KEY, key);
    } catch {
      /* ignore */
    }
    applySubjectTheme(key);
    notifyThemeChange(key);
  } else {
    unlockSubjectTheme();
  }
}

export function unlockSubjectTheme() {
  try {
    sessionStorage.removeItem(LOCK_KEY);
  } catch {
    /* ignore */
  }
  notifyThemeChange(null);
}

export function peekLockedTheme() {
  try {
    const key = sessionStorage.getItem(LOCK_KEY);
    return key && SUBJECT_THEMES[key] ? key : null;
  } catch {
    return null;
  }
}
