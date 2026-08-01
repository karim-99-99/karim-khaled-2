import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import client from "../api/client";
import MathText from "../components/MathText";
import VideoPlayer from "../components/VideoPlayer";

export default function ResultReview() {
  const { examId } = useParams();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("all");
  const [openVideo, setOpenVideo] = useState(null);

  useEffect(() => {
    const q = filter === "wrong" ? "?filter=wrong" : "";
    client.get(`/exams/${examId}/review/${q}`).then((res) => setData(res.data));
  }, [examId, filter]);

  if (!data) return <div className="spinner">جاري التحميل…</div>;

  const { exam, answers } = data;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div className="breadcrumb">نتائج &gt; <span>{exam.title}</span></div>
          <h1 style={{ fontSize: 24, marginTop: 8 }}>
            {exam.score_percent}% · {exam.correct_count} صحيح · {exam.wrong_count} خطأ
          </h1>
        </div>
        <Link to="/results" className="btn btn-ghost">رجوع للقائمة</Link>
      </div>

      <div className="filter-row">
        <span className={`chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>الكل</span>
        <span className={`chip ${filter === "wrong" ? "active" : ""}`} onClick={() => setFilter("wrong")}>الأخطاء فقط</span>
      </div>

      {answers.map((a) => (
        <div key={a.id} className="card" style={{ padding: 20, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: a.is_correct ? "var(--success)" : "var(--error)" }}>
            سؤال {a.order + 1} — {a.is_correct ? "صحيح" : "خطأ"} · إجابتك: {a.selected_answer || "—"}
            {!a.is_correct && ` · الصحيح: ${a.correct_answer}`}
          </div>
          <div style={{ marginBottom: 10 }}>
            <MathText>{a.question_text}</MathText>
          </div>
          {a.text_image && (
            <img src={a.text_image} alt="" style={{ maxWidth: "100%", marginBottom: 10, borderRadius: 8 }} />
          )}
          {a.options?.map((o) => (
            <div key={o.key} style={{ marginBottom: 6, fontSize: 14 }}>
              <span>{o.key})</span> <MathText>{o.text}</MathText>
              {o.image && (
                <img src={o.image} alt="" style={{ display: "block", maxWidth: 160, marginTop: 4, borderRadius: 6 }} />
              )}
            </div>
          ))}
          {a.written_correction && (
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
              <MathText>{a.written_correction}</MathText>
            </p>
          )}
          {a.explanation_image && (
            <img src={a.explanation_image} alt="" style={{ maxWidth: "100%", marginTop: 8, borderRadius: 8 }} />
          )}
          {a.video_bunny_id && (
            <div style={{ marginTop: 10 }}>
              {openVideo === a.id ? (
                <VideoPlayer bunnyId={a.video_bunny_id} />
              ) : (
                <button className="btn btn-secondary btn-sm" onClick={() => setOpenVideo(a.id)}>
                  تصحيح بالفيديو
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
