/**
 * Format session datetime with Gregorian + Hijri (Islamic) calendars.
 */

const GREG_DATE_OPTS = {
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
  if (!iso) {
    return {
      weekday: "",
      gregorian: "—",
      hijri: "",
      time: "",
      line: "—",
    };
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return {
      weekday: "",
      gregorian: "—",
      hijri: "",
      time: "",
      line: "—",
    };
  }

  const weekday = d.toLocaleDateString("ar-EG", { weekday: "long" });
  const gregorianDate = d.toLocaleDateString("ar-EG", GREG_DATE_OPTS);
  const gregorian = withWeekday ? `${weekday}، ${gregorianDate}` : gregorianDate;

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
    ? `${weekday} · ${time} · ${hijri} · ${gregorianDate}`
    : `${weekday} · ${time} · ${gregorianDate}`;

  return { weekday, gregorian: gregorianDate, gregorianFull: gregorian, hijri, time, line };
}

export function sessionDisplayTitle(s) {
  if (!s) return "";
  return (s.display_title || s.title || s.subject_name || "").trim();
}

/**
 * Status from the clock so «مباشر الآن» cannot linger after duration ends,
 * even if the API status was left on live.
 */
export function effectiveSessionStatus(session, now = new Date()) {
  if (!session) return "scheduled";
  if (session.status === "done") return "done";
  const start = new Date(session.start_time);
  if (Number.isNaN(start.getTime())) return session.status || "scheduled";
  const mins = Number(session.duration_minutes) || 60;
  const end = new Date(start.getTime() + mins * 60_000);
  if (now < start) return "scheduled";
  if (now <= end) return "live";
  return "done";
}

export function statusLabel(status) {
  if (status === "live") return "مباشر الآن";
  if (status === "done") return "منتهية";
  return "مجدولة";
}

