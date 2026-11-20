import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { canEditSubject, filterSubjectsForUser } from "../auth/teacherScope";
import client from "../api/client";
import { getSubjectTheme, resolveSubjectKey } from "../theme/subjects";
import "../styles/exams-exact.css";

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12l5 5L20 7" />
  </svg>
);

function cssKey(key) {
  if (key === "physics") return "phys";
  return key || "math";
}

function subjectVars(key) {
  const theme = getSubjectTheme(key) || getSubjectTheme("math");
  return { "--c": theme.color, "--bg": theme.soft };
}

function testMode(t) {
  if (t.solved || t.my_score != null || t.status === "solved") return "previous";
  if (t.is_upcoming || t.status === "upcoming") return "upcoming";
  return "available";
}

export default function TestsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [teacherTests, setTeacherTests] = useState([]);
  const [picked, setPicked] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([client.get("/subjects/"), client.get("/teacher-tests/")])
      .then(([subjRes, testsRes]) => {
        if (cancelled) return;
        const list = filterSubjectsForUser(subjRes.data.results || subjRes.data || [], user);
        setSubjects(list);
        setPicked(list.map((s) => s.id));
        setTeacherTests(testsRes.data.results || testsRes.data || []);
      })
      .catch(() => {
        if (!cancelled) {
          setSubjects([]);
          setTeacherTests([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  async function startTeacherTest(id) {
    setError("");
    setBusyId(id);
    try {
      const { data } = await client.post("/exams/teacher/", { teacher_test: id });
      navigate(`/exam/${data.exam.id}`);
    } catch (e) {
      setError(e.response?.data?.detail || "تعذّر بدء الاختبار");
      setBusyId(null);
    }
  }

  const canCreateAny = subjects.some((s) => canEditSubject(user, s.id));

  function togglePick(id) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectAllPicks() {
    setPicked(subjects.map((s) => s.id));
  }

  function openSimulator() {
    if (picked.length === 1) navigate(`/tests/simulator/${picked[0]}`);
    else navigate("/tests/simulator");
  }

  const filtered = useMemo(() => {
    return teacherTests.filter((t) => {
      if (subjectFilter !== "all") {
        const sub = subjects.find((s) => String(s.id) === String(subjectFilter));
        if (
          String(t.subject) !== String(subjectFilter) &&
          t.subject_name !== subjectFilter &&
          (!sub || (t.subject_name !== sub.name && String(t.subject) !== String(sub.id)))
        ) {
          return false;
        }
      }
      const mode = testMode(t);
      if (statusFilter === "available" && mode !== "available") return false;
      if (statusFilter === "upcoming" && mode !== "upcoming") return false;
      if (statusFilter === "previous" && mode !== "previous") return false;
      return true;
    });
  }, [teacherTests, subjectFilter, statusFilter, subjects]);

  const available = filtered.filter((t) => testMode(t) === "available");
  const upcoming = filtered.filter((t) => testMode(t) === "upcoming");
  const previous = filtered.filter((t) => testMode(t) === "previous");

  function renderRow(t, mode) {
    const key = resolveSubjectKey(t.subject_name) || "math";
    const vars = subjectVars(key);
    const q = t.question_count ?? "—";
    const mins = t.duration_minutes || t.time_limit_minutes;
    const score = t.my_score;
    const maxScore = t.max_score || t.question_count || 20;
    const pct = score != null && maxScore ? Math.round((100 * Number(score)) / Number(maxScore)) : 0;

    return (
      <div key={t.id} className={`row ${mode === "available" ? "now" : mode === "upcoming" ? "up" : "done"}`} style={vars}>
        {getSubjectTheme(key)?.logo ? <img src={getSubjectTheme(key).logo} alt="" /> : null}
        <div className="t">
          <b>{t.name}</b>
          <small>{t.subject_name || "مادة"}</small>
        </div>
        <div className="mid">
          {mode === "previous" && score != null ? (
            <span className="sc">
              <strong>
                {score} من {maxScore}
              </strong>
              <span className="bar">
                <i style={{ width: `${pct}%` }} />
              </span>
            </span>
          ) : (
            <>
              <span className="pill">
                {q} سؤال{mins ? ` · ${mins} د` : ""}
              </span>
              {t.ends_at_label || t.open_until_label ? (
                <span className="pill">{t.ends_at_label || t.open_until_label}</span>
              ) : mode === "upcoming" && t.opens_at_label ? (
                <span className="pill">{t.opens_at_label}</span>
              ) : null}
            </>
          )}
        </div>
        {mode === "previous" ? (
          <Link to="/results" className="rv">
            مراجعة
          </Link>
        ) : mode === "upcoming" ? (
          <span className="lock">🔒 يفتح في موعده</span>
        ) : (
          <button type="button" className="go" disabled={busyId === t.id} onClick={() => startTeacherTest(t.id)}>
            {busyId === t.id ? "…" : "ابدأ ←"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="exams-exact">
      <h1>الاختبارات</h1>

      {loading && <div className="spinner">جاري التحميل…</div>}

      <section className="sim">
        <div className="sim-top">
          <div className="st-r">
            <div className="st-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="12" cy="12" r="1.5" fill="#fff" />
              </svg>
            </div>
            <div>
              <h2>المحاكي الشخصي</h2>
              <p>اختبر نفسك الآن</p>
            </div>
          </div>
          <button type="button" className="btn-y" onClick={openSimulator}>
            إعداد المحاكي ←
          </button>
        </div>
        <div className="sim-body">
          <div className="lbl">
            <span>اختر المواد</span>
            <button type="button" onClick={selectAllPicks} style={{ background: "none", border: 0, color: "var(--blue)", fontWeight: 700, cursor: "pointer" }}>
              تحديد الكل
            </button>
          </div>
          <div className="subs">
            {subjects.map((s) => {
              const key = resolveSubjectKey(s.name) || "math";
              const on = picked.includes(s.id);
              const theme = getSubjectTheme(key);
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`sub ${cssKey(key)}${on ? " on" : ""}`}
                  onClick={() => togglePick(s.id)}
                >
                  <span className="chk">{on ? <CheckIcon /> : null}</span>
                  {theme?.logo ? <img src={theme.logo} alt={s.name} /> : null}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="sec-head">
        <h3>اختبارات المدرسين</h3>
        <i />
      </div>

      {canCreateAny && (
        <div className="create-row">
          {subjects
            .filter((s) => canEditSubject(user, s.id))
            .map((s) => (
              <Link key={s.id} to={`/tests/teacher/${s.id}`} className="btn go" style={{ "--c": getSubjectTheme(resolveSubjectKey(s.name))?.color || "#156eb0", marginTop: 0, padding: "8px 14px", fontSize: 13 }}>
                إنشاء · {s.name}
              </Link>
            ))}
        </div>
      )}

      {error && (
        <div className="banner" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="ebox">
        <div className="etop">
          <div className="ftabs">
            <span className={subjectFilter === "all" ? "on" : ""} onClick={() => setSubjectFilter("all")} role="button" tabIndex={0}>
              الكل
            </span>
            {subjects.map((s) => (
              <span
                key={s.id}
                className={String(subjectFilter) === String(s.id) ? "on" : ""}
                onClick={() => setSubjectFilter(s.id)}
                role="button"
                tabIndex={0}
              >
                {s.name}
              </span>
            ))}
          </div>
          <div className="stabs">
            <span className={statusFilter === "all" ? "on" : ""} onClick={() => setStatusFilter("all")} role="button" tabIndex={0}>
              الكل <i>{filtered.length}</i>
            </span>
            <span className={statusFilter === "available" ? "on" : ""} onClick={() => setStatusFilter("available")} role="button" tabIndex={0}>
              متاح <i className="g">{available.length}</i>
            </span>
            <span className={statusFilter === "upcoming" ? "on" : ""} onClick={() => setStatusFilter("upcoming")} role="button" tabIndex={0}>
              قادم <i>{upcoming.length}</i>
            </span>
            <span className={statusFilter === "previous" ? "on" : ""} onClick={() => setStatusFilter("previous")} role="button" tabIndex={0}>
              سابق <i>{previous.length}</i>
            </span>
          </div>
        </div>

        {(statusFilter === "all" || statusFilter === "available") && (
          <>
            <div className="gh">
              <i className="d g" />
              متاح الآن
            </div>
            {available.map((t) => renderRow(t, "available"))}
            {!available.length && (
              <div className="empty" style={{ margin: 16, border: "none", boxShadow: "none" }}>
                <b>لا اختبارات متاحة الآن</b>
                <span>ستظهر هنا اختبارات المدرسين عند توفرها</span>
              </div>
            )}
          </>
        )}

        {(statusFilter === "all" || statusFilter === "upcoming") && (
          <>
            <div className="gh">
              <i className="d b" />
              القادمة
            </div>
            {upcoming.map((t) => renderRow(t, "upcoming"))}
            {!upcoming.length && statusFilter === "upcoming" && (
              <p style={{ padding: "12px 20px", color: "#6b7280" }}>لا اختبارات قادمة.</p>
            )}
          </>
        )}

        {(statusFilter === "all" || statusFilter === "previous") && (
          <>
            <div className="gh">
              <i className="d s" />
              السابقة
            </div>
            {previous.map((t) => renderRow(t, "previous"))}
            {!previous.length && statusFilter === "previous" && (
              <p style={{ padding: "12px 20px", color: "#6b7280" }}>لا اختبارات سابقة.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
