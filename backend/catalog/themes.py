"""Map a catalog subject to one of the four theme keys."""

SLUG_THEME = {
    "math": "math",
    "physics": "physics",
    "phys": "physics",
    "chemistry": "chem",
    "chem": "chem",
    "biology": "bio",
    "bio": "bio",
}


def theme_key_for(slug="", name=""):
    slug_l = (slug or "").strip().lower()
    if slug_l in SLUG_THEME:
        return SLUG_THEME[slug_l]
    for prefix, theme in SLUG_THEME.items():
        if slug_l.startswith(prefix):
            return theme
    label = name or ""
    if "فيز" in label:
        return "physics"
    if "كيم" in label:
        return "chem"
    if "أحي" in label or "احي" in label:
        return "bio"
    if "رياض" in label:
        return "math"
    return ""
