import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { filterSubjectsForUser } from "../auth/teacherScope";
import client from "../api/client";
import YearScrollPicker, { expandYearRange } from "../components/YearScrollPicker";
import { TEACHER_TIERS } from "../constants/teacherTiers";
import {
  lockSubjectTheme,
  resolveSubjectKey,
  unlockSubjectTheme,
  getSubjectTheme,
} from "../theme/subjects";
import "../styles/simulator-exact.css";

const DIFFICULTY_PRESETS = [
  { id: "easy", label: "سهل", hint: "٦٠٪ سهل · ٣٥٪ متوسط · ٥٪ صعب", cls: "easy" },
  { id: "medium", label: "متوسط", hint: "40% سهل · 60% متوسط", cls: "med" },
  { id: "advanced", label: "متقدم", hint: "٢٥٪ سهل · ٥٥٪ متوسط · ٢٠٪ صعب", cls: "adv" },
  { id: "challenge", label: "تحدي", hint: "١٠٪ سهل · ٤٠٪ متوسط · ٥٠٪ صعب", cls: "ch" },
];

const POOLS = [
  { id: "any", label: "الكل" },
  { id: "new", label: "جديدة" },
  { id: "seen", label: "مكررة" },
];

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12l5 5L20 7" />
  </svg>
);

const Star = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z" />
  </svg>
);

function cssKey(key) {
  if (key === "physics") return "phys";
  return key || "math";
}

export default function SimulatorSetup() {
  const { subjectId: routeSubjectId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [subjects, setSubjects] = useState([]);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [years, setYears] = useState([]);
  const [yearStats, setYearStats] = useState([]);
  const [selectedLessons, setSelectedLessons] = useState([]);
  const [yearRange, setYearRange] = useState(null);
  const [count, setCount] = useState(20);
  const [takeAll, setTakeAll] = useState(false);
  const [difficultyMix, setDifficultyMix] = useState("medium");
  const [reviewMode, setReviewMode] = useState("immediate");
  const [questionPool, setQuestionPool] = useState("any");
  const [teacherTier, setTeacherTier] = useState("gold");
  const [timeMode, setTimeMode] = useState("per_q");
  const [minutesPerQ, setMinutesPerQ] = useState(2);
  const [simMode, setSimMode] = useState("custom");
  const [openSubjects, setOpenSubjects] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const autoSelectLessons = useRef(true);

  const preLesson = searchParams.get("lesson");
  const preSubject = searchParams.get("subject") || routeSubjectId || "";
  const fromCollections = searchParams.get("from") === "collections";

  useEffect(() => {
    client.get("/subjects/").then((res) => {
      const list = filterSubjectsForUser(res.data.results || res.data || [], user);
      setSubjects(list);
      if (preSubject) setSelectedSubjects([Number(preSubject)]);
      else if (list.length) setSelectedSubjects(list.map((s) => s.id));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  useEffect(() => {
    autoSelectLessons.current = true;
  }, [selectedSubjects.join(",")]);

  useEffect(() => {
    if (selectedSubjects.length > 1) {
      lockSubjectTheme("multi");
      return undefined;
    }
    if (selectedSubjects.length === 1) {
      const s = subjects.find((x) => Number(x.id) === Number(selectedSubjects[0]));
      lockSubjectTheme(resolveSubjectKey(s?.name));
      return undefined;
    }
    if (preSubject) {
      const s = subjects.find((x) => Number(x.id) === Number(preSubject));
      const key = resolveSubjectKey(s?.name);
      if (key) lockSubjectTheme(key);
      else unlockSubjectTheme();
      return undefined;
    }
    unlockSubjectTheme();
    return undefined;
  }, [selectedSubjects.join(","), subjects, preSubject]);

  useEffect(() => {
    if (!selectedSubjects.length) {
      setLessons([]);
      setYears([]);
      setYearStats([]);
      setSelectedLessons([]);
      setYearRange(null);
      return;
    }
    let cancelled = false;
    setOptionsLoading(true);
    const params = new URLSearchParams();
    selectedSubjects.forEach((id) => params.append("subjects", String(id)));
    client
      .get(`/exams/simulator/options/?${params.toString()}`)
      .then((res) => {
        if (cancelled) return;
        const rows = res.data.lessons || [];
        setLessons(rows);
        setYears(res.data.years || []);
        setYearStats(res.data.year_stats || []);
        setSelectedLessons((prev) => {
          const allowed = new Set(rows.map((l) => l.id));
          const kept = prev.filter((id) => allowed.has(id));
          if (!autoSelectLessons.current) return kept;
          autoSelectLessons.current = false;
          if (preLesson && allowed.has(Number(preLesson))) return [Number(preLesson)];
          return rows.map((l) => l.id);
        });
        setYearRange((prev) => {
          if (!prev) return null;
          const expanded = expandYearRange(res.data.years || [], prev);
          return expanded.length ? prev : null;
        });
        setOpenSubjects((prev) => {
          const next = { ...prev };
          for (const sid of selectedSubjects) {
            if (next[sid] === undefined) next[sid] = selectedSubjects[0] === sid;
          }
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) {
          setLessons([]);
          setYears([]);
          setYearStats([]);
        }
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubjects.join(",")]);

  const lessonsBySubject = useMemo(() => {
    const map = new Map();
    for (const l of lessons) {
      const key = l.subject;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(l);
    }
    return map;
  }, [lessons]);

  function toggleSubject(id) {
    setSelectedSubjects((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }

  function selectAllSubjects() {
    setSelectedSubjects(subjects.map((s) => s.id));
  }

  function toggleLesson(id) {
    autoSelectLessons.current = false;
    setSelectedLessons((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function selectAllLessons() {
    autoSelectLessons.current = false;
    setSelectedLessons(lessons.map((l) => l.id));
  }

  function clearLessons() {
    autoSelectLessons.current = false;
    setSelectedLessons([]);
  }

  function selectSubjectLessons(sid, rows) {
    autoSelectLessons.current = false;
    const ids = rows.map((l) => l.id);
    setSelectedLessons((prev) => {
      const without = prev.filter((id) => !ids.includes(id));
      return [...without, ...ids];
    });
  }

  function clearSubjectLessons(sid, rows) {
    autoSelectLessons.current = false;
    const ids = new Set(rows.map((l) => l.id));
    setSelectedLessons((prev) => prev.filter((id) => !ids.has(id)));
  }

  function resolveTimeLimit() {
    if (simMode === "full") return Math.round(110 * 1.5) || null;
    if (timeMode === "open") return null;
    const n = Number(minutesPerQ);
    if (!(n > 0)) return null;
    return takeAll ? n * Math.max(selectedLessons.length, 1) : n * count;
  }

  async function start() {
    setError("");
    let subjectsPayload = selectedSubjects;
    let lessonsPayload = selectedLessons;
    let countPayload = count;
    let takeAllPayload = takeAll || (fromCollections && selectedLessons.length === 1);

    if (simMode === "full") {
      subjectsPayload = subjects.map((s) => s.id);
      lessonsPayload = lessons.length ? lessons.map((l) => l.id) : selectedLessons;
      if (!lessonsPayload.length && subjectsPayload.length) {
        setError("جاري تحميل الدروس — انتظر قليلاً ثم أعد المحاولة");
        return;
      }
      countPayload = 110;
      takeAllPayload = false;
      if (!selectedSubjects.length) {
        setSelectedSubjects(subjectsPayload);
      }
    }

    if (subjectsPayload.length === 0) {
      setError("اختر مادة واحدةً على الأقل");
      return;
    }
    if (lessonsPayload.length === 0) {
      setError("اختر درساً واحداً على الأقل");
      return;
    }
    if (!difficultyMix) {
      setError("اختر مستوى الصعوبة");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        subjects: subjectsPayload,
        lessons: lessonsPayload,
        count: countPayload,
        take_all: takeAllPayload,
        difficulty_mix: difficultyMix,
        review_mode: reviewMode,
        question_pool: questionPool,
        time_limit_minutes: resolveTimeLimit(),
        tiers: [teacherTier],
      };
      if (yearRange) {
        const expanded = expandYearRange(years, yearRange);
        if (expanded.length) payload.years = expanded;
      }
      if (subjectsPayload.length > 1) lockSubjectTheme("multi");
      else if (subjectsPayload.length === 1) {
        const s = subjects.find((x) => Number(x.id) === Number(subjectsPayload[0]));
        lockSubjectTheme(resolveSubjectKey(s?.name));
      }
      const { data } = await client.post("/exams/simulator/", payload);
      navigate(`/exam/${data.exam.id}`);
    } catch (e) {
      setError(e.response?.data?.detail || "تعذّر بدء الاختبار");
    } finally {
      setBusy(false);
    }
  }

  const selectedSubjectObjs = subjects.filter((s) => selectedSubjects.includes(s.id));
  const difficultyLabel = DIFFICULTY_PRESETS.find((p) => p.id === difficultyMix)?.label || "—";
  const poolLabel = POOLS.find((p) => p.id === questionPool)?.label || "—";
  const tierLabel = TEACHER_TIERS.find((t) => t.id === teacherTier)?.label || "—";
  const totalMinutes =
    timeMode === "open" || simMode === "full"
      ? simMode === "full"
        ? Math.round(110 * 1.5)
        : null
      : takeAll
        ? null
        : count * minutesPerQ;
  const qCountLabel = simMode === "full" ? 110 : takeAll ? "الكل" : count;
  const timeLabel =
    simMode === "full"
      ? `${totalMinutes}`
      : timeMode === "open"
        ? "—"
        : takeAll
          ? `${minutesPerQ}×`
          : String(totalMinutes ?? "—");

  return (
    <div className="simulator-exact">
      <Link to="/tests" className="back">
        → الاختبارات
      </Link>
      <div className="title">
        <div className="t-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="12" cy="12" r="1.5" fill="#fff" />
          </svg>
        </div>
        <div>
          <h1>{fromCollections ? "تدريب التجميعات" : "المحاكي الشخصي"}</h1>
          <p>اختبر نفسك الآن</p>
        </div>
      </div>

      <div className="mode">
        <button
          type="button"
          className={`md${simMode === "full" ? " on" : ""}`}
          onClick={() => {
            setSimMode("full");
            selectAllSubjects();
          }}
        >
          <div className="mi">
            <svg viewBox="0 0 24 24" fill="none" stroke={simMode === "full" ? "#fff" : "#156eb0"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M9 15l2 2 4-4" />
            </svg>
          </div>
          <div>
            <b>اختبار محاكي كامل</b>
            <small>110 سؤال · كل المواد · مثل الاختبار الحقيقي</small>
          </div>
          <i className="rad" />
        </button>
        <button
          type="button"
          className={`md${simMode === "custom" ? " on" : ""}`}
          onClick={() => setSimMode("custom")}
        >
          <div className="mi">
            <svg viewBox="0 0 24 24" fill="none" stroke={simMode === "custom" ? "#fff" : "#156eb0"} strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
              <circle cx="16" cy="6" r="2" />
              <circle cx="10" cy="12" r="2" />
              <circle cx="18" cy="18" r="2" />
            </svg>
          </div>
          <div>
            <b>اختبار مخصص</b>
            <small>اختر المواد والدروس وعدد الأسئلة</small>
          </div>
          <i className="rad" />
        </button>
      </div>

      {simMode === "full" ? (
        <>
          <div className="full">
            <h2>اختبار محاكي كامل</h2>
            <p>اختبار شامل بنفس نظام وعدد أسئلة اختبار التحصيلي</p>
            <div className="flogos">
              {subjects.map((s) => {
                const theme = getSubjectTheme(resolveSubjectKey(s.name));
                return theme?.logo ? <img key={s.id} src={theme.logo} alt={s.name} /> : null;
              })}
            </div>
            <div className="fstats">
              <div>
                <strong>110</strong>
                <span>سؤال</span>
              </div>
              <div>
                <strong>{subjects.length || 4}</strong>
                <span>مواد</span>
              </div>
              <div>
                <strong>5</strong>
                <span>أقسام</span>
              </div>
            </div>
          </div>
          <div className="fgrid">
            <div className="box">
              <div className="bh">
                <h3>
                  <span className="step">1</span>مستوى الصعوبة
                </h3>
              </div>
              <div className="seg">
                {DIFFICULTY_PRESETS.map((lv) => (
                  <span
                    key={lv.id}
                    className={`pill ${lv.cls}${difficultyMix === lv.id ? " on" : ""}`}
                    onClick={() => setDifficultyMix(lv.id)}
                    role="button"
                    tabIndex={0}
                  >
                    {lv.label}
                  </span>
                ))}
              </div>
              <div className="hint">{DIFFICULTY_PRESETS.find((p) => p.id === difficultyMix)?.hint}</div>
            </div>
            <div className="box">
              <div className="bh">
                <h3>
                  <span className="step">2</span>الترشيح
                </h3>
              </div>
              <div className="seg">
                {TEACHER_TIERS.map((t) => (
                  <span
                    key={t.id}
                    className={`pill rk ${t.id}${teacherTier === t.id ? " on" : ""}`}
                    onClick={() => setTeacherTier(t.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <Star />
                    {t.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="box">
              <div className="bh">
                <h3>
                  <span className="step">3</span>المراجعة
                </h3>
              </div>
              <div className="seg">
                <span className={`pill${reviewMode === "immediate" ? " on" : ""}`} onClick={() => setReviewMode("immediate")} role="button" tabIndex={0}>
                  فورية
                </span>
                <span className={`pill${reviewMode === "final" ? " on" : ""}`} onClick={() => setReviewMode("final")} role="button" tabIndex={0}>
                  بعد الانتهاء
                </span>
              </div>
              <div className="hint">{reviewMode === "immediate" ? "تظهر الإجابة بعد كل سؤال" : "المراجعة بعد انتهاء الاختبار"}</div>
            </div>
          </div>
          {error && <div className="error-text" style={{ marginTop: 12 }}>{error}</div>}
          <button type="button" className="start fstart" onClick={start} disabled={busy || optionsLoading}>
            {busy ? "…" : "ابدأ الاختبار ←"}
          </button>
        </>
      ) : (
        <div className="layout">
          <div>
            <div className="box">
              <div className="bh">
                <h3>
                  <span className="step">1</span>المواد
                </h3>
                <button type="button" className="lnk" onClick={selectAllSubjects} style={{ background: "none", border: 0, cursor: "pointer" }}>
                  تحديد الكل
                </button>
              </div>
              <div className="subs">
                {subjects.map((s) => {
                  const key = resolveSubjectKey(s.name) || "math";
                  const on = selectedSubjects.includes(s.id);
                  const theme = getSubjectTheme(key);
                  return (
                    <button key={s.id} type="button" className={`sub ${cssKey(key)}${on ? " on" : ""}`} onClick={() => toggleSubject(s.id)}>
                      <span className="chk">{on ? <Check /> : null}</span>
                      {theme?.logo ? <img src={theme.logo} alt={s.name} /> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="box">
              <div className="bh">
                <h3>
                  <span className="step">2</span>الدروس
                </h3>
                <button type="button" className="lnk" onClick={selectAllLessons} style={{ background: "none", border: 0, cursor: "pointer" }}>
                  كل الدروس
                </button>
              </div>
              {optionsLoading && <p className="hint">جاري تحميل الدروس…</p>}
              {!optionsLoading && lessons.length === 0 && <p className="hint">لا توجد دروس للمواد المختارة.</p>}
              {[...lessonsBySubject.entries()].map(([sid, rows]) => {
                const name = rows[0]?.subject_name || `مادة ${sid}`;
                const key = resolveSubjectKey(name) || "math";
                const selectedCount = rows.filter((l) => selectedLessons.includes(l.id)).length;
                const open = openSubjects[sid];
                return (
                  <div key={sid} className={`dd ${cssKey(key)}${open ? " open" : ""}`}>
                    <button
                      type="button"
                      className="dd-h"
                      style={{ width: "100%", border: 0, cursor: "pointer", font: "inherit" }}
                      onClick={() => setOpenSubjects((p) => ({ ...p, [sid]: !p[sid] }))}
                    >
                      <i className="dot" />
                      <span className="nm">{name}</span>
                      <span className="cnt">
                        {selectedCount === rows.length ? "كل الدروس" : `${selectedCount} من ${rows.length}`}
                      </span>
                      <svg className="arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {open && (
                      <div className="dd-b">
                        <div className="dd-tools">
                          <span role="button" tabIndex={0} onClick={() => selectSubjectLessons(sid, rows)}>
                            تحديد الكل
                          </span>
                          <span role="button" tabIndex={0} onClick={() => clearSubjectLessons(sid, rows)}>
                            مسح
                          </span>
                        </div>
                        <div className="lgrid">
                          {rows.map((l) => {
                            const on = selectedLessons.includes(l.id);
                            return (
                              <label key={l.id} className={`ls${on ? " on" : ""}`} onClick={() => toggleLesson(l.id)}>
                                <span className="cb">{on ? <Check /> : null}</span>
                                <em>{l.order_number}</em>
                                {l.title}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {years.length > 0 && (
              <div className="box">
                <div className="bh">
                  <h3>
                    <span className="step">*</span>السنة
                  </h3>
                </div>
                <YearScrollPicker years={years} value={yearRange} onChange={setYearRange} yearStats={yearStats} emptyMessage="لا توجد سنوات مسجّلة." />
              </div>
            )}

            <div className="box">
              <div className="bh">
                <h3>
                  <span className="step">3</span>عدد الأسئلة
                </h3>
              </div>
              <div className="opts one">
                <div className={`opt${!takeAll ? " on" : ""}`} onClick={() => setTakeAll(false)} role="button" tabIndex={0}>
                  <div className="grow">
                    <b>عدد محدد</b>
                    <small>حدّد عدد الأسئلة</small>
                  </div>
                  {!takeAll && (
                    <div className="stepper" onClick={(e) => e.stopPropagation()}>
                      <span role="button" tabIndex={0} onClick={() => setCount((c) => c + 1)}>
                        +
                      </span>
                      <strong>{count}</strong>
                      <span role="button" tabIndex={0} onClick={() => setCount((c) => Math.max(1, c - 1))}>
                        −
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="seg" style={{ marginTop: 12 }}>
                <span className={`pill${takeAll ? " on" : ""}`} onClick={() => setTakeAll(true)} role="button" tabIndex={0}>
                  كل الأسئلة المختارة
                </span>
              </div>
            </div>

            <div className="box">
              <div className="bh">
                <h3>
                  <span className="step">4</span>مدة الاختبار
                </h3>
              </div>
              <div className="opts">
                <div className={`opt${timeMode === "open" ? " on" : ""}`} onClick={() => setTimeMode("open")} role="button" tabIndex={0}>
                  <i className="rad" />
                  <div className="grow">
                    <b>بدون زمن</b>
                    <small>بدون وقت محدد</small>
                  </div>
                </div>
                <div className={`opt${timeMode === "per_q" ? " on" : ""}`} onClick={() => setTimeMode("per_q")} role="button" tabIndex={0}>
                  <i className="rad" />
                  <div className="grow">
                    <b>دقيقة لكل سؤال</b>
                    <small>من 1 إلى 5 دقايق</small>
                  </div>
                  {timeMode === "per_q" && (
                    <div className="stepper" onClick={(e) => e.stopPropagation()}>
                      <span role="button" tabIndex={0} onClick={() => setMinutesPerQ((m) => Math.min(5, m + 1))}>
                        +
                      </span>
                      <strong>{minutesPerQ}</strong>
                      <span role="button" tabIndex={0} onClick={() => setMinutesPerQ((m) => Math.max(1, m - 1))}>
                        −
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {timeMode === "per_q" && !takeAll && (
                <div className="calc">
                  إجمالي مدة الاختبار:{" "}
                  <b>
                    {count} سؤال × {minutesPerQ} دقيقة = {count * minutesPerQ} دقيقة
                  </b>
                </div>
              )}
            </div>

            <div className="box">
              <div className="bh">
                <h3>
                  <span className="step">5</span>مستوى الصعوبة
                </h3>
              </div>
              <div className="seg">
                {DIFFICULTY_PRESETS.map((lv) => (
                  <span
                    key={lv.id}
                    className={`pill ${lv.cls}${difficultyMix === lv.id ? " on" : ""}`}
                    onClick={() => setDifficultyMix(lv.id)}
                    role="button"
                    tabIndex={0}
                  >
                    {lv.label}
                  </span>
                ))}
              </div>
              <div className="hint">{DIFFICULTY_PRESETS.find((p) => p.id === difficultyMix)?.hint}</div>
            </div>

            <div className="box">
              <div className="bh">
                <h3>
                  <span className="step">6</span>الترشيح
                </h3>
              </div>
              <div className="seg">
                {TEACHER_TIERS.map((t) => (
                  <span
                    key={t.id}
                    className={`pill rk ${t.id}${teacherTier === t.id ? " on" : ""}`}
                    onClick={() => setTeacherTier(t.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <Star />
                    {t.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="row2">
              <div className="box">
                <div className="bh">
                  <h3>
                    <span className="step">7</span>نوع الأسئلة
                  </h3>
                </div>
                <div className="seg">
                  {POOLS.map((p) => (
                    <span
                      key={p.id}
                      className={`pill${questionPool === p.id ? " on" : ""}`}
                      onClick={() => setQuestionPool(p.id)}
                      role="button"
                      tabIndex={0}
                    >
                      {p.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="box">
                <div className="bh">
                  <h3>
                    <span className="step">8</span>المراجعة
                  </h3>
                </div>
                <div className="seg">
                  <span className={`pill${reviewMode === "immediate" ? " on" : ""}`} onClick={() => setReviewMode("immediate")} role="button" tabIndex={0}>
                    فورية
                  </span>
                  <span className={`pill${reviewMode === "final" ? " on" : ""}`} onClick={() => setReviewMode("final")} role="button" tabIndex={0}>
                    بعد الانتهاء
                  </span>
                </div>
                <div className="hint">{reviewMode === "immediate" ? "تظهر الإجابة بعد كل سؤال" : "المراجعة بعد انتهاء الاختبار"}</div>
              </div>
            </div>

            {error && <div className="error-text">{error}</div>}
          </div>

          <aside className="side">
            <div className="sum">
              <h3>ملخص الاختبار</h3>
              <div className="si">
                <span>المواد</span>
                <div className="tags">
                  {selectedSubjectObjs.map((s) => (
                    <i key={s.id} className="tg">
                      {s.name}
                    </i>
                  ))}
                </div>
              </div>
              <div className="si">
                <span>الدروس</span>
                <b>{selectedLessons.length} درس</b>
              </div>
              <div className="si">
                <span>الصعوبة</span>
                <b>{difficultyLabel}</b>
              </div>
              <div className="si">
                <span>الترشيح</span>
                <b style={{ color: "#f7c400" }}>★ {tierLabel}</b>
              </div>
              <div className="si">
                <span>نوع الأسئلة</span>
                <b>{poolLabel}</b>
              </div>
              <div className="si">
                <span>المراجعة</span>
                <b>{reviewMode === "immediate" ? "فورية" : "بعد الانتهاء"}</b>
              </div>
              <div className="big">
                <div>
                  <strong>{qCountLabel}</strong>
                  <small>سؤال</small>
                </div>
                <div>
                  <strong>{timeLabel}</strong>
                  <small>دقيقة</small>
                </div>
              </div>
              <button type="button" className="start" onClick={start} disabled={busy || optionsLoading} style={{ width: "100%", border: 0, cursor: "pointer" }}>
                {busy ? "…" : "ابدأ الاختبار ←"}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
