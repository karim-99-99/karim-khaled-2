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

export function formatSessionWhen(iso, { withWeekday = true } = {}) {
  if (!iso) return { gregorian: "—", hijri: "", time: "", line: "—" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { gregorian: "—", hijri: "", time: "", line: "—" };

  const gregOpts = withWeekday
    ? GREG_OPTS
    : { day: "numeric", month: "long", year: "numeric" };

  let gregorian = d.toLocaleDateString("ar-EG", gregOpts);
  let hijri = "";
  try {
    hijri = d.toLocaleDateString("ar-SA-u-ca-islamic", HIJRI_OPTS);
  } catch {
    try {
      hijri = d.toLocaleDateString("ar-EG-u-ca-islamic", HIJRI_OPTS);
    } catch {
      hijri = "";
    }
  }
  const time = d.toLocaleTimeString("ar-EG", TIME_OPTS);

  const line = hijri
    ? `${gregorian} · ${hijri} هـ · ${time}`
    : `${gregorian} · ${time}`;

  return { gregorian, hijri, time, line };
}

export function sessionDisplayTitle(s) {
  if (!s) return "";
  return (s.display_title || s.title || s.subject_name || "").trim();
}
