"""Normalize Egyptian-style phone numbers for lookup and synthetic emails."""

import re


def normalize_phone(value: str) -> str:
    """
    Strip non-digits and normalize common Egypt prefixes to local 01xxxxxxxxx.
    Examples: +2010..., 002010..., 010... → 010...
    """
    if value is None:
        return ""
    digits = re.sub(r"\D", "", str(value).strip())
    if digits.startswith("0020"):
        digits = digits[4:]
    elif digits.startswith("20") and len(digits) >= 12:
        digits = digits[2:]
    if digits and not digits.startswith("0") and len(digits) in (10, 11):
        digits = "0" + digits
    return digits


def phones_match_query(phone: str):
    """Return a list of equivalent phone strings to try when looking up a user."""
    n = normalize_phone(phone)
    if not n:
        return []
    variants = {n, phone.strip()}
    if n.startswith("0"):
        variants.add("20" + n[1:])
        variants.add("+20" + n[1:])
        variants.add("0020" + n[1:])
    return [v for v in variants if v]


def synthetic_email(phone: str, channel: str) -> str:
    """Stable unique email for messenger-only accounts (Django USERNAME_FIELD)."""
    digits = normalize_phone(phone) or re.sub(r"\D", "", str(phone))
    domain = "telegram.local" if channel == "telegram" else "whatsapp.local"
    return f"{digits}@{domain}"
