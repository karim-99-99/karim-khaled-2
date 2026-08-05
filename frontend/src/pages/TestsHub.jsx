import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { canEditSubject } from "../auth/teacherScope";
import client from "../api/client";
import BackToCourses from "../components/BackToCourses";

export default function TestsHub() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = canEditSubject(user, subjectId);
  const [teacherTests, setTeacherTests] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    client
      .get(`/teacher-tests/?subject=${subjectId}`)
      .then((res) => setTeacherTests(res.data.results || res.data || []))
      .catch(() => setTeacherTests([]));
  }, [subjectId]);

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

  return (
    <div>
      <BackToCourses subjectId={subjectId} />
      <div className="breadcrumb">دورات &gt; <span>اختبارات</span></div>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>اختبارات</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>
        محاكي شخصي، أو اختبارات المدرس المبنية من بنك التجميعات
      </p>

      <div className="grid grid-2" style={{ marginBottom: 32 }}>
        <div className="card" style={{ padding: 32 }}>
          <h3 style={{ fontSize: 22, marginBottom: 8 }}>المحاكي الشخصي</h3>
          <p style={{ color: "var(--text-muted)", marginBottom: 20 }}>
            دروس متعددة · أسئلة جديدة/مكررة · مراجعة فورية أو نهائية · مدة مفتوحة أو محددة
          </p>
          <Link to={`/tests/simulator/${subjectId}`} className="btn btn-primary">
            ابدأ الإعداد
          </Link>
        </div>
        <div className="card" style={{ padding: 32 }}>
          <h3 style={{ fontSize: 22, marginBottom: 8 }}>اختبار المدرس</h3>
          <p style={{ color: "var(--text-muted)", marginBottom: 20 }}>
            {canEdit
              ? "أنشئ اختباراً مسمّى من دروس وأسئلة التجميعات لكل المستويات"
              : "اختبارات وضعها المدرس — ابدأ من القائمة أدناه"}
          </p>
          {canEdit ? (
            <Link to={`/tests/teacher/${subjectId}`} className="btn btn-primary">
              إنشاء / إدارة اختبار
            </Link>
          ) : (
            <span style={{ color: "var(--text-muted)", fontSize: 14 }}>
              اختر اختباراً منشوراً من القائمة
            </span>
          )}
        </div>
      </div>

      <div className="section-title">اختبارات المدرس المتاحة</div>
      {error && <div className="banner" style={{ marginBottom: 12 }}>{error}</div>}

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
              {t.question_count} سؤال
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

      {teacherTests.length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>
          لا توجد اختبارات مدرس بعد.
          {canEdit ? " أنشئ اختباراً من الزر أعلاه." : ""}
        </p>
      )}
    </div>
  );
}
