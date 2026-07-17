import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";

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
        كل اختبار باسمه — اضغط لمراجعة إجاباتك
      </p>
      {exams.length === 0 && <p style={{ color: "var(--text-muted)" }}>لا توجد اختبارات بعد.</p>}
      {exams.map((e) => (
        <div key={e.id} className="card"
          style={{ padding: 16, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>{e.title}</strong>
            <br />
            <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
              {e.score_percent}% · {e.correct_count} صحيح · {e.wrong_count} خطأ
            </span>
          </div>
          <Link to={`/results/${e.id}`} className="btn btn-secondary btn-sm">مراجعة</Link>
        </div>
      ))}
    </div>
  );
}
