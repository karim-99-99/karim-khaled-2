import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { filterSubjectsForUser } from "../auth/teacherScope";
import VideoPlayer from "../components/VideoPlayer";
import { getSubjectTheme, resolveSubjectKey } from "../theme/subjects";
import { formatSessionWhen, sessionDisplayTitle } from "../utils/sessionDate";
import { joinLiveSession } from "../utils/joinLiveSession";

const FEATURES = [
  "حصص مباشرة وتفاعلية مع المعلمين.",
  "مجموعات صغيرة لا يتجاوز عددها 10 طلاب.",
  "جميع الحصص مسجلة، تقدر ترجع لها بأي وقت.",
  "معلموك معك عبر الواتساب على مدار 24 ساعة.",
  "جدول مرن يناسب جميع الطلاب.",
  "واجبات يومية واختبارات دورية لمتابعة مستواك.",
  "بنوك تجميعات محدثة تضم أكثر من 8000 سؤال.",
];

export default function Home() {
  const { user } = useAuth();
  const [content, setContent] = useState(null);
  const [next, setNext] = useState(null);
  const [joinMsg, setJoinMsg] = useState("");
  const isTeacher = user?.role === "teacher";
  const isAdmin = user?.role === "admin";
  const isSubscribed =
    user?.role === "student" && user?.has_active_subscription;
  const showMarketing = !user || (user.role === "student" && !user.has_active_subscription);
  const showFreePreview = !user || (user.role === "student" && !user.has_active_subscription);

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

  const ctaTo = user ? "/subscription" : "/register";

  return (
    <div className="home-page">
      {showMarketing && (
        <>
          <section className="landing-hero" aria-label="مرام للتحصيلي">
            <div className="landing-hero__media" aria-hidden="true">
              <img
                src="/maram-hero-students.jpg"
                alt=""
                className="landing-hero__img"
                width={1600}
                height={900}
                decoding="async"
                fetchPriority="high"
              />
              <div className="landing-hero__veil" />
            </div>
            <div className="landing-hero__content">
              <p className="landing-hero__tagline">مرام .. للتحصيلي بإتقان</p>
              <h1 className="landing-hero__title">
                تعبت من الحصص المسجلة؟ وتحتاج معلم يكون معك أول بأول؟
              </h1>
              <p className="landing-hero__lead">
                مع مرام، التحصيلي صار أسهل! مرام مو مجرد حصص، رحلة تعليم ومتابعة لين تحقق هدفك.
              </p>
              <div className="landing-hero__actions">
                <Link to={ctaTo} className="btn btn-primary landing-hero__cta">
                  ابدأ رحلتك مع مرام الآن
                </Link>
                <a href="#trial-week" className="btn btn-secondary landing-hero__cta-ghost">
                  الأسبوع التجريبي
                </a>
              </div>
            </div>
          </section>

          <section className="landing-section" id="features" aria-labelledby="features-title">
            <div className="landing-section__head">
              <h2 id="features-title">مميزات دورة مرام</h2>
              <p>كل اللي تحتاجه عشان تذاكر بإتقان وتوصل لهدفك.</p>
            </div>
            <ol className="landing-features">
              {FEATURES.map((text, i) => (
                <li key={text} className="landing-feature" style={{ animationDelay: `${i * 60}ms` }}>
                  <span className="landing-feature__num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="landing-feature__text">{text}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="landing-trial" id="trial-week" aria-labelledby="trial-title">
            <div className="landing-trial__inner">
              <h2 id="trial-title">استغل الأسبوع التجريبي</h2>
              <p>واستمتع بكل مميزات الدورة — جرّب التجربة كاملة قبل ما تلتزم.</p>
              <Link to={ctaTo} className="btn btn-primary">
                ابدأ الأسبوع التجريبي
              </Link>
            </div>
          </section>

          <section className="landing-section landing-stories" id="stories" aria-labelledby="stories-title">
            <div className="landing-section__head">
              <h2 id="stories-title">تجارب الطلاب</h2>
              <p>قريباً… هنا هنحط تجارب طلاب مرام.</p>
            </div>
            <div className="landing-stories__empty" role="status">
              <span>مساحة التجارب فاضية حالياً — هنملأها قريب.</span>
            </div>
          </section>
        </>
      )}

      {user && user.role === "student" && !user.has_active_subscription && (
        <div className="banner">
          الدرس المجاني: فيديوهات الدرس كاملة + الواجب + ١٠ أسئلة من التجميعات —
          للاشتراك الكامل{" "}
          <Link to="/subscription"><strong>اشترك الآن</strong></Link>.
        </div>
      )}

      {(user && (isSubscribed || isTeacher || isAdmin)) && (
        <>
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
                    {session.teacher_joined_zoom ? " · المدرس داخل الحصة ✓" : ""}
                  </div>
                </>
              ) : (
                <>
                  <h2>لا توجد حصة قادمة</h2>
                  <div className="meta">لا توجد حصص مجدولة لك حالياً</div>
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {session && (session.join_mode === "bbb" || session.join_mode === "zoom" || session.zoom_link) ? (
                <button
                  type="button"
                  className="btn"
                  onClick={async () => {
                    setJoinMsg("");
                    try {
                      if (session.join_mode === "zoom" && session.zoom_link) {
                        window.open(session.zoom_link, "_blank", "noopener,noreferrer");
                      } else {
                        await joinLiveSession(session.id);
                      }
                    } catch (e) {
                      setJoinMsg(e.response?.data?.detail || "تعذّر فتح الحصة");
                    }
                  }}
                >
                  ادخل الحصة ↗
                </button>
              ) : (
                <Link to="/schedule" className="btn">جدول الحصص</Link>
              )}
              {user && (
                <Link to="/smart-plan" className="btn btn-secondary">
                  الجدول الذكي
                </Link>
              )}
            </div>
          </div>
          {joinMsg && <div className="banner" style={{ marginBottom: 16 }}>{joinMsg}</div>}
        </>
      )}

      {(user || showMarketing) && (
        <>
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
        </>
      )}

      {!user && (
        <div className="landing-bottom-cta">
          <Link to="/register" className="btn btn-primary">أنشئ حساباً وابدأ مع مرام</Link>
        </div>
      )}
    </div>
  );
}
