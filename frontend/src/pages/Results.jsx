import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";

function MiniDonut({ correct = 0, wrong = 0, unanswered = 0 }) {
  const total = Math.max(1, correct + wrong + unanswered);
  const c = (correct / total) * 100;
  const w = (wrong / total) * 100;
  return (
    <div
      style={{
        width: 52,
        height: 52,
        borderRadius: "50%",
        background: `conic-gradient(var(--success) 0 ${c}%, var(--error) ${c}% ${c + w}%, #cbd5e1 ${c + w}% 100%)`,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
      aria-hidden
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: "#fff",
          fontSize: 10,
          fontWeight: 800,
          display: "grid",
          placeItems: "center",
        }}
      >
        {Math.round((correct / total) * 100)}%
      </div>
    </div>
  );
}

export default function Results() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .get("/results/")
      .then((res) => setExams(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner">جاري التحميل…</div>;

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>نتائجي</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>
        ملخص كل اختبار — اضغط للمراجعة التفصيلية
      </p>
      {exams.length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>لا توجد اختبارات بعد.</p>
      )}
      {exams.map((e) => {
        const correct = e.correct_count ?? 0;
        const wrong = e.wrong_count ?? 0;
        const answered = e.answered_count ?? correct + wrong;
        const unanswered = e.unanswered_count ?? Math.max(0, (e.question_count || 0) - answered);
        return (
          <div
            key={e.id}
            className="card"
            style={{
              padding: 16,
              marginBottom: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: 14, alignItems: "center", flex: 1, minWidth: 200 }}>
              <MiniDonut correct={correct} wrong={wrong} unanswered={unanswered} />
              <div>
                <strong>{e.title}</strong>
                <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
                  {e.subject_name ? `${e.subject_name} · ` : ""}
                  أجبت {answered} · لم تُجب {unanswered} ·{" "}
                  <span style={{ color: "var(--success)" }}>{correct} صح</span>
                  {" · "}
                  <span style={{ color: "var(--error)" }}>{wrong} غلط</span>
                </div>
              </div>
            </div>
            <Link to={`/results/${e.id}`} className="btn btn-secondary btn-sm">
              مراجعة
            </Link>
          </div>
        );
      })}
    </div>
  );
}
