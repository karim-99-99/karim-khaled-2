import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { canAccess, FEATURE } from "../auth/planAccess";
import { canTeachSubject } from "../auth/teacherScope";
import client from "../api/client";
import BackToCourses from "../components/BackToCourses";

export default function TestsHub() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canTeach = canTeachSubject(user, subjectId);
  const showTeacherTests = canAccess(user, FEATURE.TEACHER_TESTS);
  const [teacherTests, setTeacherTests] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!showTeacherTests) {
      setTeacherTests([]);
      return;
    }
    client
      .get(`/teacher-tests/?subject=${subjectId}`)
      .then((res) => setTeacherTests(res.data.results || res.data || []))
      .catch(() => setTeacherTests([]));
  }, [subjectId, showTeacherTests]);

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

  const solved = teacherTests.filter((t) => t.solved || t.my_score != null || t.status === "solved");
  const upcoming = teacherTests.filter((t) => t.is_upcoming || t.status === "upcoming");
  const available = teacherTests.filter(
    (t) => !solved.includes(t) && !upcoming.includes(t)
  );

  function renderRow(t, mode) {
    return (
      <div key={t.id} className="test-row ui-card">
        <div>
          <strong>{t.name}</strong>
          <div className="test-row__meta">
            {t.question_count} سؤال
            {t.lesson_titles?.length ? ` · ${t.lesson_titles.join("، ")}` : ""}
            {t.created_by_name ? ` · ${t.created_by_name}` : ""}
            {t.my_score != null ? ` · نتيجتك ${t.my_score}` : ""}
          </div>
        </div>
        {mode === "solved" ? (
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
    <div>
      <BackToCourses subjectId={subjectId} />
      <div className="breadcrumb">دورات &gt; <span>اختبارات</span></div>
      <div className="tests-hub__head">
        <div>
          <h1 className="page-title">اختبارات المدرسين</h1>
          <p style={{ color: "var(--text-muted)" }}>محاكي شخصي أو اختبارات من بنك التجميعات</p>
        </div>
        <div className="tests-hub__actions">
          <Link to={`/tests/simulator/${subjectId}`} className="btn btn-secondary">
            صمم اختبارك بنفسك
          </Link>
          {canTeach && showTeacherTests && (
            <Link to={`/tests/teacher/${subjectId}`} className="btn btn-primary">
              إنشاء / إدارة اختبار
            </Link>
          )}
        </div>
      </div>

      {error && <div className="banner" style={{ marginBottom: 12 }}>{error}</div>}

      {showTeacherTests ? (
        <>
          <div className="section-title">متاح الآن</div>
          {available.map((t) => renderRow(t, "available"))}
          {!available.length && <p style={{ color: "var(--text-muted)" }}>لا اختبارات متاحة الآن.</p>}

          <div className="section-title">القادمة</div>
          {upcoming.map((t) => renderRow(t, "upcoming"))}
          {!upcoming.length && <p style={{ color: "var(--text-muted)" }}>لا اختبارات قادمة.</p>}

          <div className="section-title">السابقة</div>
          {solved.map((t) => renderRow(t, "solved"))}
          {!solved.length && <p style={{ color: "var(--text-muted)" }}>لا اختبارات محلولة بعد.</p>}
        </>
      ) : (
        <p style={{ color: "var(--text-muted)" }}>
          الباقة الفضية تشمل المحاكي الشخصي فقط — اختبارات المدرسين للباقة الذهبية.
        </p>
      )}
    </div>
  );
}
