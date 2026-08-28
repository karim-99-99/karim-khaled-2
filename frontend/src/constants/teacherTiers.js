export const TEACHER_TIERS = [
  { id: "gold", label: "ذهبي" },
  { id: "silver", label: "فضي" },
  { id: "bronze", label: "برونزي" },
];

export function tierLabel(id) {
  return TEACHER_TIERS.find((t) => t.id === id)?.label || "";
}
