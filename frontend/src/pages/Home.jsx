import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { filterSubjectsForUser } from "../auth/teacherScope";
import VideoPlayer from "../components/VideoPlayer";
import { getSubjectTheme, resolveSubjectKey } from "../theme/subjects";
import { formatSessionWhen, sessionDisplayTitle } from "../utils/sessionDate";

export default function Home() {
  const { user } = useAuth();
  const [content, setContent] = useState(null);
  const [next, setNext] = useState(null);
  const isTeacher = user?.role === "teacher";

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
  const visibleSubjects = filterSubjectsForUser(content?.subjects || [], user);
  const subjectPanels = visibleSubjects.map((s) => {
    const key = resolveSubjectKey(s.name) || "math";
    return {
      subject: s,
      freeLesson: freeBySubject.get(String(s.id)) || null,
      key,
      theme: getSubjectTheme(resolveSubjectKey(s.name)),
    };
  });

  const isSubscribed =
    user?.role === "student" && user?.has_active_subscription;
  const showFreePreview = !user || (user.role === "student" && !user.has_active_subscription);

  return (
    <div>
      {user && user.role === "student" && !user.has_active_subscription && (
        <div className="banner">
          الدرس المجاني: فيديوهات الدرس كاملة + الواجب + ١٠ أسئلة من التجميعات —
          للاشتراك الكامل{" "}
          <Link to="/subscription"><strong>اشترك الآن</strong></Link>.
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
              <div className="meta session-date" style={{ minWidth: 0, marginBottom: 10 }}>
                <div
                  className="session-date__dayline"
                  style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}
                >
                  {when?.weekday ? (
                    <span style={{ fontSize: 22, fontWeight: 800 }}>{when.weekday}</span>
                  ) : null}
                  {when?.time ? (
                    <span style={{ fontSize: 22, fontWeight: 800 }}>{when.time}</span>
                  ) : null}
                </div>
                {when?.hijri ? (
                  <div style={{ opacity: 0.95, fontSize: 15, marginTop: 4 }}>{when.hijri}</div>
                ) : null}
                {when?.gregorian ? (
                  <div style={{ opacity: 0.75, fontSize: 13 }}>{when.gregorian}</div>
                ) : null}
              </div>
              <h2 style={{ marginTop: 0 }}>{sessionDisplayTitle(session)}</h2>
              <div className="meta" style={{ marginTop: 6, opacity: 0.9, fontSize: 14 }}>
                {session.subject_name}
                {session.teacher_joined_zoom ? " · المدرس في Zoom ✓" : ""}
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

      <div className="section-title">
        {isTeacher ? (subjectPanels.length > 1 ? "موادك" : "مادتك") : "تصفح حسب المادة"}
      </div>
      {showFreePreview && (
        <p className="home-subjects__lead">
          اختر مادتك، وشاهد الدرس المجاني مباشرة أسفل كل مادة (فيديوهات + واجب + ١٠ أسئلة تجميع)
        </p>
      )}
      {isSubscribed && (
        <p className="home-subjects__lead">اختر مادتك للدخول إلى الدورة</p>
      )}
      {isTeacher && (
        <p className="home-subjects__lead">
          مادتك المخصصة فقط — ادخل لإدارة الدروس والأسئلة
        </p>
      )}

      {!content && (
        <div className="spinner">
          جاري التحميل…
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8, fontWeight: 400 }}>
            إذا كان السيرفر نائماً قد يستغرق حتى دقيقة في أول مرة
          </div>
        </div>
      )}

      {content && subjectPanels.length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>
          {isTeacher
            ? "لم تُخصص لك مادة بعد — تواصل مع الإدارة."
            : "لا توجد مواد بعد."}
        </p>
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
                  <span>{isTeacher ? "إدارة المادة" : "ادخل الدورة"}</span>
                </div>
              </Link>

              {showFreePreview && (
              <div className="home-subject-panel__free">
                <div className="home-subject-panel__free-label">
                  <span className="home-subject-panel__pill">مجاني</span>
                  <span>فيديو · واجب · ١٠ أسئلة تجميع</span>
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
                    {user && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                        <Link
                          to={`/courses/${s.id}/collections/${freeLesson.id}`}
                          className="btn btn-secondary btn-sm"
                        >
                          تجميع (١٠ أسئلة)
                        </Link>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="home-subject-panel__empty">
                    قريباً درس مجاني لهذه المادة
                  </div>
                )}
              </div>
              )}
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
