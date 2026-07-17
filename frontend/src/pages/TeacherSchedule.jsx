import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";

const EMPTY = {
  assignment: "",
  start_time: "",
  duration_minutes: 60,
  zoom_link: "",
  status: "scheduled",
};

export default function TeacherSchedule() {
  const [assignments, setAssignments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState("");

  function loadSessions() {
    client.get("/sessions/").then((res) => setSessions(res.data.results || res.data));
  }
  useEffect(() => {
    client.get("/teacher/assignments/").then((res) => setAssignments(res.data));
    loadSessions();
  }, []);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function resetForm() {
    setForm(EMPTY);
    setEditingId(null);
    setMsg("");
  }

  function pickAssignment(idx) {
    set("assignment", idx);
  }

  async function save() {
    setMsg("");
    const a = assignments[Number(form.assignment)];
    if (!a) {
      setMsg("اختر المجموعة والمادة");
      return;
    }
    if (!form.start_time) {
      setMsg("اختر موعد الحصة");
      return;
    }
    const payload = {
      group: a.group_id,
      subject: a.subject_id,
      start_time: form.start_time,
      duration_minutes: Number(form.duration_minutes),
      zoom_link: form.zoom_link,
      status: form.status,
    };
    try {
      if (editingId) {
        await client.put(`/sessions/${editingId}/`, payload);
      } else {
        await client.post("/sessions/", payload);
      }
      resetForm();
      loadSessions();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر حفظ الحصة");
    }
  }

  function editSession(s) {
    const idx = assignments.findIndex(
      (a) => a.group_id === s.group && a.subject_id === s.subject,
    );
    setEditingId(s.id);
    setMsg("");
    setForm({
      assignment: idx >= 0 ? String(idx) : "",
      // datetime-local wants "YYYY-MM-DDTHH:mm"
      start_time: s.start_time ? s.start_time.slice(0, 16) : "",
      duration_minutes: s.duration_minutes,
      zoom_link: s.zoom_link || "",
      status: s.status,
    });
  }

  async function remove(id) {
    await client.delete(`/sessions/${id}/`);
    loadSessions();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 28 }}>جدول الحصص</h1>
        <Link to="/teacher" className="btn btn-ghost">رجوع للوحة المدرس</Link>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "380px 1fr", gap: 24 }}>
        {/* Form */}
        <div className="card" style={{ padding: 24, height: "fit-content" }}>
          <h3 style={{ marginBottom: 16 }}>{editingId ? "تعديل حصة" : "إضافة حصة جديدة"}</h3>

          <div className="form-group">
            <label>المجموعة والمادة</label>
            <select className="form-control" value={form.assignment}
              onChange={(e) => pickAssignment(e.target.value)}>
              <option value="">اختر…</option>
              {assignments.map((a, i) => (
                <option key={`${a.group_id}-${a.subject_id}`} value={i}>
                  {a.group_name} — {a.subject_name}
                </option>
              ))}
            </select>
            {assignments.length === 0 && (
              <div className="error-text">لم تُضف إلى أي مجموعة بعد. تواصل مع المدير.</div>
            )}
          </div>

          <div className="form-group">
            <label>موعد الحصة</label>
            <input type="datetime-local" className="form-control" value={form.start_time}
              onChange={(e) => set("start_time", e.target.value)} />
          </div>

          <div className="form-group">
            <label>المدة (دقيقة)</label>
            <input type="number" className="form-control" style={{ width: 120 }}
              value={form.duration_minutes} min={15} step={5}
              onChange={(e) => set("duration_minutes", e.target.value)} />
          </div>

          <div className="form-group">
            <label>رابط Zoom Meeting</label>
            <input className="form-control" value={form.zoom_link} placeholder="https://zoom.us/j/..."
              onChange={(e) => set("zoom_link", e.target.value)} />
          </div>

          <div className="form-group">
            <label>الحالة</label>
            <div className="filter-row">
              {[["scheduled", "مجدولة"], ["live", "مباشر الآن"], ["done", "منتهية"]].map(([v, t]) => (
                <span key={v} className={`chip ${form.status === v ? "active" : ""}`}
                  onClick={() => set("status", v)}>{t}</span>
              ))}
            </div>
          </div>

          {msg && <div className="banner">{msg}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={save}>
              {editingId ? "حفظ التعديل" : "إضافة الحصة"}
            </button>
            {editingId && (
              <button className="btn btn-ghost" onClick={resetForm}>إلغاء</button>
            )}
          </div>
        </div>

        {/* List */}
        <div>
          <div className="section-title">حصصي ({sessions.length})</div>
          {sessions.length === 0 && (
            <p style={{ color: "var(--text-muted)" }}>لا توجد حصص مضافة بعد.</p>
          )}
          {sessions.map((s) => (
            <div key={s.id} className="card"
              style={{ padding: 16, marginBottom: 12, display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ minWidth: 150, fontWeight: 700, color: "var(--primary)" }}>
                {new Date(s.start_time).toLocaleString("ar-EG", {
                  weekday: "short", day: "numeric", month: "short",
                  hour: "2-digit", minute: "2-digit",
                })}
              </div>
              <div style={{ flex: 1 }}>
                <strong>{s.subject_name}</strong>{" "}
                {s.status === "live" && <span className="badge badge-live">مباشر</span>}
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {s.duration_minutes} دقيقة{s.zoom_link ? " · Zoom مضاف" : " · بدون رابط"}
                </div>
              </div>
              {s.zoom_link && (
                <a className="btn btn-secondary btn-sm" href={s.zoom_link} target="_blank" rel="noreferrer">
                  Zoom ↗
                </a>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => editSession(s)}>تعديل</button>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(s.id)}>حذف</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
