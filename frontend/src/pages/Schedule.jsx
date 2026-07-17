import { useEffect, useState } from "react";
import client from "../api/client";

export default function Schedule() {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    client.get("/sessions/").then((res) => setSessions(res.data.results || res.data));
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 32, marginBottom: 24 }}>جدول الحصص</h1>
      {sessions.length === 0 && <p style={{ color: "var(--text-muted)" }}>لا توجد حصص مجدولة.</p>}
      {sessions.map((s) => (
        <div key={s.id} className="card"
          style={{ display: "flex", alignItems: "center", gap: 20, padding: 20, marginBottom: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--primary)", minWidth: 120 }}>
            {new Date(s.start_time).toLocaleString("ar-EG", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: 16 }}>
              {s.subject_name}{" "}
              {s.status === "live" && <span className="badge badge-live">مباشر الآن</span>}
            </h4>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {s.teacher_name} · {s.duration_minutes} دقيقة
            </p>
          </div>
          {s.zoom_link ? (
            <a className="btn btn-primary btn-sm" href={s.zoom_link} target="_blank" rel="noreferrer">
              انضم عبر Zoom
            </a>
          ) : (
            <button className="btn btn-secondary btn-sm">تذكير</button>
          )}
        </div>
      ))}
    </div>
  );
}
