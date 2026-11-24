import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";

const DAYS = [
  { id: 6, label: "الأحد", window: "16:00 – 23:00" },
  { id: 0, label: "الإثنين", window: "16:00 – 23:00" },
  { id: 1, label: "الثلاثاء", window: "16:00 – 23:00" },
  { id: 2, label: "الأربعاء", window: "16:00 – 23:00" },
  { id: 3, label: "الخميس", window: "16:00 – 23:00" },
  { id: 4, label: "الجمعة", window: "12:00 – 23:00" },
  { id: 5, label: "السبت", window: "12:00 – 23:00" },
];

function emptySlot(weekday) {
  const friSat = weekday === 4 || weekday === 5;
  return {
    weekday,
    start_time: friSat ? "12:00" : "16:00",
    end_time: friSat ? "14:00" : "18:00",
  };
}

export default function TeacherAvailability() {
  const [slots, setSlots] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .get("/teacher/availability/")
      .then((res) => {
        const rows = (res.data || []).map((s) => ({
          ...s,
          start_time: String(s.start_time).slice(0, 5),
          end_time: String(s.end_time).slice(0, 5),
        }));
        setSlots(rows);
      })
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, []);

  function addSlot(weekday) {
    setSlots((prev) => [...prev, emptySlot(weekday)]);
  }

  function updateSlot(index, patch) {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeSlot(index) {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      const { data } = await client.put("/teacher/availability/", {
        slots: slots.map(({ weekday, start_time, end_time }) => ({
          weekday,
          start_time: start_time.length === 5 ? `${start_time}:00` : start_time,
          end_time: end_time.length === 5 ? `${end_time}:00` : end_time,
        })),
      });
      setSlots(
        (data || []).map((s) => ({
          ...s,
          start_time: String(s.start_time).slice(0, 5),
          end_time: String(s.end_time).slice(0, 5),
        }))
      );
      setMsg("تم حفظ مواعيدك المتاحة ✓");
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
            "تعذّر الحفظ — تأكد أن كل فترة ≥ ساعتين وداخل النافذة المسموحة";
      setMsg(detail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, margin: 0 }}>مواعيدي المتاحة</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 6 }}>
            الجمعة والسبت 12:00–23:00 · باقي الأيام 16:00–23:00 · كل فترة لا تقل عن ساعتين
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to="/teacher" className="btn btn-ghost">
            ← لوحة المدرس
          </Link>
          <Link to="/teacher/schedule" className="btn btn-secondary">
            حصصي
          </Link>
        </div>
      </div>

      {msg && <div className="banner" style={{ marginBottom: 14 }}>{msg}</div>}
      {loading && <div className="spinner">جاري التحميل…</div>}

      {!loading &&
        DAYS.map((day) => {
          const daySlots = slots
            .map((s, index) => ({ ...s, index }))
            .filter((s) => Number(s.weekday) === day.id);
          return (
            <div key={day.id} className="card" style={{ padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <div>
                  <strong>{day.label}</strong>
                  <span style={{ color: "var(--text-muted)", marginInlineStart: 8, fontSize: 13 }}>
                    النافذة: {day.window}
                  </span>
                </div>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => addSlot(day.id)}>
                  + فترة
                </button>
              </div>
              {daySlots.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 14 }}>لا توجد فترات</div>
              ) : (
                daySlots.map((s) => {
                  const hours =
                    (Number(s.end_time.slice(0, 2)) * 60 +
                      Number(s.end_time.slice(3, 5)) -
                      (Number(s.start_time.slice(0, 2)) * 60 +
                        Number(s.start_time.slice(3, 5)))) /
                    60;
                  const bad = hours < 2;
                  return (
                    <div
                      key={s.index}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        flexWrap: "wrap",
                        marginBottom: 8,
                        padding: 8,
                        borderRadius: 10,
                        border: `1px solid ${bad ? "#fca5a5" : "#e5ecf5"}`,
                        background: bad ? "#fef2f2" : "#fff",
                      }}
                    >
                      <input
                        className="form-control"
                        type="time"
                        value={s.start_time}
                        onChange={(e) => updateSlot(s.index, { start_time: e.target.value })}
                        style={{ maxWidth: 140 }}
                      />
                      <span>إلى</span>
                      <input
                        className="form-control"
                        type="time"
                        value={s.end_time}
                        onChange={(e) => updateSlot(s.index, { end_time: e.target.value })}
                        style={{ maxWidth: 140 }}
                      />
                      {bad && (
                        <span style={{ color: "#b91c1c", fontSize: 13, fontWeight: 700 }}>
                          أقل من ساعتين
                        </span>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => removeSlot(s.index)}
                      >
                        حذف
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          );
        })}

      <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
        {busy ? "جاري الحفظ…" : "حفظ المواعيد"}
      </button>
    </div>
  );
}
