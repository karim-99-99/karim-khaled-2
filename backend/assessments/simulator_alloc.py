"""Subject question-count allocation for the personal / full simulator (Task 23)."""

from __future__ import annotations

# Math : Bio : Chem : Phys
SUBJECT_RATIOS = {"math": 30, "bio": 30, "chem": 25, "phys": 25}
SUBJECT_FIXED = {"math": 30, "bio": 30, "chem": 25, "phys": 25}
# Largest-remainder ties prefer Math, then Bio (brief 9.2).
TIE_BREAK_ORDER = ("math", "bio", "chem", "phys")

_NAME_HINTS = (
    ("math", ("رياض", "math")),
    ("bio", ("أحياء", "احياء", "bio")),
    ("chem", ("كيم", "chem")),
    ("phys", ("فيز", "phys")),
)


def subject_ratio_key(subject) -> str | None:
    """Map a Subject (or dict/str) to math|bio|chem|phys."""
    if subject is None:
        return None
    theme = (getattr(subject, "theme_key", None) or "").strip().lower()
    if theme in SUBJECT_RATIOS:
        return theme
    if theme == "physics":
        return "phys"
    slug = (getattr(subject, "slug", None) or "").strip().lower()
    for key, hints in _NAME_HINTS:
        if any(h in slug for h in hints):
            return key
    name = ""
    if isinstance(subject, str):
        name = subject
    else:
        name = getattr(subject, "name", None) or ""
        if isinstance(subject, dict):
            name = subject.get("name") or subject.get("subject_name") or ""
            theme = (subject.get("theme_key") or "").strip().lower()
            if theme in SUBJECT_RATIOS:
                return theme
            if theme == "physics":
                return "phys"
    name_l = str(name).strip().lower()
    for key, hints in _NAME_HINTS:
        if any(h in name_l for h in hints):
            return key
    return None


def allocate_by_ratio(keys: list[str], n: int) -> dict[str, int]:
    """
    Split n across selected subject keys with ratios 30:30:25:25
    using largest-remainder; ties → Math, then Bio.
    """
    keys = [k for k in keys if k in SUBJECT_RATIOS]
    if not keys or n < 1:
        return {k: 0 for k in keys}
    if len(keys) == 1:
        return {keys[0]: n}

    weights = {k: SUBJECT_RATIOS[k] for k in keys}
    total_w = sum(weights.values()) or 1
    raw = {k: n * weights[k] / total_w for k in keys}
    floors = {k: int(raw[k]) for k in keys}
    rem = n - sum(floors.values())
    # Sort by fractional part desc; tie → TIE_BREAK_ORDER.
    tie_rank = {k: i for i, k in enumerate(TIE_BREAK_ORDER)}
    order = sorted(
        keys,
        key=lambda k: (-(raw[k] - floors[k]), tie_rank.get(k, 99)),
    )
    out = dict(floors)
    for i in range(rem):
        out[order[i % len(order)]] += 1
    return out


def allocate_fixed(keys: list[str]) -> dict[str, int]:
    """Fixed per-subject counts (محاكي حسب المواد / full simulator)."""
    return {k: SUBJECT_FIXED[k] for k in keys if k in SUBJECT_FIXED}


def format_allocation_ar(alloc: dict[str, int], labels: dict[str, str] | None = None) -> str:
    labels = labels or {
        "math": "رياضيات",
        "bio": "أحياء",
        "chem": "كيمياء",
        "phys": "فيزياء",
    }
    parts = []
    for k in TIE_BREAK_ORDER:
        if k in alloc and alloc[k] > 0:
            parts.append(f"{labels.get(k, k)} {alloc[k]}")
    return " · ".join(parts)
