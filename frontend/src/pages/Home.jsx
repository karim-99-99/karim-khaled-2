import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";

export default function Home() {
  const { user } = useAuth();
  const [content, setContent] = useState(null);
  const [next, setNext] = useState(null);

  useEffect(() => {
    client.get("/home/free-content/").then((res) => setContent(res.data));
    if (user) {
      client
        .get("/home/next-session/")
        .then((res) => setNext(res.data))
        .catch(() => setNext(null));
    }
  }, [user]);

  const session = next?.session;
  const sessionTime = session
    ? new Date(session.start_time).toLocaleString("ar-EG", {
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
        day: "numeric",
        month: "short",
      })
    : null;

  return (
    <div>
      {user && user.role === "student" && !user.has_active_subscription && (
        <div className="banner">
          يمكنك تصفّح الموقع ومشاهدة أول درس وحل أول ١٠ أسئلة فقط —
          الرجاء التواصل مع الإدارة للتفعيل، أو{" "}
          <Link to="/subscription"><strong>اشترك الآن</strong></Link>.
        </div>
      )}

      {user && next?.role === "teacher" && next.teaches_subjects?.length > 0 && (
        <div style={{ marginBottom: 12, color: "var(--text-muted)" }}>
          أنت مدرّس مادة: <strong>{next.teaches_subjects.join("، ")}</strong>
        </div>
      )}

      <div className="hero">
        <div>
          <div className="eyebrow">الحصة القادمة</div>
          {session ? (
            <>
              <h2>{session.subject_name}</h2>
              <div className="meta">
                {sessionTime}
                {session.teacher_name ? ` · ${session.teacher_name}` : ""}
              </div>
            </>
          ) : (
            <>
              <h2>لا توجد حصة قادمة</h2>
              <div className="meta">
                {user ? "لا توجد حصص مجدولة لك حالياً" : "سجّل الدخول لعرض حصصك"}
              </div>
            </>
          )}
        </div>
        {session?.zoom_link ? (
          <a className="btn" href={session.zoom_link} target="_blank" rel="noreferrer">
            رابط الحصة Zoom ↗
          </a>
        ) : (
          <Link to="/schedule" className="btn">جدول الحصص</Link>
        )}
      </div>

      <div className="section-title">تصفح حسب المادة</div>
      <div className="filter-row">
        {content?.subjects?.map((s) => (
          <Link key={s.id} to={user ? `/courses/${s.id}` : "/login"} className="chip">
            {s.name}
          </Link>
        ))}
      </div>

      <div className="section-title">الدروس المتاحة مجاناً</div>
      {!content && <div className="spinner">جاري التحميل…</div>}
      <div className="grid grid-4">
        {content?.free_lessons?.map((l) => (
          <Link key={l.id} to={user ? `/lessons/${l.id}` : "/login"} className="card">
            <div className="lesson-thumb">▶</div>
            <div className="lesson-card-body">
              <h4>{l.title}</h4>
              <p>{l.subject_name} · معاينة مجانية</p>
            </div>
          </Link>
        ))}
        {content?.free_lessons?.length === 0 && (
          <p style={{ color: "var(--text-muted)" }}>لا توجد دروس مجانية بعد.</p>
        )}
      </div>

      {!user && (
        <div style={{ marginTop: 32, textAlign: "center" }}>
          <Link to="/register" className="btn btn-primary">أنشئ حساباً وابدأ التعلم</Link>
        </div>
      )}
    </div>
  );
}
