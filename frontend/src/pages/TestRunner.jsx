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
  const [checkByAnswer, setCheckByAnswer] = useState({});
  const [answerBusy, setAnswerBusy] = useState(false);
  const [verdict, setVerdict] = useState(null);
  const [showVideo, setShowVideo] = useState(false);
  const [showExplainVideo, setShowExplainVideo] = useState(false);
  const [remainSec, setRemainSec] = useState(null);
  const finishing = useRef(false);
  const verdictTimer = useRef(null);
  const pendingFeedback = useRef(null);

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
      if (pendingFeedback.current) {
        setFeedback(pendingFeedback.current);
        setShowExplainVideo(false);
      }
      after?.();
    }, 750);
  }

  function dismissVerdict() {
    if (!verdict) return;
    if (verdictTimer.current) clearTimeout(verdictTimer.current);
    setVerdict(null);
    if (pendingFeedback.current) {
      setFeedback(pendingFeedback.current);
      setShowExplainVideo(false);
    }
  }

  function clearQuestionUi() {
    setFeedback(null);
    setShowVideo(false);
    setShowExplainVideo(false);
  }

  async function finish(timedOut = false) {
    if (finishing.current) return;
    if (!timedOut) {
      const ok = window.confirm(
        "إنهاء الاختبار الآن؟ ستظهر نتيجتك (المُجاب وغير المُجاب والصحيح والخطأ)."
      );
      if (!ok) return;
    }
    if (verdictTimer.current) clearTimeout(verdictTimer.current);
    setVerdict(null);
    finishAfterVerdict(timedOut);
  }

  async function finishAfterVerdict(timedOut = false) {
    if (finishing.current) return;
    finishing.current = true;
    try {
      await client.post(`/exams/${examId}/finish/`, {
        timed_out: timedOut,
        auto: timedOut,
      });
      navigate(`/results/${examId}`, { state: { timedOut } });
    } catch {
      finishing.current = false;
    }
  }

  if (!payload) return <div className="spinner">جاري التحميل…</div>;

  const { exam, questions } = payload;
  const q = questions[idx];
  const timed = exam.time_limit_minutes > 0 && exam.ends_at;
  const selected = answers[q.answer_id];
  const isFinalReview = exam.review_mode !== "immediate";
  const navBlocked = isFinalReview
    ? !!verdict || answerBusy || !selected
    : !!verdict || answerBusy || !selected || !feedback;

  async function choose(optionKey) {
    if (answerBusy || verdict) return;
    if (!isFinalReview && feedback) return;
    setAnswers((a) => ({ ...a, [q.answer_id]: optionKey }));
    setAnswerBusy(true);
    try {
      const { data } = await client.post(`/exams/${examId}/answer/`, {
        answer_id: q.answer_id,
        selected: optionKey,
      });
      if (isFinalReview) {
        // Save only — reveal correct/wrong + explanation after finishing.
        pendingFeedback.current = null;
        setFeedback(null);
        setCheckByAnswer((m) => {
          const next = { ...m };
          delete next[q.answer_id];
          return next;
        });
      } else {
        setCheckByAnswer((m) => ({ ...m, [q.answer_id]: data }));
        pendingFeedback.current = data;
        setShowExplainVideo(false);
        if (typeof data.is_correct === "boolean") {
          // Flash first; explanation appears when the flash ends.
          setFeedback(null);
          showVerdict(data.is_correct);
        } else {
          setFeedback(data);
        }
      }
    } catch {
      /* keep selection; student can retry */
    } finally {
      setAnswerBusy(false);
    }
  }

  function goNext() {
    if (verdict || answerBusy) return;
    if (!selected) return;
    if (!isFinalReview && !feedback) return;
    clearQuestionUi();
    setIdx((i) => i + 1);
  }

  function go(nextIdx) {
    if (verdict || answerBusy) return;
    clearQuestionUi();
    setIdx(nextIdx);
    if (isFinalReview) return;
    const nextQ = questions[nextIdx];
    const saved = nextQ ? checkByAnswer[nextQ.answer_id] : null;
    if (saved) setFeedback(saved);
  }

  const answeredCount = Object.keys(answers).length;
  const progress = Math.round((answeredCount / questions.length) * 100);

  return (
    <div className="exam-shell">
      <AnswerVerdictFlash verdict={verdict} onDone={dismissVerdict} />
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link to="/courses" className="btn btn-ghost btn-sm">
            الخروج للدورات
          </Link>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={answerBusy}
            onClick={() => finish(false)}
          >
            إنهاء الاختبار
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
            if (selected === o.key) cls += " selected";
            if (!isFinalReview && feedback) {
              if (o.key === feedback.correct_answer) cls = "answer-option correct";
              else if (o.key === selected && o.key !== feedback.correct_answer) {
                cls = "answer-option wrong";
              }
            }
            return (
              <div key={o.key} className={cls} onClick={() => choose(o.key)}>
                <span className="answer-option__key">{o.key}</span>
                <div className="answer-option__body">
                  <MathText>{o.text}</MathText>
                  {o.image && (
                    <img
                      src={o.image}
                      alt=""
                      style={{ display: "block", maxWidth: 180, marginTop: 8, borderRadius: 6 }}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {answerBusy && (
            <p style={{ marginTop: 12, color: "var(--text-muted)", fontSize: 13 }}>جاري الحفظ…</p>
          )}

          {!isFinalReview && feedback && (
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  fontWeight: 700,
                  marginBottom: 10,
                  color: feedback.is_correct ? "var(--success)" : "var(--error)",
                }}
              >
                {feedback.is_correct ? "إجابة صحيحة ✓" : "إجابة خاطئة ✗"}
              </div>
              {(feedback.written_correction || feedback.explanation) && (
                <div
                  className="banner"
                  style={{ marginBottom: 10, textAlign: "right" }}
                >
                  <strong style={{ display: "block", marginBottom: 6 }}>شرح السؤال</strong>
                  <MathText>{feedback.written_correction || feedback.explanation}</MathText>
                </div>
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
                  {showExplainVideo ? (
                    <VideoPlayer bunnyId={feedback.video_bunny_id} />
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowExplainVideo(true)}
                    >
                      مشاهدة فيديو الشرح
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={idx === 0 || !!verdict || answerBusy}
              onClick={() => go(idx - 1)}
            >
              ← السابق
            </button>
            {idx < questions.length - 1 ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={navBlocked}
                onClick={goNext}
              >
                {isFinalReview ? "التالي →" : "تحقق →"}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={navBlocked}
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
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>
            {isFinalReview
              ? "المراجعة نهائية: اختر إجاباتك دون معرفة الصح أو الخطأ، ثم تظهر النتيجة بعد إنهاء الاختبار."
              : "بعد اختيار الإجابة تظهر علامة الصح أو الخطأ، ثم شرح المدرس أو فيديو الشرح إن وُجد"}
          </p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            style={{ marginTop: 16 }}
            disabled={answerBusy}
            onClick={() => finish(false)}
          >
            إنهاء الاختبار وعرض النتيجة
          </button>
        </div>
      </div>
    </div>
  );
}
