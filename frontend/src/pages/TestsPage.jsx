import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { canEditSubject, filterSubjectsForUser } from "../auth/teacherScope";
import client from "../api/client";
import { resolveSubjectKey } from "../theme/subjects";

/**
 * Top-level tests page (outside courses):
 * simulator on top (pick a subject), teacher tests listed below for all subjects.
 */
export default function TestsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [teacherTests, setTeacherTests] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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

  return (
    <div>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>الاختبارات</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>
        محاكي شخصي لكل المواد، واختبارات المدرسين أسفل الصفحة
      </p>

      {loading && <div className="spinner">جاري التحميل…</div>}

      <div className="card" style={{ padding: 28, marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, marginTop: 0, marginBottom: 8 }}>المحاكي الشخصي</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>
          اختر كل المواد أو بعضها، والدروس داخل كل مادة، والسنة، ومدة الاختبار أو بدون زمن
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate("/tests/simulator")}
        >
          إعداد المحاكي ←
        </button>
        {subjects.length > 0 && (
          <div className="filter-row" style={{ marginTop: 14 }}>
            {subjects.map((s) => {
              const key = resolveSubjectKey(s.name) || "math";
              return (
                <span
                  key={s.id}
                  className={`chip ${key}`}
                  onClick={() => navigate(`/tests/simulator/${s.id}`)}
                  role="button"
                  tabIndex={0}
                >
                  {s.name}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <div className="section-title" style={{ margin: 0 }}>
          اختبارات المدرسين
        </div>
        {canCreateAny && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {subjects
              .filter((s) => canEditSubject(user, s.id))
              .map((s) => (
                <Link
                  key={s.id}
                  to={`/tests/teacher/${s.id}`}
                  className="btn btn-secondary btn-sm"
                >
                  إنشاء اختبار · {s.name}
                </Link>
              ))}
          </div>
        )}
      </div>

      {error && (
        <div className="banner" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {teacherTests.map((t) => (
        <div
          key={t.id}
          className="card"
          style={{
            padding: 16,
            marginBottom: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <strong style={{ fontSize: 18 }}>{t.name}</strong>
            <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
              {t.subject_name || "مادة"} · {t.question_count} سؤال
              {t.lesson_titles?.length ? ` · ${t.lesson_titles.join("، ")}` : ""}
              {t.created_by_name ? ` · ${t.created_by_name}` : ""}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busyId === t.id}
            onClick={() => startTeacherTest(t.id)}
          >
            {busyId === t.id ? "…" : "ابدأ الاختبار"}
          </button>
        </div>
      ))}

      {!loading && teacherTests.length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>لا توجد اختبارات مدرس بعد.</p>
      )}
    </div>
  );
}
