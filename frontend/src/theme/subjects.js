/** Subject themes — CSS-only skin (same routes, different data-subject). */

export const DEFAULT_LOGO = "/logo-zad-altahsili.png";

export const SUBJECT_THEMES = {
  math: {
    key: "math",
    label: "رياضيات",
    logo: "/logo-math.png",
    match: ["رياضيات"],
  },
  physics: {
    key: "physics",
    label: "فيزياء",
    logo: "/logo-physics.png",
    match: ["فيزياء"],
  },
  chem: {
    key: "chem",
    label: "كيمياء",
    logo: "/logo-chem.png",
    match: ["كيمياء"],
  },
  bio: {
    key: "bio",
    label: "أحياء",
    logo: "/logo-bio.png",
    match: ["أحياء"],
  },
};

export function resolveSubjectKey(name = "") {
  const n = String(name);
  for (const theme of Object.values(SUBJECT_THEMES)) {
    if (theme.match.some((m) => n.includes(m))) return theme.key;
  }
  return null;
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
