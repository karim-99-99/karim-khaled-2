/** Gold vs Silver feature gates (mirrors backend/core/plans.py). */

export const FEATURE = {
  LIVE: "live",
  SCHEDULE: "schedule",
  DAILY_TASKS: "daily_tasks",
  NEXT_CLASS: "next_class",
  TEACHER_TESTS: "teacher_tests",
  LESSON_LOCKS: "lesson_locks",
};

const GOLD_ONLY = new Set(Object.values(FEATURE));

export function canAccess(user, feature) {
  if (!user) return false;
  if (user.role === "teacher" || user.role === "admin") return true;
  if (!GOLD_ONLY.has(feature)) return true;
  if (user.role !== "student") return true;
  return Boolean(user.is_gold) && !user.is_silver;
}

export function isSilverStudent(user) {
  return user?.role === "student" && Boolean(user.is_silver);
}
