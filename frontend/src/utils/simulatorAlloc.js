/** Subject question-count allocation (Task 23) — mirrors backend simulator_alloc. */

export const SUBJECT_RATIOS = { math: 30, bio: 30, chem: 25, phys: 25 };
export const SUBJECT_FIXED = { math: 30, bio: 30, chem: 25, phys: 25 };
export const TIE_BREAK_ORDER = ["math", "bio", "chem", "phys"];

const LABELS = {
  math: "رياضيات",
  bio: "أحياء",
  chem: "كيمياء",
  phys: "فيزياء",
};

export function subjectRatioKey(subject) {
  if (!subject) return null;
  const theme = String(subject.theme_key || "").trim().toLowerCase();
  if (theme in SUBJECT_RATIOS) return theme;
  if (theme === "physics") return "phys";
  const name = String(subject.name || subject.subject_name || "").toLowerCase();
  if (/رياض|math/.test(name)) return "math";
  if (/أحياء|احياء|bio/.test(name)) return "bio";
  if (/كيم|chem/.test(name)) return "chem";
  if (/فيز|phys/.test(name)) return "phys";
  return null;
}

export function allocateByRatio(keys, n) {
  const clean = keys.filter((k) => k in SUBJECT_RATIOS);
  if (!clean.length || n < 1) return Object.fromEntries(clean.map((k) => [k, 0]));
  if (clean.length === 1) return { [clean[0]]: n };
  const weights = Object.fromEntries(clean.map((k) => [k, SUBJECT_RATIOS[k]]));
  const totalW = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const raw = Object.fromEntries(clean.map((k) => [k, (n * weights[k]) / totalW]));
  const floors = Object.fromEntries(clean.map((k) => [k, Math.floor(raw[k])]));
  let rem = n - Object.values(floors).reduce((a, b) => a + b, 0);
  const tieRank = Object.fromEntries(TIE_BREAK_ORDER.map((k, i) => [k, i]));
  const order = [...clean].sort((a, b) => {
    const fa = raw[a] - floors[a];
    const fb = raw[b] - floors[b];
    if (fb !== fa) return fb - fa;
    return (tieRank[a] ?? 99) - (tieRank[b] ?? 99);
  });
  const out = { ...floors };
  for (let i = 0; i < rem; i += 1) out[order[i % order.length]] += 1;
  return out;
}

export function allocateFixed(keys) {
  return Object.fromEntries(
    keys.filter((k) => k in SUBJECT_FIXED).map((k) => [k, SUBJECT_FIXED[k]])
  );
}

export function formatAllocation(alloc) {
  return TIE_BREAK_ORDER.filter((k) => alloc[k] > 0)
    .map((k) => `${LABELS[k] || k} ${alloc[k]}`)
    .join(" · ");
}

export function allocationForSubjects(subjects, countMode, count) {
  const keys = subjects.map(subjectRatioKey).filter(Boolean);
  if (countMode === "per_subject") return allocateFixed(keys);
  if (countMode === "all") return null;
  return allocateByRatio(keys, count);
}
