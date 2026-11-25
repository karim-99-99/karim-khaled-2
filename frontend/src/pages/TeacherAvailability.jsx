import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { resolveSubjectKey, subjectClass } from "../theme/subjects";
import "../styles/teacher-availability.css";

const ROW_H = 44;
const GRID_START = 12; // 12:00
const GRID_END = 23; // 23:00
const ROWS = GRID_END - GRID_START; // 11

/** Display order: Sat → Fri */
const DAY_COLS = [
  { weekday: 5, label: "السبت", window: "12 م – 11 م", openFrom: 12 },
  { weekday: 6, label: "الأحد", window: "4 م – 11 م", openFrom: 16 },
  { weekday: 0, label: "الاثنين", window: "4 م – 11 م", openFrom: 16 },
  { weekday: 1, label: "الثلاثاء", window: "4 م – 11 م", openFrom: 16 },
  { weekday: 2, label: "الأربعاء", window: "4 م – 11 م", openFrom: 16 },
  { weekday: 3, label: "الخميس", window: "4 م – 11 م", openFrom: 16 },
  { weekday: 4, label: "الجمعة", window: "12 م – 11 م", openFrom: 12 },
];

const DAY_NAME = {
  0: "الاثنين",
  1: "الثلاثاء",
  2: "الأربعاء",
  3: "الخميس",
  4: "الجمعة",
  5: "السبت",
  6: "الأحد",
};

const HOUR_LABELS = Array.from({ length: ROWS }, (_, i) => {
  const h = GRID_START + i;
  const h12 = h % 12 || 12;
  const suffix = h < 12 ? "ص" : "م";
  return `${h12}:00 ${suffix}`;
});

function parseHM(str) {
  const [h, m] = String(str).slice(0, 5).split(":").map(Number);
  return h * 60 + (m || 0);
}

function toHM(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function fmtLabel(hm) {
  const [hStr, mStr] = hm.split(":");
  let h = Number(hStr);
  const m = Number(mStr);
  const suffix = h < 12 ? "ص" : "م";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function hoursOf(slot) {
  return (parseHM(slot.end_time) - parseHM(slot.start_time)) / 60;
}

function isBad(slot) {
  return hoursOf(slot) < 2;
}

function mergeDaySlots(list) {
  const sorted = [...list].sort(
    (a, b) => parseHM(a.start_time) - parseHM(b.start_time),
  );
  const out = [];
  for (const s of sorted) {
    if (!out.length) {
      out.push({ ...s });
      continue;
    }
    const prev = out[out.length - 1];
    if (parseHM(s.start_time) <= parseHM(prev.end_time)) {
      if (parseHM(s.end_time) > parseHM(prev.end_time)) {
        prev.end_time = s.end_time;
      }
    } else {
      out.push({ ...s });
    }
  }
  return out;
}

function normalizeSlots(slots) {
  const byDay = {};
  for (const s of slots) {
    byDay[s.weekday] = byDay[s.weekday] || [];
    byDay[s.weekday].push(s);
  }
  const out = [];
  Object.keys(byDay).forEach((wd) => {
    mergeDaySlots(byDay[wd]).forEach((s) =>
      out.push({ weekday: Number(wd), start_time: s.start_time, end_time: s.end_time }),
    );
  });
  return out;
}

function openFromFor(weekday) {
  return weekday === 4 || weekday === 5 ? 12 : 16;
}

function clampHour(weekday, hour) {
  const open = openFromFor(weekday);
  return Math.min(GRID_END, Math.max(open, hour));
}

let _uid = 1;
function uid() {
  return `s${_uid++}`;
}

export default function TeacherAvailability() {
  const { user } = useAuth();
  const [slots, setSlots] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const dragRef = useRef(null);
  const [draft, setDraft] = useState(null);

  const skin = subjectClass(
    resolveSubjectKey(user?.taught_subject_name || user?.taught_subject),
  );

  useEffect(() => {
    client
      .get("/teacher/availability/")
      .then((res) => {
        const rows = (res.data || []).map((s) => ({
          id: s.id || uid(),
          weekday: Number(s.weekday),
          start_time: String(s.start_time).slice(0, 5),
          end_time: String(s.end_time).slice(0, 5),
        }));
        setSlots(normalizeSlots(rows).map((s) => ({ ...s, id: uid() })));
      })
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, []);

  const badSlots = useMemo(() => slots.filter(isBad), [slots]);
  const canSave = badSlots.length === 0 && !busy;
  const totalHours = useMemo(
    () => slots.reduce((sum, s) => sum + Math.max(0, hoursOf(s)), 0),
    [slots],
  );

  function updateSlots(next) {
    setSlots(normalizeSlots(next).map((s) => ({ ...s, id: s.id || uid() })));
  }

  function removeSlot(id) {
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }

  function hourFromY(clientY, colEl) {
    const rect = colEl.getBoundingClientRect();
    const y = clientY - rect.top;
    const row = Math.floor(y / ROW_H);
    return GRID_START + Math.max(0, Math.min(ROWS - 1, row));
  }

  function onColDown(e, weekday) {
    if (e.target.closest(".slot")) return;
    const col = e.currentTarget;
    const h0 = clampHour(weekday, hourFromY(e.clientY, col));
    dragRef.current = { mode: "create", weekday, a: h0, b: h0 + 1, col };
    setDraft({ weekday, start: h0, end: h0 + 1 });
    e.preventDefault();
  }

  function onSlotResizeDown(e, slot, edge) {
    e.stopPropagation();
    e.preventDefault();
    const col = e.currentTarget.closest(".col");
    dragRef.current = {
      mode: "resize",
      edge,
      id: slot.id,
      weekday: slot.weekday,
      start: parseHM(slot.start_time) / 60,
      end: parseHM(slot.end_time) / 60,
      col,
    };
  }

  useEffect(() => {
    function onMove(e) {
      const d = dragRef.current;
      if (!d) return;
      const hour = clampHour(d.weekday, hourFromY(e.clientY, d.col));
      if (d.mode === "create") {
        const a = Math.min(d.a, hour);
        const b = Math.max(d.a, hour) + 1;
        setDraft({
          weekday: d.weekday,
          start: clampHour(d.weekday, a),
          end: Math.min(GRID_END, Math.max(clampHour(d.weekday, a) + 1, b)),
        });
      } else if (d.mode === "resize") {
        setSlots((prev) =>
          prev.map((s) => {
            if (s.id !== d.id) return s;
            let start = d.start;
            let end = d.end;
            if (d.edge === "top") {
              start = Math.min(hour, end - 1);
              start = clampHour(d.weekday, start);
            } else {
              end = Math.max(hour + 1, start + 1);
              end = Math.min(GRID_END, end);
            }
            return {
              ...s,
              start_time: toHM(start * 60),
              end_time: toHM(end * 60),
            };
          }),
        );
      }
    }
    function onUp() {
      const d = dragRef.current;
      if (!d) return;
      if (d.mode === "create" && draft) {
        const start = draft.start;
        const end = Math.max(draft.end, start + 1);
        setSlots((prev) =>
          normalizeSlots([
            ...prev,
            {
              id: uid(),
              weekday: draft.weekday,
              start_time: toHM(start * 60),
              end_time: toHM(end * 60),
            },
          ]).map((s) => ({ ...s, id: s.id || uid() })),
        );
      } else if (d.mode === "resize") {
        setSlots((prev) =>
          normalizeSlots(prev).map((s) => ({ ...s, id: s.id || uid() })),
        );
      }
      dragRef.current = null;
      setDraft(null);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [draft]);

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      const { data } = await client.put("/teacher/availability/", {
        slots: normalizeSlots(slots).map(({ weekday, start_time, end_time }) => ({
          weekday,
          start_time: `${start_time}:00`,
          end_time: `${end_time}:00`,
        })),
      });
      const rows = Array.isArray(data) ? data : data?.slots || [];
      setSlots(
        rows.map((s) => ({
          id: uid(),
          weekday: Number(s.weekday),
          start_time: String(s.start_time).slice(0, 5),
          end_time: String(s.end_time).slice(0, 5),
        })),
      );
      if (data?.warning) setErr(data.warning);
      else setMsg("تم حفظ مواعيدك المتاحة ✓");
    } catch (e) {
      const d = e.response?.data;
      const detail =
        typeof d === "string"
          ? d
          : d?.detail ||
            (Array.isArray(d) ? d.join(" ") : null) ||
            (d && typeof d === "object"
              ? Object.values(d).flat().join(" ")
              : null) ||
            "تعذّر الحفظ";
      setErr(detail);
    } finally {
      setBusy(false);
    }
  }

  function slotStyle(slot) {
    const startH = parseHM(slot.start_time) / 60;
    const endH = parseHM(slot.end_time) / 60;
    const top = (startH - GRID_START) * ROW_H;
    const height = (endH - startH) * ROW_H;
    return { top, height };
  }

  return (
    <div className={`tav ${skin}`}>
      <div className="ph">
        <h1>حصصي</h1>
        <span className="mut">
          {user?.taught_subject_name
            ? `مدرس ${user.taught_subject_name}`
            : "مدرس"}
        </span>
      </div>
      <div className="tabs">
        <Link to="/teacher/schedule">جدول الحصص</Link>
        <span className="on">مواعيدي المتاحة</span>
        <Link to="/teacher/schedule?tab=past">الحصص السابقة</Link>
      </div>

      {msg && <div className="banner-ok">{msg}</div>}
      {err && <div className="banner-err">{err}</div>}
      {loading && <div className="spinner">جاري التحميل…</div>}

      {!loading && (
        <div className="lay">
          <div className="card">
            <div className="card-h">
              <h2>حدد الأوقات المتاحة لك للشرح</h2>
              <span className="tz">🕐 بتوقيت السعودية (مكة المكرمة)</span>
            </div>
            <div className="rules">
              <span>
                📌 كل فترة لا تقل عن <b>ساعتين متتاليتين</b>
              </span>
              <span>
                📅 الجمعة والسبت: <b>12 م – 11 م</b>
              </span>
              <span>
                📅 باقي الأيام: <b>4 م – 11 م</b>
              </span>
            </div>

            <div className="calwrap">
              <div className="cal">
                <div />
                {DAY_COLS.map((d) => (
                  <div key={d.weekday} className="hd">
                    {d.label}
                    <small>{d.window}</small>
                  </div>
                ))}
                <div className="hours">
                  {HOUR_LABELS.map((lbl) => (
                    <span key={lbl}>{lbl}</span>
                  ))}
                </div>
                {DAY_COLS.map((d) => {
                  const offH = d.openFrom - GRID_START;
                  const daySlots = slots.filter((s) => s.weekday === d.weekday);
                  return (
                    <div
                      key={d.weekday}
                      className="col"
                      onPointerDown={(e) => onColDown(e, d.weekday)}
                    >
                      {Array.from({ length: ROWS }, (_, i) => (
                        <i key={i} />
                      ))}
                      {offH > 0 && (
                        <div
                          className="off"
                          style={{ height: offH * ROW_H }}
                        />
                      )}
                      {daySlots.map((s) => {
                        const bad = isBad(s);
                        const style = slotStyle(s);
                        const label = bad
                          ? `${Math.round(hoursOf(s))} ساعة ⚠`
                          : `${fmtLabel(s.start_time)} – ${fmtLabel(s.end_time)}`;
                        return (
                          <div
                            key={s.id}
                            className={`slot${bad ? " bad" : ""}`}
                            style={style}
                          >
                            <button
                              type="button"
                              className="x"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeSlot(s.id);
                              }}
                              aria-label="حذف"
                            >
                              ×
                            </button>
                            <div
                              className="handle top"
                              onPointerDown={(e) =>
                                onSlotResizeDown(e, s, "top")
                              }
                            />
                            {label}
                            <div
                              className="handle bot"
                              onPointerDown={(e) =>
                                onSlotResizeDown(e, s, "bot")
                              }
                            />
                          </div>
                        );
                      })}
                      {draft && draft.weekday === d.weekday && (
                        <div
                          className="draft"
                          style={{
                            top: (draft.start - GRID_START) * ROW_H,
                            height: (draft.end - draft.start) * ROW_H,
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="legend">
              <span>
                <i
                  style={{
                    background: "#dcfce7",
                    border: "2px solid #22c55e",
                  }}
                />
                متاح{" "}
                <i
                  style={{
                    background: "#fff",
                    border: "1px solid #ccd",
                    marginRight: 14,
                  }}
                />
                غير متاح{" "}
                <i
                  style={{
                    background:
                      "repeating-linear-gradient(45deg,#e3e6ea 0 3px,#f6f7f9 3px 6px)",
                    marginRight: 14,
                  }}
                />
                خارج أوقات الشرح
              </span>
              <b style={{ color: "var(--brand)" }}>اضغط واسحب لتحديد فترة</b>
            </div>
          </div>

          <div className="card side">
            <div className="card-h">
              <h2>فتراتي المتاحة</h2>
              <span className="pill">{Math.round(totalHours)} ساعة</span>
            </div>
            {slots.length === 0 && (
              <p className="mut">لسه ما حددتش فترات — اسحب على الجدول.</p>
            )}
            {[...slots]
              .sort(
                (a, b) =>
                  a.weekday - b.weekday ||
                  parseHM(a.start_time) - parseHM(b.start_time),
              )
              .map((s) => (
                <div
                  key={s.id}
                  className={`it${isBad(s) ? " bad" : ""}`}
                >
                  <span>
                    {DAY_NAME[s.weekday]} · {fmtLabel(s.start_time)} –{" "}
                    {fmtLabel(s.end_time)}
                  </span>
                  <small>
                    {isBad(s)
                      ? "ساعة واحدة ⚠"
                      : `${hoursOf(s)} ساعات`}
                  </small>
                </div>
              ))}

            {badSlots.map((s) => (
              <div key={`err-${s.id}`} className="err">
                <b>
                  ⚠ {DAY_NAME[s.weekday]} {fmtLabel(s.start_time)} –{" "}
                  {fmtLabel(s.end_time)}
                </b>
                <br />
                ساعة واحدة فقط. يجب أن تكون الفترة ساعتين متتاليتين على الأقل.
              </div>
            ))}

            <div className="info">
              ℹ️ الإدارة تقدر تضيف حصص لمجموعاتك في الفترات دي بس.
            </div>

            <button
              type="button"
              className={`btn${canSave ? "" : " dis"}`}
              disabled={!canSave}
              onClick={save}
            >
              {busy ? "جاري الحفظ…" : "حفظ المواعيد"}
            </button>
            {!canSave && badSlots.length > 0 && (
              <p className="save-hint">
                صحّح الفترة غير المكتملة لتتمكن من الحفظ
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
