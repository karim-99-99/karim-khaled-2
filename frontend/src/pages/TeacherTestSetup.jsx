import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import client from "../api/client";

const PRESETS = [
  { id: "easy", label: "سهل", ratio: "70% · 20% · 10%" },
  { id: "medium", label: "متوسط", ratio: "35% · 45% · 20%" },
  { id: "hard", label: "صعب", ratio: "20% · 40% · 40%" },
];

export default function TeacherTestSetup() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState([]);
  const [lesson, setLesson] = useState("");
  const [count, setCount] = useState(20);
  const [preset, setPreset] = useState("medium");
  const [reviewMode, setReviewMode] = useState("immediate");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    client.get(`/subjects/${subjectId}/lessons/`).then((res) => {
      setLessons(res.data);
      if (res.data[0]) setLesson(res.data[0].id);
    });
  }, [subjectId]);

  async function start() {
    setError("");
    setBusy(true);
    try {
      const { data } = await client.post("/exams/teacher/", {
        subject: Number(subjectId),
        lesson: lesson || null,
        count,
        preset,
        review_mode: reviewMode,
      });
      navigate(`/exam/${data.exam.id}`);
    } catch (e) {
      setError(e.response?.data?.detail || "تعذّر بدء الاختبار");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card form-card" style={{ maxWidth: 720 }}>
      <h2 style={{ marginBottom: 8 }}>اختبار المدرس</h2>
      <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>
        الأسئلة من بنك التجميعات حسب معادلة المستوى
      </p>

      <div className="form-group">
        <label>الدرس</label>
        <select className="form-control" value={lesson} onChange={(e) => setLesson(e.target.value)}>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>{l.title}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>عدد الأسئلة</label>
        <input type="number" className="form-control" style={{ width: 120 }} value={count}
          onChange={(e) => setCount(Number(e.target.value))} min={1} />
      </div>

      <div className="form-group">
        <label>معادلة الصعوبة</label>
        <div className="grid grid-3">
          {PRESETS.map((p) => (
            <div key={p.id} className="card"
              style={{ padding: 20, textAlign: "center", cursor: "pointer",
                border: preset === p.id ? "2px solid var(--primary)" : undefined,
                background: preset === p.id ? "var(--primary-light)" : undefined }}
              onClick={() => setPreset(p.id)}>
              <h4>{p.label}</h4>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{p.ratio}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>المراجعة</label>
        <div style={{ display: "flex", gap: 16 }}>
          <label style={{ fontWeight: 400 }}>
            <input type="radio" checked={reviewMode === "immediate"} onChange={() => setReviewMode("immediate")} /> فورية — بعد كل سؤال
          </label>
          <label style={{ fontWeight: 400 }}>
            <input type="radio" checked={reviewMode === "final"} onChange={() => setReviewMode("final")} /> نهائية — في آخر الاختبار
          </label>
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}
      <button className="btn btn-primary btn-block" onClick={start} disabled={busy}>
        {busy ? "…" : "ابدأ اختبار المدرس"}
      </button>
    </div>
  );
}
