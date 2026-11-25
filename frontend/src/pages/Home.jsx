import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { filterSubjectsForUser } from "../auth/teacherScope";
import LandingExact from "../components/LandingExact";
import { getSubjectTheme, resolveSubjectKey, subjectClass } from "../theme/subjects";
import { formatSessionWhen, sessionDisplayTitle, sessionTeacherName, toArabicDigits, effectiveSessionStatus } from "../utils/sessionDate";
import { joinLiveSession } from "../utils/joinLiveSession";
import "../styles/dash-exact.css";

function dotClass(key) {
  if (key === "physics") return "p";
  if (key === "chem") return "c";
  if (key === "bio") return "b";
  return "m";
}

export default function Home() {
  const { user } = useAuth();
  const [content, setContent] = useState(null);
  const [next, setNext] = useState(null);
  const [joinMsg, setJoinMsg] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [dailyTasks, setDailyTasks] = useState([]);
  const isTeacher = user?.role === "teacher";
  const isAdmin = user?.role === "admin";
  const isSubscribed = user?.role === "student" && user?.has_active_subscription;
  const isGold = Boolean(user?.is_gold) || isTeacher || isAdmin;
  const isSilver = Boolean(user?.is_silver);
  const showMarketing = !user || (user.role === "student" && !user.has_active_subscription);
  const showStudentDash = isSubscribed;
  const showGoldHome = isSubscribed && isGold && !isSilver;

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
      const nextP =
        isSubscribed && !isSilver
          ? client
              .get("/home/next-session/")
              .then((res) => {
                if (!cancelled) setNext(res.data);
              })
              .catch(() => {
                if (!cancelled) setNext(null);
              })
          : Promise.resolve().then(() => {
              if (!cancelled) setNext(null);
            });
      const dashP =
        isSubscribed && !isSilver
          ? client
              .get("/teacher-tests/")
              .catch(() => ({ data: [] }))
              .then((testsRes) => {
                if (cancelled) return;
                setDashboard({
                  plan: null,
                  tests: testsRes.data?.results || testsRes.data || [],
                });
              })
          : Promise.resolve().then(() => {
              if (!cancelled) setDashboard({ plan: null, tests: [] });
            });
      const tasksP =
        isSubscribed && !isSilver
          ? client
              .get("/home/time-rules/")
              .then((res) => {
                if (!cancelled) {
                  setDailyTasks(res.data.current_daily_tasks || res.data.released_tasks || []);
                }
              })
              .catch(() => {
                if (!cancelled) setDailyTasks([]);
              })
          : Promise.resolve().then(() => {
              if (!cancelled) setDailyTasks([]);
            });
      await Promise.all([freeP, nextP, dashP, tasksP]);
    };
    load();
    // Poll next-class card so «مباشر الآن» appears without full page refresh (Task 15).
    let timer = null;
    if (isSubscribed && !isSilver) {
      timer = window.setInterval(() => {
        client
          .get("/home/next-session/")
          .then((res) => {
            if (!cancelled) setNext(res.data);
          })
          .catch(() => {});
      }, 20000);
    }
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [user, isSubscribed, isSilver]);

  const session = next?.session;
  const sessionKey = session ? resolveSubjectKey(session) : null;
  const when = session ? formatSessionWhen(session.start_time) : null;
  const classState =
    next?.time_rules?.next_class?.state ||
    (session?.teacher_joined_zoom
      ? "live"
      : session && effectiveSessionStatus(session) === "live"
        ? "waiting_teacher"
        : session
          ? "upcoming"
          : null);
  const teacherIn = classState === "live";
  const classStarted = classState === "waiting_teacher" || classState === "live";

  const visibleSubjects = filterSubjectsForUser(content?.subjects || [], user);
  const subjectPanels = visibleSubjects.map((s) => {
    const key = resolveSubjectKey(s);
    return {
      subject: s,
      key,
      theme: getSubjectTheme(key),
    };
  });

  const ctaTo = user ? "/subscription" : "/register";
  const courseTo = user ? "/courses" : "/login";
  // Daily tasks come from Tasks admin (phase 2) — empty until linked
  const homeworkTasks = dailyTasks.filter((t) => t.type === "homework");
  const collectionTasks = dailyTasks.filter((t) => t.type === "collection");
  const hwOpen = homeworkTasks.filter((t) => !t.is_done);
  const colOpen = collectionTasks.filter((t) => !t.is_done);
  const allDone =
    dailyTasks.length > 0 && homeworkTasks.every((t) => t.is_done) && collectionTasks.every((t) => t.is_done);
  const nextWhenLabel = when
    ? [when.weekday || when.dayLabel, when.time].filter(Boolean).join(" · ")
    : "";

  function taskHref(t) {
    if (t.type === "homework" && t.lesson_id && t.homework_sub_lesson_id) {
      return `/lessons/${t.lesson_id}?hw=${t.homework_sub_lesson_id}`;
    }
    if (t.type === "collection" && t.subject_id && t.collection_lesson_id) {
      if (t.collection_sub_lesson_id) {
        return `/courses/${t.subject_id}/collections/${t.collection_lesson_id}/sub/${t.collection_sub_lesson_id}`;
      }
      return `/courses/${t.subject_id}/collections/${t.collection_lesson_id}`;
    }
    return "/courses";
  }

  function renderTaskRows(rows) {
    const shown = rows.slice(0, 3);
    const rest = rows.length - shown.length;
    return (
      <>
        {shown.map((t) => {
          const key = resolveSubjectKey(t.subject_name || t.subject);
          const done = Boolean(t.is_done);
          return (
            <li key={t.id || t.title} style={done ? { opacity: 0.65 } : undefined}>
              <i className={`dot ${dotClass(key)}`} />
              <div className="t-name" style={done ? { textDecoration: "line-through" } : undefined}>
                <Link to={taskHref(t)} style={{ color: "inherit", textDecoration: "none" }}>
                  {t.title || t.name}
                </Link>
                <div className="t-meta">
                  {t.subject_name || t.subject || "مادة"}
                  {t.question_count != null ? ` · ${t.question_count} سؤال` : ""}
                </div>
              </div>
              <span className={`tag ${done ? "ok" : t.type === "collection" ? "new" : "due"}`}>
                {done ? "✓ تم" : t.type === "collection" ? "ابدأ ←" : "ينتهي اليوم"}
              </span>
            </li>
          );
        })}
        {rest > 0 && (
          <li>
            <div className="t-name">
              <Link to="/daily-tasks">+ {rest} أخرى</Link>
            </div>
          </li>
        )}
        {!rows.length && (
          <li>
            <div className="t-name">
              {allDone
                ? "خلّصت مهام اليوم 🎉"
                : !dailyTasks.length && nextWhenLabel
                  ? `لا مهام الآن · هتظهر بعد حصتك الجاية ${nextWhenLabel}`
                  : !dailyTasks.length
                    ? "لا مهام الآن · هتظهر بعد حصتك الجاية"
                    : "لا مهام من هذا النوع الآن"}
            </div>
          </li>
        )}
      </>
    );
  }
  const todayTests = (dashboard?.tests || [])
    .filter((t) => !(t.solved || t.my_score != null || t.status === "solved") && !(t.is_upcoming || t.status === "upcoming"))
    .slice(0, 1);

  if (showMarketing) {
    return <LandingExact ctaTo={ctaTo} courseTo={courseTo} />;
  }

  return (
    <div className={showStudentDash ? "dash-exact" : "home-page home-page--dash"}>
      {showStudentDash && showGoldHome && (
        <>
          <section className={session ? `nc ${subjectClass(sessionKey)}` : "next"}>
            {session ? (
              <>
                <span className="n">
                  {session.session_number ? toArabicDigits(session.session_number) : "—"}
                </span>
                <div className="mid">
                  <div className="ttl">
                    <span className="ttl-text">{sessionDisplayTitle(session)}</span>
                    {session.is_extra ? <span className="pill">حصة إضافية</span> : null}
                  </div>
                  <div className="sub2">
                    {session.subject_name}
                    {sessionTeacherName(session) ? ` · ${sessionTeacherName(session)}` : ""}
                  </div>
                  <div className="time">{when.timeLine}</div>
                  {when.hijri ? <div className="hij">{when.hijri}</div> : null}
                  <div className="greg">{when.gregorian}</div>
                  {joinMsg ? <p className="banner">{joinMsg}</p> : null}
                </div>
                <div className="state">
                  <div className="state-copy">
                    {teacherIn ? (
                      <span className="nc-live"><i />مباشر الآن</span>
                    ) : classStarted ? (
                      <>
                        <span className="nc-soon">ستبدأ قريبًا</span>
                        <div className="stx">في انتظار دخول المعلم</div>
                      </>
                    ) : (
                      <div className="stx">المدرس لم يدخل الحصة بعد</div>
                    )}
                  </div>
                  {teacherIn ? (
                    <button
                      type="button"
                      className="btn"
                      onClick={async () => {
                        try {
                          setJoinMsg("");
                          await joinLiveSession(session.id);
                        } catch {
                          setJoinMsg("تعذّر الانضمام للحصة الآن.");
                        }
                      }}
                    >
                      ادخل الحصة ←
                    </button>
                  ) : (
                    <button type="button" className="btn dis" disabled>
                      ادخل الحصة
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div>
                  <small>الحصة القادمة</small>
                  <h2>لا توجد حصة قادمة</h2>
                  <p>لا توجد حصص مجدولة لك حالياً</p>
                </div>
                <div className="actions">
                  <Link to="/schedule" className="btn-y">
                    جدول الحصص
                  </Link>
                </div>
              </>
            )}
          </section>

          <div className="sec-head">
            <Link to="/daily-tasks" style={{ color: "inherit", textDecoration: "none" }}>
              <h3>المهام اليومية</h3>
            </Link>
            <p>واجباتك وتجميعات اليوم في مكان واحد</p>
          </div>

          <section className="tasks">
            <div className="task-card hw">
              <div className="task-top">
                <div className="task-title">
                  <div className="ico">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 11l3 3L22 4" />
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                    </svg>
                  </div>
                  <div>
                    <h4>الواجبات</h4>
                    <span>المطلوب تسليمه</span>
                  </div>
                </div>
                <div className="count">
                  {hwOpen.length}
                  <small>واجبات</small>
                </div>
              </div>
              <ul className="task-list">{renderTaskRows(homeworkTasks)}</ul>
              <div className="task-foot">
                <Link to="/daily-tasks">عرض كل الواجبات</Link>
              </div>
            </div>

            <div className="task-card col">
              <div className="task-top">
                <div className="task-title">
                  <div className="ico">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                      <path d="M9 7h7M9 11h5" />
                    </svg>
                  </div>
                  <div>
                    <h4>التجميعات</h4>
                    <span>تجميعات اليوم المقترحة</span>
                  </div>
                </div>
                <div className="count">
                  {colOpen.length}
                  <small>تجميعات</small>
                </div>
              </div>
              <ul className="task-list">{renderTaskRows(collectionTasks)}</ul>
              <div className="task-foot">
                <Link to="/daily-tasks">عرض كل التجميعات</Link>
              </div>
            </div>
          </section>

          <div className="task-card ex">
            <div className="task-top">
              <div className="task-title">
                <div className="ico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                    <path d="M9 15l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <h4>اختبار اليوم</h4>
                  <span>اختبار واحد يومياً على دروسك</span>
                </div>
              </div>
            </div>
            <div className="ex-one">
              <div className="ex-main">
                {todayTests[0] ? (
                  <>
                    <div className="ex-head2">
                      <span className="tag new">{todayTests[0].subject_name || "مادة"}</span>
                    </div>
                    <b>{todayTests[0].title || todayTests[0].name}</b>
                    <p>اختبار على دروسك، يتم تصحيحه تلقائياً وتظهر نتيجتك فوراً</p>
                  </>
                ) : (
                  <>
                    <b>ما في اختبار مفتوح الآن</b>
                    <p>جرّب المحاكي الشخصي لاختبار نفسك على أي مادة</p>
                  </>
                )}
              </div>
              {todayTests[0] && (
                <div className="ex-stats">
                  <div>
                    <strong>{todayTests[0].question_count || "—"}</strong>
                    <span>سؤال</span>
                  </div>
                  <div>
                    <strong>{todayTests[0].duration_minutes || todayTests[0].time_limit_minutes || "—"}</strong>
                    <span>دقيقة</span>
                  </div>
                  <div>
                    <strong>1</strong>
                    <span>محاولة</span>
                  </div>
                </div>
              )}
              <Link to={todayTests[0] ? "/tests" : "/tests/simulator"} className="ex-btn big">
                {todayTests[0] ? "ابدأ الاختبار" : "افتح المحاكي"}
              </Link>
            </div>
          </div>

        </>
      )}

      {showStudentDash && (
        <>
          <div className="sec-head">
            <h3>تصفح حسب المادة</h3>
            <p>اختر مادتك للدخول إلى الدورة</p>
          </div>
          {!content && <div className="spinner">جاري التحميل…</div>}
          <section className="grid4">
            {subjectPanels.map(({ subject: s, key, theme }) => (
              <Link key={s.id} to={`/courses/${s.id}`} className={`scard ${subjectClass(key)}`}>
                {theme?.logo ? <img src={theme.logo} alt={s.name} /> : null}
                <div className="go">ادخل الدورة ←</div>
              </Link>
            ))}
          </section>
          <div className="final">
            <img src="/maram-real.png" alt="" />
            <div className="txt">
              <h2>دورة المراجعة النهائية</h2>
              <p>مراجعة شاملة لكل المواد قبل اختبار التحصيلي</p>
            </div>
            <div className="soon">قريباً</div>
          </div>
        </>
      )}

      {(isTeacher || isAdmin) && (
        <>
          <div
            className={`hero${sessionKey ? " session-skin" : ""}`}
            {...(sessionKey ? { "data-subject": sessionKey } : {})}
            style={{ marginBottom: 24 }}
          >
            <div>
              <div className="eyebrow">الحصة القادمة</div>
              {session ? (
                <>
                  <h2 style={{ marginTop: 0 }}>{sessionDisplayTitle(session)}</h2>
                  <div className="meta">{session.subject_name}</div>
                </>
              ) : (
                <>
                  <h2>لا توجد حصة قادمة</h2>
                  <div className="meta">لا توجد حصص مجدولة لك حالياً</div>
                </>
              )}
            </div>
            <Link to="/schedule" className="btn">
              جدول الحصص
            </Link>
          </div>

          <div className="section-title" style={{ marginTop: 28 }}>
            {subjectPanels.length > 1 ? "موادك" : "مادتك"}
          </div>
          <p className="home-subjects__lead">اختر مادتك للدخول إلى الدورة</p>
          {!content && <div className="spinner">جاري التحميل…</div>}
          <div className="home-subjects">
            {subjectPanels.map(({ subject: s, key, theme }, index) => (
              <Link
                key={s.id}
                to={`/courses/${s.id}`}
                className={`home-subject-panel home-subject-panel--${key || "brand"}`}
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <div className="home-subject-panel__head">
                  <div className="home-subject-panel__glow" aria-hidden />
                  {theme?.logo ? <img src={theme.logo} alt="" className="home-subject-panel__logo" /> : null}
                  <div className="home-subject-panel__titles">
                    <h3>{s.name}</h3>
                    <span>إدارة المادة</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
