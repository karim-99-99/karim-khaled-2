import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import client from "../api/client";

export default function SimulatorSetup() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState([]);
  const [selected, setSelected] = useState([]);
  const [count, setCount] = useState(8);
  const [level, setLevel] = useState("medium");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    client.get(`/subjects/${subjectId}/lessons/`).then((res) => setLessons(res.data));
  }, [subjectId]);

  function toggle(id) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function start() {
    setError("");
    setBusy(true);
    try {
      const { data } = await client.post("/exams/simulator/", {
        subject: Number(subjectId),
        lessons: selected,
        count,
        level,
      });
      navigate(`/exam/${data.exam.id}`);
    } catch (e) {
      setError(e.response?.data?.detail || "تعذّر بدء الاختبار");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card form-card" style={{ maxWidth: 640 }}>
      <h2 style={{ marginBottom: 24 }}>المحاكي الشخصي</h2>

      <div className="form-group">
        <label>الدروس</label>
        <div className="filter-row">
          {lessons.map((l) => (
            <span key={l.id} className={`chip ${selected.includes(l.id) ? "active" : ""}`}
              onClick={() => toggle(l.id)}>
              {l.title}
            </span>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>عدد الأسئلة</label>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setCount((c) => Math.max(1, c - 1))}>−</button>
          <div className="form-control" style={{ width: 80, textAlign: "center" }}>{count}</div>
          <button className="btn btn-ghost btn-sm" onClick={() => setCount((c) => c + 1)}>+</button>
        </div>
      </div>

      <div className="form-group">
        <label>المستوى</label>
        <div className="filter-row">
          {[["easy", "سهل"], ["medium", "متوسط"], ["hard", "صعب"]].map(([v, t]) => (
            <span key={v} className={`chip ${level === v ? "active" : ""}`} onClick={() => setLevel(v)}>
              {t}
            </span>
          ))}
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}
      <button className="btn btn-primary btn-block" onClick={start} disabled={busy}>
        {busy ? "…" : "ابدأ الاختبار ←"}
      </button>
    </div>
  );
}
