import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";
import VideoPlayer from "../components/VideoPlayer";
import { getSubjectTheme, resolveSubjectKey } from "../theme/subjects";
import { formatSessionWhen, sessionDisplayTitle } from "../utils/sessionDate";

export default function Home() {
  const { user } = useAuth();
  const [content, setContent] = useState(null);
  const [next, setNext] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const freeP = client
        .get("/home/free-content/")
        .then((res) => {
          if (!cancelled) setContent(res.data);
        })
        .catch(() => {
          if (!cancelled) setContent({ subjects: [], free_lessons: [] });
        });
      if (!user) {
        await freeP;
        return;
      }
      const nextP = client
        .get("/home/next-session/")
        .then((res) => {
          if (!cancelled) setNext(res.data);
        })
        .catch(() => {
          if (!cancelled) setNext(null);
        });
      await Promise.all([freeP, nextP]);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const session = next?.session;
  const sessionKey = resolveSubjectKey(session?.subject_name);
  const when = session ? formatSessionWhen(session.start_time) : null;

  const freeBySubject = new Map();
  for (const l of content?.free_lessons || []) {
    const sid = String(l.subject);
    if (!freeBySubject.has(sid)) freeBySubject.set(sid, l);
  }
  const subjectPanels = (content?.subjects || []).map((s) => {
    const key = resolveSubjectKey(s.name) || "math";
    return {
      subject: s,
      freeLesson: freeBySubject.get(String(s.id)) || null,
      key,
      theme: getSubjectTheme(resolveSubjectKey(s.name)),
    };
  });

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
      <p className="home-subjects__lead">
        اختر مادتك، وشاهد الدرس المجاني مباشرة أسفل كل مادة
      </p>

      {!content && (
        <div className="spinner">
          جاري التحميل…
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8, fontWeight: 400 }}>
            إذا كان السيرفر نائماً قد يستغرق حتى دقيقة في أول مرة
          </div>
        </div>
      )}

      {content && subjectPanels.length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>لا توجد مواد بعد.</p>
      )}

      <div className="home-subjects">
        {subjectPanels.map(({ subject: s, freeLesson, key, theme }, index) => {
          const courseTo = user ? `/courses/${s.id}` : "/login";
          const lessonTo = freeLesson
            ? user
              ? `/lessons/${freeLesson.id}`
              : "/login"
            : courseTo;
          const bunnyId =
            freeLesson?.preview_bunny_id || freeLesson?.bunny_video_id || "";

          return (
            <article
              key={s.id}
              className={`home-subject-panel home-subject-panel--${key}`}
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <Link to={courseTo} className="home-subject-panel__head">
                <div className="home-subject-panel__glow" aria-hidden />
                {theme?.logo ? (
                  <img
                    src={theme.logo}
                    alt=""
                    className="home-subject-panel__logo"
                  />
                ) : null}
                <div className="home-subject-panel__titles">
                  <h3>{s.name}</h3>
                  <span>ادخل الدورة</span>
                </div>
              </Link>

              <div className="home-subject-panel__free">
                <div className="home-subject-panel__free-label">
                  <span className="home-subject-panel__pill">مجاني</span>
                  <span>معاينة الدرس الأول</span>
                </div>

                {freeLesson ? (
                  <>
                    {bunnyId ? (
                      <div className="home-subject-panel__player">
                        <VideoPlayer bunnyId={bunnyId} />
                      </div>
                    ) : (
                      <Link to={lessonTo} className="home-subject-panel__thumb">
                        <span className="home-subject-panel__play">▶</span>
                        <span>افتح الدرس المجاني</span>
                      </Link>
                    )}
                    <Link to={lessonTo} className="home-subject-panel__lesson">
                      <strong>{freeLesson.title}</strong>
                      <span>شاهد الدرس ←</span>
                    </Link>
                  </>
                ) : (
                  <div className="home-subject-panel__empty">
                    قريباً درس مجاني لهذه المادة
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {!user && (
        <div style={{ marginTop: 36, textAlign: "center" }}>
          <Link to="/register" className="btn btn-primary">أنشئ حساباً وابدأ التعلم</Link>
        </div>
      )}
    </div>
  );
}
