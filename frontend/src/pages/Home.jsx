import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { resolveSubjectKey } from "../theme/subjects";
import { formatSessionWhen, sessionDisplayTitle } from "../utils/sessionDate";

export default function Home() {
  const { user } = useAuth();
  const [content, setContent] = useState(null);
  const [next, setNext] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const free = await client.get("/home/free-content/");
        if (!cancelled) setContent(free.data);
      } catch {
        if (!cancelled) setContent({ subjects: [], free_lessons: [] });
      }
      if (!user || cancelled) return;
      try {
        const nextRes = await client.get("/home/next-session/");
        if (!cancelled) setNext(nextRes.data);
      } catch {
        if (!cancelled) setNext(null);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const session = next?.session;
  const sessionKey = resolveSubjectKey(session?.subject_name);
  const when = session ? formatSessionWhen(session.start_time) : null;

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

      <div
        className={`hero${sessionKey ? " session-skin" : ""}`}
        {...(sessionKey ? { "data-subject": sessionKey } : {})}
      >
        <div>
          <div className="eyebrow">الحصة القادمة</div>
          {session ? (
            <>
              <h2>{sessionDisplayTitle(session)}</h2>
              <div className="meta session-date" style={{ minWidth: 0 }}>
                {when?.hijri ? (
                  <div className="session-date__hijri" style={{ color: "inherit", fontSize: 20, order: 1 }}>
                    {when.hijri}
                  </div>
                ) : null}
                {when?.gregorian && (
                  <div className="session-date__gregorian" style={{ color: "inherit", opacity: 0.75, order: 2 }}>
                    {when.gregorian}
                  </div>
                )}
                {when?.time && (
                  <div className="session-date__time" style={{ color: "inherit", opacity: 0.9, order: 3 }}>
                    {when.time}
                  </div>
                )}
                <div style={{ marginTop: 6, opacity: 0.85, fontSize: 13, order: 4 }}>
                  {[session.subject_name, session.teacher_name].filter(Boolean).join(" · ")}
                </div>
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
        {content?.subjects?.map((s) => {
          const cls = resolveSubjectKey(s.name) || "math";
          return (
            <Link key={s.id} to={user ? `/courses/${s.id}` : "/login"} className={`chip ${cls}`}>
              {s.name}
            </Link>
          );
        })}
      </div>

      <div className="section-title">الدروس المتاحة مجاناً</div>
      {!content && (
        <div className="spinner">
          جاري التحميل…
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8, fontWeight: 400 }}>
            إذا كان السيرفر نائماً قد يستغرق حتى دقيقة في أول مرة
          </div>
        </div>
      )}
      <div className="grid grid-4">
        {content?.free_lessons?.map((l, i) => {
          const thumb = ["", "gold", "teal", "rose"][i % 4];
          return (
            <Link key={l.id} to={user ? `/lessons/${l.id}` : "/login"} className="card">
              <div className={`lesson-thumb ${thumb}`.trim()}>▶</div>
              <div className="lesson-card-body">
                <h4>{l.title}</h4>
                <p>{l.subject_name} · معاينة مجانية</p>
              </div>
            </Link>
          );
        })}
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
