/** Helpers for teacher subject / group scoping on the frontend. */

export function isStaffEditor(user) {
  return user?.role === "teacher" || user?.role === "admin";
}

/** Subjects this teacher may manage (from API), with taught_subject fallback. */
export function teachableSubjectIds(user) {
  if (!user) return [];
  if (user.role === "admin") return null; // null = all
  const ids = Array.isArray(user.teachable_subject_ids)
    ? user.teachable_subject_ids.map(Number)
    : [];
  if (user.taught_subject != null) {
    const t = Number(user.taught_subject);
    if (!ids.includes(t)) ids.push(t);
  }
  return ids;
}

export function canEditSubject(user, subjectId) {
  if (!user || subjectId == null || subjectId === "") return false;
  if (user.role === "admin") return true;
  if (user.role !== "teacher") return false;
  const ids = teachableSubjectIds(user);
  return Array.isArray(ids) && ids.map(String).includes(String(subjectId));
}

export function filterSubjectsForUser(subjects, user) {
  if (!user || user.role !== "teacher") return subjects;
  const ids = teachableSubjectIds(user);
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const set = new Set(ids.map(String));
  return (subjects || []).filter((s) => set.has(String(s.id)));
}
