import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";

/**
 * Teacher view: schedule is set by admin.
 * Teacher only adds/updates the Zoom meeting link (and session status).
 */
export default function TeacherSchedule() {
  const [sessions, setSessions] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [msg, setMsg] = useState("");
  const [busyId, setBusyId] = useState(null);

  function loadSessions() {
    client.get("/sessions/").then((res) => {
      const rows = res.data.results || res.data;
      setSessions(rows);
      const next = {};
      rows.forEach((s) => {
        next[s.id] = { zoom_link: s.zoom_link || "", status: s.status };
      });
      setDrafts(next);
    });
  }

  useEffect(() => {
    loadSessions();
  }, []);

  function setDraft(id, key, value) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], [key]: value } }));
  }

  async function saveZoom(session) {
    setMsg("");
    setBusyId(session.id);
    const draft = drafts[session.id] || {};
    try {
      await client.patch(`/sessions/${session.id}/`, {
        zoom_link: draft.zoom_link || "",
        status: draft.status || session.status,
      });
      setMsg("تم حفظ رابط Zoom");
      loadSessions();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر حفظ الرابط");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 28 }}>جدول الحصص</h1>
        <Link to="/teacher" className="btn btn-ghost">رجوع للوحة المدرس</Link>
      </div>

      <div className="banner" style={{ marginBottom: 16 }}>
        المدير يضع مواعيد الحصص والمجموعات. مهمتك إضافة <strong>رابط Zoom</strong> لكل حصة.
      </div>

      {msg && <div className="banner" style={{ marginBottom: 12 }}>{msg}</div>}

      {sessions.length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>لا توجد حصص مجدولة لك بعد. انتظر وضع الجدول من المدير.</p>
      )}

      {sessions.map((s) => {
        const draft = drafts[s.id] || { zoom_link: "", status: s.status };
        return (
          <div
            key={s.id}
            className="card"
            style={{ padding: 16, marginBottom: 12 }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
              <div style={{ minWidth: 160, fontWeight: 700, color: "var(--primary)" }}>
                {new Date(s.start_time).toLocaleString("ar-EG", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <strong>{s.subject_name}</strong>
                {s.status === "live" && (
                  <span className="badge badge-live" style={{ marginInlineStart: 8 }}>مباشر</span>
                )}
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {s.group_name || "مجموعة"} · {s.duration_minutes} دقيقة
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 12, marginBottom: 8 }}>
              <label>رابط Zoom Meeting</label>
              <input
                className="form-control"
                value={draft.zoom_link}
                placeholder="https://zoom.us/j/..."
                onChange={(e) => setDraft(s.id, "zoom_link", e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>الحالة</label>
              <div className="filter-row">
                {[["scheduled", "مجدولة"], ["live", "مباشر الآن"], ["done", "منتهية"]].map(([v, t]) => (
                  <span
                    key={v}
                    className={`chip ${draft.status === v ? "active" : ""}`}
                    onClick={() => setDraft(s.id, "status", v)}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="btn btn-primary btn-sm"
                disabled={busyId === s.id}
                onClick={() => saveZoom(s)}
              >
                {busyId === s.id ? "…" : "حفظ الرابط"}
              </button>
              {draft.zoom_link && (
                <a className="btn btn-secondary btn-sm" href={draft.zoom_link} target="_blank" rel="noreferrer">
                  فتح Zoom ↗
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
