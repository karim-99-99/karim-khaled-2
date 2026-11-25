/**
 * Format session datetime with Gregorian + Hijri (Islamic) calendars.
 */

const TZ = "Asia/Riyadh";

const GREG_DATE_OPTS = {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: TZ,
  numberingSystem: "arab",
};

const HIJRI_OPTS = {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: TZ,
  numberingSystem: "arab",
  calendar: "islamic-umalqura",
};

const TIME_OPTS = {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: TZ,
  numberingSystem: "arab",
};

function riyadhDayKey(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dayLabelFor(date, now = new Date()) {
  const day = riyadhDayKey(date);
  if (day === riyadhDayKey(now)) return "اليوم";
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (day === riyadhDayKey(tomorrow)) return "غدًا";
  return date.toLocaleDateString("ar-EG", { weekday: "long", timeZone: TZ });
}

function hijriDate(date) {
  const locales = [
    "ar-SA-u-ca-islamic-umalqura-nu-arab",
    "ar-SA-u-ca-islamic-umalqura",
  ];
  for (const locale of locales) {
    try {
      const raw = date.toLocaleDateString(locale, HIJRI_OPTS);
      if (raw) return raw;
    } catch {
      /* try the next Umm al-Qura locale */
    }
  }
  return "";
}

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

  const weekday = d.toLocaleDateString("ar-EG", { weekday: "long", timeZone: TZ });
  const gregorianDate = d.toLocaleDateString("ar-EG-u-nu-arab", GREG_DATE_OPTS);
  const gregorian = withWeekday ? `${weekday}، ${gregorianDate}` : gregorianDate;
  const hijri = withSingleHijriMark(hijriDate(d));
  const time = d
    .toLocaleTimeString("ar-EG-u-nu-arab", TIME_OPTS)
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const dayLabel = dayLabelFor(d);
  const timeLine = [dayLabel, time].filter(Boolean).join(" ");

  const line = hijri
    ? `${weekday} · ${time} · ${hijri} · ${gregorianDate}`
    : `${weekday} · ${time} · ${gregorianDate}`;

  return {
    weekday,
    gregorian: gregorianDate,
    gregorianFull: gregorian,
    hijri,
    time,
    dayLabel,
    timeLine,
    line,
  };
}

const ARAB_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function toArabicDigits(value) {
  return String(value ?? "").replace(/\d/g, (digit) => ARAB_DIGITS[digit] || digit);
}

export function sessionTeacherName(session) {
  const raw = session?.teacher_name;
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text || text === "[object Object]") return "";
  return text;
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

