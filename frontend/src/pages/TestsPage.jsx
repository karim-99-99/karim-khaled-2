import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { canEditSubject, filterSubjectsForUser } from "../auth/teacherScope";
import client from "../api/client";
import { getSubjectTheme, resolveSubjectKey } from "../theme/subjects";

export default function TestsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [teacherTests, setTeacherTests] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      client.get("/subjects/"),
      client.get("/teacher-tests/"),
    ])
      .then(([subjRes, testsRes]) => {
        if (cancelled) return;
        const list = filterSubjectsForUser(
          subjRes.data.results || subjRes.data || [],
          user
        );
        setSubjects(list);
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

  const filtered = useMemo(() => {
    return teacherTests.filter((t) => {
      if (subjectFilter !== "all" && String(t.subject) !== String(subjectFilter) && t.subject_name !== subjectFilter) {
        const sub = subjects.find((s) => String(s.id) === String(subjectFilter));
        if (sub && t.subject_name !== sub.name && String(t.subject) !== String(sub.id)) return false;
      }
      const solved = t.solved || t.my_score != null || t.status === "solved";
      const upcoming = t.is_upcoming || t.status === "upcoming";
      if (statusFilter === "available" && (solved || upcoming)) return false;
      if (statusFilter === "upcoming" && !upcoming) return false;
      if (statusFilter === "previous" && !solved) return false;
      return true;
    });
  }, [teacherTests, subjectFilter, statusFilter, subjects]);

  const available = filtered.filter((t) => !(t.solved || t.my_score != null || t.status === "solved") && !(t.is_upcoming || t.status === "upcoming"));
  const upcoming = filtered.filter((t) => t.is_upcoming || t.status === "upcoming");
  const previous = filtered.filter((t) => t.solved || t.my_score != null || t.status === "solved");

  function renderRow(t, mode) {
    return (
      <div key={t.id} className="test-row ui-card">
        <div>
          <strong>{t.name}</strong>
          <div className="test-row__meta">
            {t.subject_name || "مادة"} · {t.question_count} سؤال
            {t.lesson_titles?.length ? ` · ${t.lesson_titles.join("، ")}` : ""}
          </div>
        </div>
        {mode === "previous" ? (
          <Link to="/results" className="btn btn-secondary btn-sm">مراجعة</Link>
        ) : mode === "upcoming" ? (
          <span className="chip">يفتح في موعده</span>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busyId === t.id}
            onClick={() => startTeacherTest(t.id)}
          >
            {busyId === t.id ? "…" : "ابدأ"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="tests-page">
      <h1 className="page-title">الاختبارات</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 20 }}>
        محاكي شخصي لكل المواد، واختبارات المدرسين أسفل الصفحة
      </p>

      {loading && <div className="spinner">جاري التحميل…</div>}

      <div className="tests-sim-banner ui-card">
        <div>
          <h2>المحاكي الشخصي</h2>
          <p>اختبر نفسك الآن — اختر المواد والدروس والمدة</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate("/tests/simulator")}
        >
          إعداد المحاكي
        </button>
      </div>

      {subjects.length > 0 && (
        <div className="subject-pick-grid" style={{ marginBottom: 24 }}>
          {subjects.map((s) => {
            const key = resolveSubjectKey(s.name) || "math";
            const theme = getSubjectTheme(key);
            return (
              <button
                key={s.id}
                type="button"
                className={`subject-pick subject-pick--${key}`}
                onClick={() => navigate(`/tests/simulator/${s.id}`)}
              >
                {theme?.logo ? <img src={theme.logo} alt="" /> : null}
                <strong>{s.name}</strong>
              </button>
            );
          })}
        </div>
      )}

      <div className="tests-hub__head">
        <div className="section-title" style={{ margin: 0 }}>اختبارات المدرسين</div>
        {canCreateAny && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {subjects
              .filter((s) => canEditSubject(user, s.id))
              .map((s) => (
                <Link key={s.id} to={`/tests/teacher/${s.id}`} className="btn btn-secondary btn-sm">
                  إنشاء · {s.name}
                </Link>
              ))}
          </div>
        )}
      </div>

      <div className="filter-row" style={{ marginBottom: 16 }}>
        <span
          className={`chip ${subjectFilter === "all" ? "active" : ""}`}
          onClick={() => setSubjectFilter("all")}
          role="button"
          tabIndex={0}
        >
          الكل
        </span>
        {subjects.map((s) => (
          <span
            key={s.id}
            className={`chip ${String(subjectFilter) === String(s.id) ? "active" : ""}`}
            onClick={() => setSubjectFilter(s.id)}
            role="button"
            tabIndex={0}
          >
            {s.name}
          </span>
        ))}
      </div>
      <div className="filter-row" style={{ marginBottom: 16 }}>
        {[
          ["all", "الكل"],
          ["available", "متاح"],
          ["upcoming", "قادم"],
          ["previous", "سابق"],
        ].map(([id, label]) => (
          <span
            key={id}
            className={`chip ${statusFilter === id ? "active" : ""}`}
            onClick={() => setStatusFilter(id)}
            role="button"
            tabIndex={0}
          >
            {label}
          </span>
        ))}
      </div>

      {error && <div className="banner" style={{ marginBottom: 12 }}>{error}</div>}

      {(statusFilter === "all" || statusFilter === "available") && (
        <>
          <div className="section-title">متاح الآن</div>
          {available.map((t) => renderRow(t, "available"))}
          {!available.length && <p style={{ color: "var(--text-muted)" }}>لا اختبارات متاحة.</p>}
        </>
      )}
      {(statusFilter === "all" || statusFilter === "upcoming") && (
        <>
          <div className="section-title">القادمة</div>
          {upcoming.map((t) => renderRow(t, "upcoming"))}
          {!upcoming.length && <p style={{ color: "var(--text-muted)" }}>لا اختبارات قادمة.</p>}
        </>
      )}
      {(statusFilter === "all" || statusFilter === "previous") && (
        <>
          <div className="section-title">السابقة</div>
          {previous.map((t) => renderRow(t, "previous"))}
          {!previous.length && <p style={{ color: "var(--text-muted)" }}>لا اختبارات سابقة.</p>}
        </>
      )}
    </div>
  );
}
