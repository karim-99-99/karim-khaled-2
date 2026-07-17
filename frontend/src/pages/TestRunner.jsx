import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import client from "../api/client";
import MathText from "../components/MathText";
import VideoPlayer from "../components/VideoPlayer";

export default function TestRunner() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // answer_id -> selected
  const [feedback, setFeedback] = useState(null); // immediate review
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    client.get(`/exams/${examId}/`).then((res) => {
      setPayload(res.data);
      const restored = {};
      res.data.questions.forEach((q) => {
        if (q.selected_answer) restored[q.answer_id] = q.selected_answer;
      });
      setAnswers(restored);
    });
  }, [examId]);

  if (!payload) return <div className="spinner">جاري التحميل…</div>;

  const { exam, questions } = payload;
  const q = questions[idx];
  const immediate = exam.review_mode === "immediate";

  async function choose(optionKey) {
    setAnswers((a) => ({ ...a, [q.answer_id]: optionKey }));
    const { data } = await client.post(`/exams/${examId}/answer/`, {
      answer_id: q.answer_id,
      selected: optionKey,
    });
    if (immediate) setFeedback(data);
  }

  function go(nextIdx) {
    setFeedback(null);
    setShowVideo(false);
    setIdx(nextIdx);
  }

  async function finish() {
    const { data } = await client.post(`/exams/${examId}/finish/`);
    navigate(`/results/${examId}`, { state: { justFinished: data } });
  }

  const answeredCount = Object.keys(answers).length;
  const progress = Math.round((answeredCount / questions.length) * 100);

  return (
    <div>
      <div className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span>{exam.title}</span>
        <span>سؤال {idx + 1} من {questions.length}</span>
        <button className="btn btn-ghost btn-sm" onClick={finish}>إنهاء</button>
      </div>
      <div style={{ height: 6, background: "var(--border)", borderRadius: 4, marginBottom: 20 }}>
        <div style={{ height: "100%", width: `${progress}%`, background: "var(--primary)", borderRadius: 4 }} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 260px", gap: 20 }}>
        <div className="card" style={{ padding: 28 }}>
          {/* Per-question video BEFORE answering */}
          {q.video_bunny_id && q.video_before && (
            <div style={{ marginBottom: 16 }}>
              {showVideo ? (
                <VideoPlayer bunnyId={q.video_bunny_id} />
              ) : (
                <div className="banner" style={{ cursor: "pointer" }} onClick={() => setShowVideo(true)}>
                  🎬 فيديو توضيحي قبل الإجابة · <strong>مشاهدة</strong>
                </div>
              )}
            </div>
          )}

          <h3 style={{ fontSize: 18, marginBottom: 20, lineHeight: 1.8 }}>
            <MathText>{q.text}</MathText>
          </h3>

          {q.options.map((o) => {
            let cls = "answer-option";
            if (answers[q.answer_id] === o.key) cls += " selected";
            if (feedback) {
              if (o.key === feedback.correct_answer) cls = "answer-option correct";
              else if (o.key === answers[q.answer_id]) cls = "answer-option wrong";
            }
            return (
              <div key={o.key} className={cls} onClick={() => !feedback && choose(o.key)}>
                <span>{o.key})</span> <MathText>{o.text}</MathText>
              </div>
            );
          })}

          {/* Immediate feedback + AFTER video */}
          {feedback && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 700, color: feedback.is_correct ? "var(--success)" : "var(--error)" }}>
                {feedback.is_correct ? "إجابة صحيحة ✓" : "إجابة خاطئة ✗"}
              </div>
              {feedback.written_correction && (
                <p style={{ marginTop: 8, color: "var(--text-muted)" }}>
                  <MathText>{feedback.written_correction}</MathText>
                </p>
              )}
              {feedback.video_bunny_id && (
                <div style={{ marginTop: 12 }}>
                  <VideoPlayer bunnyId={feedback.video_bunny_id} />
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
            <button className="btn btn-ghost" disabled={idx === 0} onClick={() => go(idx - 1)}>← السابق</button>
            {idx < questions.length - 1 ? (
              <button className="btn btn-primary" onClick={() => go(idx + 1)}>التالي →</button>
            ) : (
              <button className="btn btn-primary" onClick={finish}>إنهاء الاختبار</button>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: 20, height: "fit-content" }}>
          <div style={{ fontWeight: 700, marginBottom: 16 }}>خريطة الأسئلة</div>
          <div className="q-nav">
            {questions.map((qq, i) => {
              let cls = "q-btn";
              if (i === idx) cls += " current";
              else if (answers[qq.answer_id]) cls += " answered";
              return (
                <div key={qq.answer_id} className={cls} onClick={() => go(i)}>
                  {i + 1}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
