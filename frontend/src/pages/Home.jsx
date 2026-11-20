import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { filterSubjectsForUser } from "../auth/teacherScope";
import VideoPlayer from "../components/VideoPlayer";
import { getSubjectTheme, resolveSubjectKey } from "../theme/subjects";
import { formatSessionWhen, sessionDisplayTitle } from "../utils/sessionDate";
import { joinLiveSession } from "../utils/joinLiveSession";
import { whatsappHref } from "../legal/business";

const FEATURES = [
  { title: "حصص مباشرة", text: "حصص تفاعلية مع المعلمين." },
  { title: "مجموعات صغيرة", text: "لا يتجاوز العدد 10 طلاب." },
  { title: "حصص مسجّلة", text: "ترجع لها بأي وقت." },
  { title: "واتساب 24 ساعة", text: "معلموك معك على مدار الساعة." },
  { title: "جدول مرن", text: "يناسب جميع الطلاب." },
  { title: "واجبات واختبارات", text: "متابعة يومية لمستواك." },
  { title: "بنك أسئلة", text: "أكثر من 8000 سؤال محدّث." },
];

const STEPS = [
  "اختر باقتك",
  "تواصل مع الدعم",
  "يبدأ الأسبوع التجريبي",
  "انضم للمجموعات وابدأ",
];

const FAQS = [
  {
    q: "هل الحصص مباشرة أم مسجّلة؟",
    a: "الاثنان مع بعض: حصص مباشرة تفاعلية، وكل الحصص تتسجّل وترجع لها في أي وقت.",
  },
  {
    q: "كم عدد الطلاب في المجموعة؟",
    a: "المجموعات صغيرة ولا يتجاوز عددها 10 طلاب عشان التفاعل والمتابعة.",
  },
  {
    q: "هل فيه أسبوع تجريبي؟",
    a: "نعم، تقدر تستغل الأسبوع التجريبي وتستمتع بمميزات الدورة قبل الالتزام.",
  },
  {
    q: "هل المدرس متواصل معايا خارج الحصة؟",
    a: "نعم، معلموك معك عبر الواتساب على مدار 24 ساعة.",
  },
];

const STATS = [
  { value: "+8000", label: "بنك أسئلة" },
  { value: "10", label: "طلاب كحد أقصى للمجموعة" },
  { value: "24/7", label: "متابعة المعلمين" },
  { value: "∞", label: "الحصص المسجّلة معك" },
];

export default function Home() {
  const { user } = useAuth();
  const [content, setContent] = useState(null);
  const [next, setNext] = useState(null);
  const [joinMsg, setJoinMsg] = useState("");
  const [openFaq, setOpenFaq] = useState(0);
  const [dashboard, setDashboard] = useState(null);
  const isTeacher = user?.role === "teacher";
  const isAdmin = user?.role === "admin";
  const isSubscribed =
    user?.role === "student" && user?.has_active_subscription;
  const showMarketing = !user || (user.role === "student" && !user.has_active_subscription);
  const showFreePreview = !user || (user.role === "student" && !user.has_active_subscription);
  const showStudentDash = isSubscribed;

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
      const dashP = isSubscribed
        ? Promise.all([
            client.get("/smart-plan/").catch(() => ({ data: null })),
            client.get("/teacher-tests/").catch(() => ({ data: [] })),
          ]).then(([planRes, testsRes]) => {
            if (cancelled) return;
            setDashboard({
              plan: planRes.data,
              tests: testsRes.data?.results || testsRes.data || [],
            });
          })
        : Promise.resolve();
      await Promise.all([freeP, nextP, dashP]);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user, isSubscribed]);

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
  const waSupport = whatsappHref("مرحبا، أحتاج باقة مخصصة مع مرام");
  const planTasks = dashboard?.plan?.tasks || dashboard?.plan?.today_tasks || [];
  const todayTests = (dashboard?.tests || []).filter((t) => t.status === "available" || t.is_available).slice(0, 1);

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
                تعبت من الحصص المسجّلة؟ معلمك معك أول بأول
              </h1>
              <p className="landing-hero__lead">
                مع مرام، التحصيلي صار أسهل — رحلة تعليم ومتابعة لين تحقق هدفك.
              </p>
              <div className="landing-hero__actions">
                <Link to={ctaTo} className="btn btn-primary landing-hero__cta">
                  احجز مقعدك الآن
                </Link>
                <a href="#trial-week" className="btn btn-secondary landing-hero__cta-ghost">
                  جرب الأسبوع التجريبي
                </a>
              </div>
              <div className="landing-stats">
                {STATS.map((s) => (
                  <div key={s.label} className="landing-stats__item">
                    <strong>{s.value}</strong>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="landing-section" id="features">
            <div className="landing-section__head">
              <h2>مميزات دورة مرام</h2>
              <p>كل اللي تحتاجه عشان تذاكر بإتقان وتوصل لهدفك.</p>
            </div>
            <div className="landing-feature-grid">
              {FEATURES.map((f, i) => (
                <article key={f.title} className="landing-feature-card" style={{ animationDelay: `${i * 50}ms` }}>
                  <span className="landing-feature-card__num">{i + 1}</span>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </article>
              ))}
              <Link to={ctaTo} className="landing-feature-card landing-feature-card--cta">
                <h3>جاهز تبدأ؟</h3>
                <p>ابدأ رحلتك مع مرام الآن</p>
                <span className="btn btn-primary btn-sm">ابدأ الآن</span>
              </Link>
            </div>
          </section>

          <section className="landing-section" id="how-start">
            <div className="landing-section__head">
              <h2>كيف تبدأ مع مرام؟</h2>
              <p>أربع خطوات واضحة من الاختيار لحد أول حصة.</p>
            </div>
            <ol className="landing-steps">
              {STEPS.map((step, i) => (
                <li key={step}>
                  <span>{i + 1}</span>
                  <strong>{step}</strong>
                </li>
              ))}
            </ol>
          </section>

          <section className="landing-promo" id="trial-week">
            <div className="landing-promo__badge">خصم 33%</div>
            <div>
              <h2>استغل عرض التسجيل المبكر</h2>
              <ul>
                <li>وفّر على الباقة الذهبية مع عرض التسجيل المبكر.</li>
                <li>إمكانية التقسيط على دفعات ميسّرة.</li>
                <li>استمتع بالأسبوع التجريبي وبكل مميزات الدورة.</li>
              </ul>
            </div>
            <div className="landing-promo__actions">
              <Link to="/pricing" className="btn btn-primary">شاهد الباقات</Link>
              <a className="btn btn-secondary" href={waSupport} target="_blank" rel="noreferrer">
                واتساب الدعم
              </a>
            </div>
          </section>

          <section className="landing-section" id="subjects-browse">
            <div className="landing-section__head">
              <h2>تصفح حسب المادة</h2>
              <p>اختر مادتك وابدأ بدرس تجريبي أو ادخل الدورة.</p>
            </div>
          </section>
        </>
      )}

      {showStudentDash && (
        <section className="dash-home">
          <div className="dash-home__top">
            <div className="dash-home__daily ui-card">
              <div className="dash-home__daily-label">المهام اليومية</div>
              <div className="dash-home__daily-main">
                <div className="dash-home__ring">
                  <strong>{Math.min(planTasks.filter((t) => t.done || t.completed).length, 4)}/4</strong>
                  <span>مهام</span>
                </div>
                <div>
                  <h2>خطة اليوم</h2>
                  <p>
                    {planTasks.length
                      ? `${planTasks.length} مهمة في خطتك — كمّل عشان تحافظ على الستريك.`
                      : "ما في مهام مربوطة اليوم — ولّد جدولك الذكي أو راجع جدول الحصص."}
                  </p>
                </div>
              </div>
            </div>
            <div className="dash-home__streak ui-card">
              <div className="dash-home__streak-fire">🔥</div>
              <strong>استمر</strong>
              <p>تابع الواجبات والتجميعات يومياً.</p>
              <Link to="/smart-plan" className="btn btn-secondary btn-sm">الجدول الذكي</Link>
            </div>
          </div>

          <div
            className={`hero${sessionKey ? " session-skin" : ""}`}
            {...(sessionKey ? { "data-subject": sessionKey } : {})}
          >
            <div>
              <div className="eyebrow">الحصة القادمة</div>
              {session ? (
                <>
                  <h2 style={{ marginTop: 0 }}>{sessionDisplayTitle(session)}</h2>
                  <div className="meta">
                    {when?.weekday} {when?.time} · {session.subject_name}
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
            </div>
          </div>
          {joinMsg && <div className="banner">{joinMsg}</div>}

          <div className="dash-home__cols">
            <div className="ui-card dash-home__list">
              <h3>الواجبات — مطلوبة اليوم</h3>
              {(planTasks.filter((t) => t.kind === "foundation") || []).slice(0, 3).map((t) => (
                <div key={t.id || t.title} className="dash-home__row">
                  <span>{t.title || t.lesson_title || "واجب"}</span>
                  <Link to={t.lesson ? `/lessons/${t.lesson}` : "/smart-plan"} className="btn btn-sm btn-secondary">
                    ابدأ
                  </Link>
                </div>
              ))}
              {!planTasks.filter((t) => t.kind === "foundation").length && (
                <p className="dash-home__empty">لا واجبات ظاهرة الآن — راجع الجدول الذكي.</p>
              )}
              <Link to="/smart-plan" className="dash-home__more">عرض كل الواجبات</Link>
            </div>
            <div className="ui-card dash-home__list">
              <h3>التجميعات — مقترحة اليوم</h3>
              {(planTasks.filter((t) => t.kind === "collections") || []).slice(0, 3).map((t) => (
                <div key={t.id || t.title} className="dash-home__row">
                  <span>{t.title || t.lesson_title || "تجميع"}</span>
                  <Link
                    to={t.subject && t.lesson ? `/courses/${t.subject}/collections/${t.lesson}` : "/courses"}
                    className="btn btn-sm btn-secondary"
                  >
                    ابدأ
                  </Link>
                </div>
              ))}
              {!planTasks.filter((t) => t.kind === "collections").length && (
                <p className="dash-home__empty">لا تجميعات مقترحة الآن.</p>
              )}
              <Link to="/courses" className="dash-home__more">عرض كل التجميعات</Link>
            </div>
          </div>

          <div className="ui-card dash-home__exam">
            <div>
              <h3>اختبار اليوم</h3>
              {todayTests[0] ? (
                <p>{todayTests[0].title || todayTests[0].name}</p>
              ) : (
                <p>ما في اختبار مفتوح الآن — جرّب المحاكي الشخصي.</p>
              )}
            </div>
            <Link to={todayTests[0] ? "/tests" : "/tests/simulator"} className="btn btn-primary">
              {todayTests[0] ? "ابدأ الاختبار" : "افتح المحاكي"}
            </Link>
          </div>
        </section>
      )}

      {user && user.role === "student" && !user.has_active_subscription && (
        <div className="banner">
          الدرس المجاني: فيديوهات الدرس كاملة + الواجب + ١٠ أسئلة من التجميعات —
          للاشتراك الكامل{" "}
          <Link to="/subscription"><strong>اشترك الآن</strong></Link>.
        </div>
      )}

      {(user && (isTeacher || isAdmin) && !showStudentDash) && (
        <>
          <div
            className={`hero${sessionKey ? " session-skin" : ""}`}
            {...(sessionKey ? { "data-subject": sessionKey } : {})}
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
            <Link to="/schedule" className="btn">جدول الحصص</Link>
          </div>
        </>
      )}

      {(user || showMarketing) && (
        <>
          <div className="section-title">
            {isTeacher ? (subjectPanels.length > 1 ? "موادك" : "مادتك") : "تصفح حسب المادة"}
          </div>
          {showFreePreview && (
            <p className="home-subjects__lead">
              اختر مادتك، وشاهد الدرس المجاني مباشرة أسفل كل مادة
            </p>
          )}
          {(isSubscribed || isTeacher) && (
            <p className="home-subjects__lead">اختر مادتك للدخول إلى الدورة</p>
          )}

          {!content && (
            <div className="spinner">جاري التحميل…</div>
          )}

          {content && subjectPanels.length === 0 && (
            <p style={{ color: "var(--text-muted)" }}>
              {isTeacher ? "لم تُخصص لك مادة بعد." : "لا توجد مواد بعد."}
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
                      <img src={theme.logo} alt="" className="home-subject-panel__logo" />
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
                        <span>فيديو · واجب · ١٠ أسئلة</span>
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
                        <div className="home-subject-panel__empty">قريباً درس مجاني لهذه المادة</div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {(showMarketing || showStudentDash) && (
            <div className="landing-final-banner ui-card">
              <div>
                <h3>دورة المراجعة النهائية</h3>
                <p>مراجعة شاملة لكل المواد قبل اختبار التحصيلي.</p>
              </div>
              <span className="btn btn-secondary" aria-disabled="true">قريباً</span>
            </div>
          )}
        </>
      )}

      {showMarketing && (
        <>
          <section className="landing-section" id="faq">
            <div className="landing-section__head">
              <h2>الأسئلة الشائعة</h2>
            </div>
            <div className="landing-faq">
              {FAQS.map((item, i) => (
                <details
                  key={item.q}
                  className="landing-faq__item"
                  open={openFaq === i}
                  onToggle={(e) => {
                    if (e.target.open) setOpenFaq(i);
                  }}
                >
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="landing-support ui-card">
            <div>
              <h2>محتاج باقة مختلفة؟</h2>
              <p>نصمّم لك باقة خاصة — مادة واحدة، خصوصي، أو مواضيع محددة.</p>
            </div>
            <a className="btn btn-primary" href={waSupport} target="_blank" rel="noreferrer">
              تواصل مع الدعم الفني
            </a>
          </section>

          <section className="landing-section landing-stories" id="stories">
            <div className="landing-section__head">
              <h2>تجارب الطلاب</h2>
              <p>قريباً… هنا هنحط تجارب طلاب مرام.</p>
            </div>
            <div className="landing-stories__empty" role="status">
              مساحة التجارب فاضية حالياً — هنملأها قريب.
            </div>
          </section>

          {!user && (
            <div className="landing-bottom-cta">
              <Link to="/register" className="btn btn-primary">أنشئ حساباً وابدأ مع مرام</Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
