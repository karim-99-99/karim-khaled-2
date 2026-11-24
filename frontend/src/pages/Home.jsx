import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { filterSubjectsForUser } from "../auth/teacherScope";
import LandingExact from "../components/LandingExact";
import { getSubjectTheme, resolveSubjectKey } from "../theme/subjects";
import { formatSessionWhen, sessionDisplayTitle } from "../utils/sessionDate";
import { joinLiveSession } from "../utils/joinLiveSession";
import "../styles/dash-exact.css";

function cssCard(key) {
  if (key === "physics") return "s-phys";
  if (key === "chem") return "s-chem";
  if (key === "bio") return "s-bio";
  return "s-math";
}

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
      const nextP = client
        .get("/home/next-session/")
        .then((res) => {
          if (!cancelled) setNext(res.data);
        })
        .catch(() => {
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
      await Promise.all([freeP, nextP, dashP]);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user, isSubscribed, isSilver]);

  const session = next?.session;
  const sessionKey = resolveSubjectKey(session?.subject_name);
  const when = session ? formatSessionWhen(session.start_time) : null;

  const visibleSubjects = filterSubjectsForUser(content?.subjects || [], user);
  const subjectPanels = visibleSubjects.map((s) => {
    const key = resolveSubjectKey(s.name) || "math";
    return {
      subject: s,
      key,
      theme: getSubjectTheme(resolveSubjectKey(s.name)),
    };
  });

  const ctaTo = user ? "/subscription" : "/register";
  const courseTo = user ? "/courses" : "/login";
  // Daily tasks come from Tasks admin (phase 2) — empty until linked
  const homeworkTasks = [];
  const collectionTasks = [];
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
          <section className="next">
            <div>
              <small>الحصة القادمة</small>
              {session ? (
                <>
                  <h2>{sessionDisplayTitle(session)}</h2>
                  <p>
                    {session.subject_name}
                    {when ? ` · ${when}` : ""}
                  </p>
                  {joinMsg ? <p className="banner">{joinMsg}</p> : null}
                </>
              ) : (
                <>
                  <h2>لا توجد حصة قادمة</h2>
                  <p>لا توجد حصص مجدولة لك حالياً</p>
                </>
              )}
            </div>
            <div className="actions">
              {session ? (
                <button
                  type="button"
                  className="btn-y"
                  onClick={async () => {
                    try {
                      setJoinMsg("");
                      await joinLiveSession(session.id);
                    } catch {
                      setJoinMsg("تعذّر الانضمام للحصة الآن.");
                    }
                  }}
                >
                  انضم للحصة
                </button>
              ) : (
                <Link to="/schedule" className="btn-y">
                  جدول الحصص
                </Link>
              )}
            </div>
          </section>

          <div className="sec-head">
            <h3>المهام اليومية</h3>
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
                    <span>المطلوب تسليمه اليوم</span>
                  </div>
                </div>
                <div className="count">
                  {homeworkTasks.length}
                  <small>واجبات</small>
                </div>
              </div>
              <ul className="task-list">
                {homeworkTasks.map((t) => {
                  const key = resolveSubjectKey(t.subject_name || t.subject);
                  return (
                    <li key={t.id || t.title}>
                      <i className={`dot ${dotClass(key)}`} />
                      <div className="t-name">
                        {t.title || t.name}
                        <div className="t-meta">{t.subject_name || t.subject || "مادة"}</div>
                      </div>
                      <span className={`tag ${t.is_done ? "ok" : "due"}`}>
                        {t.is_done ? "تم التسليم" : t.status_label || "ينتهي اليوم"}
                      </span>
                    </li>
                  );
                })}
                {!homeworkTasks.length && (
                  <li>
                    <div className="t-name">
                      لا واجبات الآن
                      <div className="t-meta">تظهر بعد انتهاء حصة مجموعتك</div>
                    </div>
                  </li>
                )}
              </ul>
              <div className="task-foot">
                <Link to="/courses">عرض كل الواجبات</Link>
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
                  {collectionTasks.length}
                  <small>تجميعات</small>
                </div>
              </div>
              <ul className="task-list">
                {collectionTasks.map((t) => {
                  const key = resolveSubjectKey(t.subject_name || t.subject);
                  return (
                    <li key={t.id || t.title}>
                      <i className={`dot ${dotClass(key)}`} />
                      <div className="t-name">
                        {t.title || t.name}
                        <div className="t-meta">{t.subject_name || t.subject || "مادة"}</div>
                      </div>
                      <span className={`tag ${t.is_done ? "ok" : "new"}`}>
                        {t.is_done ? "مكتملة" : t.status_label || "جديد"}
                      </span>
                    </li>
                  );
                })}
                {!collectionTasks.length && (
                  <li>
                    <div className="t-name">
                      لا تجميعات مقترحة الآن
                      <div className="t-meta">تظهر بعد انتهاء حصة مجموعتك</div>
                    </div>
                  </li>
                )}
              </ul>
              <div className="task-foot">
                <Link to="/courses">عرض كل التجميعات</Link>
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
              <Link key={s.id} to={`/courses/${s.id}`} className={`scard ${cssCard(key)}`}>
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
                className={`home-subject-panel home-subject-panel--${key}`}
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
