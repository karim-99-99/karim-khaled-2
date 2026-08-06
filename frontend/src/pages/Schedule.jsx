import { useEffect, useState } from "react";
import client from "../api/client";
import { formatSessionWhen, sessionDisplayTitle } from "../utils/sessionDate";

export default function Schedule() {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    client.get("/sessions/").then((res) => setSessions(res.data.results || res.data));
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 32, marginBottom: 24 }}>جدول الحصص</h1>
      {sessions.length === 0 && <p style={{ color: "var(--text-muted)" }}>لا توجد حصص مجدولة.</p>}
      {sessions.map((s) => {
        const when = formatSessionWhen(s.start_time);
        return (
          <div
            key={s.id}
            className="card"
            style={{ display: "flex", alignItems: "center", gap: 20, padding: 20, marginBottom: 12 }}
          >
            <div style={{ minWidth: 160 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--primary)" }}>
                {when.time}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{when.gregorian}</div>
              {when.hijri && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {when.hijri} هـ
                </div>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ fontSize: 16 }}>
                {sessionDisplayTitle(s)}{" "}
                {s.status === "live" && <span className="badge badge-live">مباشر الآن</span>}
              </h4>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {s.subject_name}
                {s.teacher_name ? ` · ${s.teacher_name}` : ""} · {s.duration_minutes} دقيقة
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
        );
      })}
    </div>
  );
}
