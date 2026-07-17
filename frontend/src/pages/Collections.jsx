import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import client from "../api/client";

const LEVELS = [
  { id: "easy", label: "سهل" },
  { id: "medium", label: "متوسط" },
  { id: "hard", label: "صعب" },
];

export default function Collections() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lessons, setLessons] = useState([]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const freeTier = user?.role === "student" && !user?.has_active_subscription;

  useEffect(() => {
    client.get(`/subjects/${subjectId}/lessons/`).then((res) => setLessons(res.data));
  }, [subjectId]);

  async function start(lessonId, level) {
    setError("");
    setBusy(`${lessonId}-${level}`);
    try {
      const { data } = await client.post("/exams/simulator/", {
        subject: Number(subjectId),
        lessons: [lessonId],
        count: 10,
        level,
      });
      navigate(`/exam/${data.exam.id}`);
    } catch (e) {
      setError(e.response?.data?.detail || "لا توجد أسئلة بهذا المستوى في هذا الدرس");
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="breadcrumb">دورات &gt; <span>تجميع</span></div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>التجميعات — اختر الدرس والمستوى</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>
        اختر الدرس ثم مستوى الأسئلة: سهل / متوسط / صعب
      </p>
      {freeTier && (
        <div className="banner" style={{ marginBottom: 16 }}>
          المعاينة المجانية: اختبار أول درس فقط بحد أقصى ١٠ أسئلة —
          <Link to="/subscription"> اشترك الآن</Link> أو تواصل مع الإدارة للتفعيل.
        </div>
      )}

      {error && <div className="banner">{error}</div>}

      {lessons.map((l) => {
        const locked = l.is_locked;
        return (
          <div
            key={l.id}
            className="card"
            style={{
              padding: 16,
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
              opacity: locked ? 0.65 : 1,
            }}
          >
            <span style={{ fontWeight: 700, width: 28 }}>{l.order_number}</span>
            <span style={{ flex: 1, fontWeight: 600, minWidth: 160 }}>{l.title}</span>
            {locked ? (
              <span className="badge badge-expired">يتطلب تفعيل</span>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                {LEVELS.map((lv) => (
                  <button
                    key={lv.id}
                    className="btn btn-secondary btn-sm"
                    disabled={busy === `${l.id}-${lv.id}`}
                    onClick={() => start(l.id, lv.id)}
                  >
                    {busy === `${l.id}-${lv.id}` ? "…" : lv.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {lessons.length === 0 && <p style={{ color: "var(--text-muted)" }}>لا توجد دروس.</p>}
    </div>
  );
}
