/**
 * Format session datetime with Gregorian + Hijri (Islamic) calendars.
 */

const GREG_OPTS = {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
};

const HIJRI_OPTS = {
  day: "numeric",
  month: "long",
  year: "numeric",
};

const TIME_OPTS = {
  hour: "2-digit",
  minute: "2-digit",
};

/** Strip locale هـ / ه then add a single هـ. */
function withSingleHijriMark(raw) {
  const cleaned = String(raw || "")
    .replace(/\s*هـ?\.?\s*$/u, "")
    .trim();
  return cleaned ? `${cleaned} هـ` : "";
}

export function formatSessionWhen(iso, { withWeekday = true } = {}) {
  if (!iso) return { gregorian: "—", hijri: "", time: "", line: "—" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { gregorian: "—", hijri: "", time: "", line: "—" };

  const gregOpts = withWeekday
    ? GREG_OPTS
    : { day: "numeric", month: "long", year: "numeric" };

  let gregorian = d.toLocaleDateString("ar-EG", gregOpts);
  let hijriRaw = "";
  try {
    hijriRaw = d.toLocaleDateString("ar-SA-u-ca-islamic", HIJRI_OPTS);
  } catch {
    try {
      hijriRaw = d.toLocaleDateString("ar-EG-u-ca-islamic", HIJRI_OPTS);
    } catch {
      hijriRaw = "";
    }
  }
  const hijri = withSingleHijriMark(hijriRaw);
  const time = d.toLocaleTimeString("ar-EG", TIME_OPTS);

  const line = hijri
    ? `${gregorian} · ${hijri} · ${time}`
    : `${gregorian} · ${time}`;

  return { gregorian, hijri, time, line };
}

export function sessionDisplayTitle(s) {
  if (!s) return "";
  return (s.display_title || s.title || s.subject_name || "").trim();
}
