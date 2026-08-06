import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import client from "../api/client";
import AnswerVerdictFlash from "../components/AnswerVerdictFlash";
import BackToCourses from "../components/BackToCourses";
import MathText from "../components/MathText";
import QuestionMeta from "../components/QuestionMeta";
import VideoPlayer from "../components/VideoPlayer";
import { applySubjectTheme, lockSubjectTheme, resolveSubjectKey } from "../theme/subjects";

function formatRemain(sec) {
  if (sec == null || sec < 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function TestRunner() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [lastResult, setLastResult] = useState({});
  const [showVideo, setShowVideo] = useState(false);
  const [remainSec, setRemainSec] = useState(null);
  const finishing = useRef(false);
  const verdictTimer = useRef(null);

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

  useEffect(() => {
    const name = payload?.exam?.subject_name;
    if (!name) return undefined;
    const key = resolveSubjectKey(name);
    lockSubjectTheme(key);
    applySubjectTheme(key);
    return undefined;
  }, [payload?.exam?.subject_name]);

  useEffect(() => {
    const ends = payload?.exam?.ends_at;
    if (!ends) {
      setRemainSec(null);
      return undefined;
    }
    const endMs = new Date(ends).getTime();
    const tick = () => {
      const left = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
      setRemainSec(left);
      if (left <= 0) finish(true);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload?.exam?.id, payload?.exam?.ends_at]);

  useEffect(
    () => () => {
      if (verdictTimer.current) clearTimeout(verdictTimer.current);
    },
    []
  );

  function showVerdict(isCorrect, after) {
    if (verdictTimer.current) clearTimeout(verdictTimer.current);
    setVerdict(isCorrect ? "correct" : "wrong");
    verdictTimer.current = setTimeout(() => {
      setVerdict(null);
      after?.();
    }, 1500);
  }

  async function finish(timedOut = false) {
    if (finishing.current) return;
    // On manual finish from last question, flash verdict first (not on timeout).
    if (!timedOut && payload) {
      const current = payload.questions[idx];
      const result = current ? lastResult[current.answer_id] : undefined;
      if (typeof result === "boolean" && !verdict) {
        showVerdict(result, () => finishAfterVerdict(false));
        return;
      }
    }
    finishAfterVerdict(timedOut);
  }

  async function finishAfterVerdict(timedOut = false) {
    if (finishing.current) return;
    finishing.current = true;
    try {
      const { data } = await client.post(`/exams/${examId}/finish/`, {
        timed_out: timedOut,
        auto: timedOut,
      });
      navigate(`/results/${examId}`, { state: { justFinished: data, timedOut } });
    } catch {
      finishing.current = false;
    }
  }

  if (!payload) return <div className="spinner">جاري التحميل…</div>;

  const { exam, questions } = payload;
  const q = questions[idx];
  const immediate = exam.review_mode === "immediate";
  const timed = exam.time_limit_minutes > 0 && exam.ends_at;

  async function choose(optionKey) {
    setAnswers((a) => ({ ...a, [q.answer_id]: optionKey }));
    const { data } = await client.post(`/exams/${examId}/answer/`, {
      answer_id: q.answer_id,
      selected: optionKey,
    });
    if (typeof data.is_correct === "boolean") {
      setLastResult((r) => ({ ...r, [q.answer_id]: data.is_correct }));
    }
    if (immediate) setFeedback(data);
  }

  function goNext() {
    if (verdict) return;
    const result = lastResult[q.answer_id];
    const advance = () => {
      setFeedback(null);
      setShowVideo(false);
      setIdx((i) => i + 1);
    };
    if (typeof result === "boolean") {
      showVerdict(result, advance);
      return;
    }
    advance();
  }

  function go(nextIdx) {
    // خريطة الأسئلة / السابق — بدون فلاش
    if (verdict) return;
    setFeedback(null);
    setShowVideo(false);
    setIdx(nextIdx);
  }

  const answeredCount = Object.keys(answers).length;
  const progress = Math.round((answeredCount / questions.length) * 100);

  return (
    <div className="exam-shell">
      <AnswerVerdictFlash verdict={verdict} onDone={() => {}} />
      <BackToCourses subjectId={exam.subject} />
      <div
        className="card"
        style={{
          padding: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span>{exam.title}</span>
        <span>سؤال {idx + 1} من {questions.length}</span>
        {timed && (
          <span
            style={{
              fontWeight: 700,
              color: remainSec != null && remainSec <= 60 ? "var(--error)" : "var(--primary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ⏱ {formatRemain(remainSec)}
          </span>
        )}
        {!timed && (
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>مدة مفتوحة</span>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <Link to="/courses" className="btn btn-ghost btn-sm">
            الخروج للدورات
          </Link>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => finish(false)}>
            إنهاء
          </button>
        </div>
      </div>
      <div style={{ height: 6, background: "var(--border)", borderRadius: 4, marginBottom: 20 }}>
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "var(--primary)",
            borderRadius: 4,
          }}
        />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 260px", gap: 20 }}>
        <div className="card" style={{ padding: 28 }}>
          {q.video_bunny_id && q.video_before && (
            <div style={{ marginBottom: 16 }}>
              {showVideo ? (
                <VideoPlayer bunnyId={q.video_bunny_id} />
              ) : (
                <div
                  className="banner"
                  style={{ cursor: "pointer" }}
                  onClick={() => setShowVideo(true)}
                >
                  🎬 فيديو توضيحي قبل الإجابة · <strong>مشاهدة</strong>
                </div>
              )}
            </div>
          )}

          <QuestionMeta
            difficulty={q.difficulty}
            difficultyLabel={q.difficulty_label}
            subjectName={q.subject_name}
            lessonTitle={q.lesson_title}
            questionYear={q.question_year}
          />

          <h3 style={{ fontSize: 18, marginBottom: 20, lineHeight: 1.8 }}>
            <MathText>{q.text}</MathText>
          </h3>
          {q.text_image && (
            <img
              src={q.text_image}
              alt=""
              style={{ maxWidth: "100%", marginBottom: 16, borderRadius: 8 }}
            />
          )}

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
                {o.image && (
                  <img
                    src={o.image}
                    alt=""
                    style={{ display: "block", maxWidth: 180, marginTop: 8, borderRadius: 6 }}
                  />
                )}
              </div>
            );
          })}

          {feedback && (
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  fontWeight: 700,
                  color: feedback.is_correct ? "var(--success)" : "var(--error)",
                }}
              >
                {feedback.is_correct ? "إجابة صحيحة ✓" : "إجابة خاطئة ✗"}
              </div>
              {(feedback.written_correction || feedback.explanation) && (
                <p style={{ marginTop: 8, color: "var(--text-muted)" }}>
                  <MathText>{feedback.written_correction || feedback.explanation}</MathText>
                </p>
              )}
              {(feedback.explanation_image || feedback.text_image) && (
                <img
                  src={feedback.explanation_image || feedback.text_image}
                  alt=""
                  style={{ maxWidth: "100%", marginTop: 8, borderRadius: 8 }}
                />
              )}
              {feedback.video_bunny_id && (
                <div style={{ marginTop: 12 }}>
                  <VideoPlayer bunnyId={feedback.video_bunny_id} />
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={idx === 0}
              onClick={() => go(idx - 1)}
            >
              ← السابق
            </button>
            {idx < questions.length - 1 ? (
              <button type="button" className="btn btn-primary" disabled={!!verdict} onClick={goNext}>
                التالي →
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!!verdict}
                onClick={() => finish(false)}
              >
                إنهاء الاختبار
              </button>
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
          {exam.review_mode === "immediate" ? (
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>
              مراجعة فورية بعد كل سؤال
            </p>
          ) : (
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>
              المراجعة في نهاية الاختبار
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
