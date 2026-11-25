import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import client from "../api/client";
import AnswerVerdictFlash from "../components/AnswerVerdictFlash";
import BackToCourses from "../components/BackToCourses";
import MathText from "../components/MathText";
import QuestionMeta from "../components/QuestionMeta";
import VideoPlayer from "../components/VideoPlayer";
import { applySubjectTheme, lockSubjectTheme, resolveExamThemeKey } from "../theme/subjects";

function formatRemain(sec) {
  if (sec == null || sec < 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Build section ranges for collection (50) / exam (22) practice. */
function buildSections(total, sectionSize) {
  if (!sectionSize || total <= 0) return [];
  const sections = [];
  for (let start = 0; start < total; start += sectionSize) {
    const end = Math.min(start + sectionSize, total) - 1;
    sections.push({
      index: sections.length,
      start,
      end,
      label: `القسم ${sections.length + 1} (${start + 1}–${end + 1})`,
    });
  }
  return sections;
}

function sectionOf(idx, sectionSize) {
  if (!sectionSize || sectionSize <= 0) return 0;
  return Math.floor(idx / sectionSize);
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
  const [mapOpen, setMapOpen] = useState(false);
  const [remainSec, setRemainSec] = useState(null);
  const [qRemainSec, setQRemainSec] = useState(null);
  const [breakRemain, setBreakRemain] = useState(null);
  const finishing = useRef(false);
  const qDeadlineRef = useRef(null);
  const verdictTimer = useRef(null);
  const pendingFeedback = useRef(null);
  const resumeReady = useRef(false);
  const saveCursorTimer = useRef(null);
  const continueSectionRef = useRef(null);

  useEffect(() => {
    client.get(`/exams/${examId}/`).then((res) => {
      setPayload(res.data);
      const restored = {};
      res.data.questions.forEach((q) => {
        if (q.selected_answer) restored[q.answer_id] = q.selected_answer;
      });
      setAnswers(restored);
      // Resume at last position (collections / sectioned exams).
      const last = Number(res.data.exam?.last_question_index) || 0;
      const maxIdx = Math.max(0, (res.data.questions?.length || 1) - 1);
      setIdx(Math.min(Math.max(0, last), maxIdx));
      resumeReady.current = true;
    });
  }, [examId]);

  // Persist resume cursor (debounced) while in progress (not during break).
  useEffect(() => {
    if (!resumeReady.current || !payload?.exam) return undefined;
    if (payload.exam.status && payload.exam.status !== "in_progress") return undefined;
    if (payload.exam.break_pending) return undefined;
    if (saveCursorTimer.current) clearTimeout(saveCursorTimer.current);
    saveCursorTimer.current = setTimeout(() => {
      client
        .patch(`/exams/${examId}/`, { last_question_index: idx })
        .catch(() => {});
    }, 400);
    return () => {
      if (saveCursorTimer.current) clearTimeout(saveCursorTimer.current);
    };
  }, [idx, examId, payload?.exam?.id, payload?.exam?.status, payload?.exam?.break_pending]);

  useEffect(() => {
    if (!payload?.exam) return undefined;
    const key = resolveExamThemeKey(payload.exam, payload.questions);
    lockSubjectTheme(key);
    applySubjectTheme(key);
    return undefined;
  }, [payload?.exam, payload?.questions]);

  useEffect(() => {
    const ends = payload?.exam?.ends_at;
    if (!ends || payload?.exam?.duration_mode === "per_question") {
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
  }, [payload?.exam?.id, payload?.exam?.ends_at, payload?.exam?.duration_mode]);

  // Per-question timer for teacher tests (B4 / B6) — locks question when time ends.
  useEffect(() => {
    const exam = payload?.exam;
    const secs = exam?.seconds_per_question;
    if (!exam || exam.duration_mode !== "per_question" || !secs || verdict) {
      setQRemainSec(null);
      qDeadlineRef.current = null;
      return undefined;
    }
    qDeadlineRef.current = Date.now() + secs * 1000;
    const tick = () => {
      const left = Math.max(0, Math.floor((qDeadlineRef.current - Date.now()) / 1000));
      setQRemainSec(left);
      if (left <= 0) {
        // Auto-advance / finish when question time ends
        const qs = payload?.questions || [];
        if (idx >= qs.length - 1) {
          finish(true);
        } else {
          clearQuestionUi();
          setIdx((i) => i + 1);
        }
      }
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload?.exam?.id, payload?.exam?.duration_mode, payload?.exam?.seconds_per_question, idx, verdict]);

  // Break countdown (client-side; leave/return skips via API resolve_break_on_load).
  useEffect(() => {
    const exam = payload?.exam;
    if (!exam?.break_pending) {
      setBreakRemain(null);
      return undefined;
    }
    const breakSeconds = exam.break_seconds || 300;
    const started = exam.break_started_at
      ? new Date(exam.break_started_at).getTime()
      : Date.now();
    const endMs = started + breakSeconds * 1000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endMs - Date.now()) / 1000));
      setBreakRemain(left);
      if (left <= 0) continueSectionRef.current?.();
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [
    payload?.exam?.break_pending,
    payload?.exam?.break_started_at,
    payload?.exam?.id,
    payload?.exam?.break_seconds,
  ]);

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

  function applyExamPayload(data) {
    setPayload(data);
    const restored = {};
    (data.questions || []).forEach((qq) => {
      if (qq.selected_answer) restored[qq.answer_id] = qq.selected_answer;
    });
    setAnswers((prev) => ({ ...prev, ...restored }));
    const last = Number(data.exam?.last_question_index) || 0;
    const maxIdx = Math.max(0, (data.questions?.length || 1) - 1);
    setIdx(Math.min(Math.max(0, last), maxIdx));
    clearQuestionUi();
  }

  async function startBreak() {
    try {
      const { data } = await client.patch(`/exams/${examId}/`, { action: "start_break" });
      applyExamPayload(data);
    } catch {
      /* stay on last question */
    }
  }

  async function continueSection() {
    try {
      const { data } = await client.patch(`/exams/${examId}/`, {
        action: "continue_section",
      });
      applyExamPayload(data);
    } catch {
      /* keep break UI */
    }
  }
  continueSectionRef.current = continueSection;

  if (!payload) return <div className="spinner">جاري التحميل…</div>;

  const { exam, questions } = payload;
  const perQ = exam.duration_mode === "per_question" && exam.seconds_per_question > 0;
  const timed = perQ || (exam.time_limit_minutes > 0 && exam.ends_at);
  const isFinalReview = exam.review_mode !== "immediate";

  // Collections: free sections of 50 (Task 21).
  // Simulators: locked sections of 22 + break (Task 22). Teacher tests: none.
  const isCollection = exam.exam_type === "collection";
  const sectionsLocked = !!exam.sections_locked;
  const sectionSize =
    exam.section_size ||
    (isCollection ? 50 : sectionsLocked ? 22 : null);
  const sections = sectionSize ? buildSections(questions.length, sectionSize) : [];
  const currentSection = sectionsLocked
    ? Number(exam.current_section) || 0
    : sectionSize
      ? sectionOf(idx, sectionSize)
      : 0;
  const sectionMeta = sections[currentSection] || null;
  const mapQuestions = sectionMeta
    ? questions
        .map((qq, i) => ({ qq, i }))
        .filter(({ i }) => i >= sectionMeta.start && i <= sectionMeta.end)
    : questions.map((qq, i) => ({ qq, i }));
  const atSectionEnd = sectionMeta ? idx >= sectionMeta.end : idx >= questions.length - 1;
  const hasMoreSections = currentSection < sections.length - 1;
  const breakSeconds = exam.break_seconds || 300;

  function goSection(sectionIndex) {
    if (sectionsLocked) return; // free jump only for collections
    const sec = sections[sectionIndex];
    if (!sec || verdict || answerBusy) return;
    go(sec.start);
  }

  function go(nextIdx) {
    if (verdict || answerBusy) return;
    let target = nextIdx;
    if (sectionMeta && sectionsLocked) {
      target = Math.max(sectionMeta.start, Math.min(nextIdx, sectionMeta.end));
    }
    clearQuestionUi();
    setIdx(target);
    if (isFinalReview) return;
    const nextQ = questions[target];
    const saved = nextQ ? checkByAnswer[nextQ.answer_id] : null;
    if (saved) setFeedback(saved);
  }

  function goNext() {
    if (verdict || answerBusy) return;
    const qNow = questions[idx];
    const sel = answers[qNow?.answer_id];
    if (!sel) return;
    if (!isFinalReview && !feedback) return;
    // Simulator: last Q of section → break (not last section of exam).
    if (sectionsLocked && atSectionEnd && hasMoreSections) {
      clearQuestionUi();
      startBreak();
      return;
    }
    if (idx >= questions.length - 1) return;
    clearQuestionUi();
    setIdx((i) => i + 1);
  }

  if (exam.break_pending) {
    const nextSec = sections[currentSection + 1];
    const nextLabel = nextSec
      ? `${nextSec.start + 1}–${nextSec.end + 1}`
      : "";
    const pct =
      breakRemain == null
        ? 100
        : Math.round((breakRemain / breakSeconds) * 100);
    return (
      <div className="exam-shell">
        <BackToCourses subjectId={exam.subject} />
        <div className="card exam-break">
          <div
            className="exam-break-ring"
            style={{ "--p": pct }}
          >
            <div>
              <b>{formatRemain(breakRemain ?? breakSeconds)}</b>
              <small>استراحة</small>
            </div>
          </div>
          <h2>
            خلصت القسم {currentSection + 1} من {sections.length || "—"} 👏
          </h2>
          <p>
            خد نفسك — القسم التالي هيبدأ تلقائيًا بعد انتهاء الاستراحة (5 دقائق كحد أقصى).
            مش هتقدر ترجع للقسم اللي خلص.
          </p>
          <button type="button" className="btn btn-primary" onClick={continueSection}>
            متابعة القسم التالي{nextLabel ? ` (${nextLabel})` : ""} ←
          </button>
        </div>
      </div>
    );
  }

  const q = questions[idx];
  if (!q) return <div className="spinner">جاري التحميل…</div>;

  const selected = answers[q.answer_id];
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

  const answeredCount = Object.keys(answers).length;
  const progress = Math.round((answeredCount / questions.length) * 100);
  const prevDisabled =
    !!verdict ||
    answerBusy ||
    (sectionMeta ? idx <= sectionMeta.start : idx === 0);

  return (
    <div className="exam-shell">
      <AnswerVerdictFlash verdict={verdict} onDone={dismissVerdict} />
      <BackToCourses subjectId={exam.subject} />
      <div
        className="card"
        style={{
          padding: "10px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span>{exam.title}</span>
        <span>
          سؤال {idx + 1} من {questions.length}
          {sectionMeta ? ` · القسم ${currentSection + 1}/${sections.length}` : ""}
        </span>
        {timed && (
          <span
            style={{
              fontWeight: 700,
              color:
                (perQ ? qRemainSec : remainSec) != null &&
                (perQ ? qRemainSec : remainSec) <= 15
                  ? "var(--error)"
                  : "var(--primary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ⏱ {formatRemain(perQ ? qRemainSec : remainSec)}
            {perQ ? " / سؤال" : ""}
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
      <div style={{ height: 5, background: "var(--border)", borderRadius: 4, marginBottom: 12 }}>
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "var(--primary)",
            borderRadius: 4,
          }}
        />
      </div>

      <button
        type="button"
        className="btn btn-ghost exam-map-toggle"
        onClick={() => setMapOpen((v) => !v)}
      >
        {mapOpen ? "إخفاء خريطة الأسئلة" : "خريطة الأسئلة"}
      </button>

      <div className="exam-layout">
        <div className="card exam-qcard">
          {q.video_bunny_id && q.video_before && (
            <div style={{ marginBottom: 12 }}>
              {showVideo ? (
                <VideoPlayer bunnyId={q.video_bunny_id} />
              ) : (
                <div
                  className="banner"
                  style={{ cursor: "pointer", marginBottom: 0, padding: "10px 14px" }}
                  onClick={() => setShowVideo(true)}
                >
                  🎬 فيديو توضيحي قبل الإجابة · <strong>مشاهدة</strong>
                </div>
              )}
            </div>
          )}

          <div className="exam-qtop">
            <QuestionMeta
              difficulty={q.difficulty}
              difficultyLabel={q.difficulty_label}
              subjectName={q.subject_name}
              lessonTitle={q.lesson_title}
              questionYear={q.question_year}
            />
            {sections.length > 1 && isCollection && (
              <label className="exam-section-sel">
                <span className="sr-only">القسم</span>
                <select
                  value={currentSection}
                  onChange={(e) => goSection(Number(e.target.value))}
                  disabled={!!verdict || answerBusy}
                >
                  {sections.map((s) => (
                    <option key={s.index} value={s.index}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <h3 className="exam-qtext">
            <span className="exam-qnum">{idx + 1}. </span>
            <MathText>{q.text}</MathText>
          </h3>
          {q.text_image && (
            <img src={q.text_image} alt="" className="exam-qimg" />
          )}

          {q.options.map((o) => {
            let cls = "answer-option";
            let mark = null;
            if (selected === o.key) cls += " selected";
            if (!isFinalReview && feedback) {
              if (o.key === feedback.correct_answer) {
                cls = "answer-option correct";
                mark = <span className="answer-option__mark ok">✓ صح</span>;
              } else if (o.key === selected && o.key !== feedback.correct_answer) {
                cls = "answer-option wrong";
                mark = <span className="answer-option__mark no">✗ إجابتك</span>;
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
                      className="exam-qimg"
                      style={{ maxHeight: 120, marginTop: 6, marginBottom: 0 }}
                    />
                  )}
                </div>
                {mark}
              </div>
            );
          })}

          {answerBusy && (
            <p style={{ marginTop: 8, color: "var(--text-muted)", fontSize: 13 }}>جاري الحفظ…</p>
          )}

          <div className="exam-qnav">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={prevDisabled}
              onClick={() => go(idx - 1)}
            >
              → السابق
            </button>
            {idx < questions.length - 1 || (sectionsLocked && atSectionEnd && hasMoreSections) ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={navBlocked}
                onClick={goNext}
              >
                {sectionsLocked && atSectionEnd && hasMoreSections
                  ? "استراحة ←"
                  : "التالي ←"}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={navBlocked}
                onClick={() => finish(false)}
              >
                إنهاء ✓
              </button>
            )}
          </div>

          {!isFinalReview && feedback && (
            <div style={{ marginTop: 14 }}>
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
                  className="exam-qimg"
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
        </div>

        <div className={`card exam-map${mapOpen ? "" : " is-collapsed"}`}>
          <div
            style={{
              fontWeight: 700,
              marginBottom: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span>خريطة الأسئلة</span>
            {sectionMeta && (
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                القسم {currentSection + 1}
              </span>
            )}
          </div>
          {sectionsLocked && sections.length > 1 && (
            <div className="exam-section-chips">
              {sections.map((s) => {
                let cls = "exam-section-chip";
                if (s.index < currentSection) cls += " is-locked";
                else if (s.index === currentSection) cls += " is-current";
                return (
                  <span key={s.index} className={cls}>
                    {s.index < currentSection
                      ? `🔒 ${s.start + 1}–${s.end + 1}`
                      : `القسم ${s.index + 1} (${s.start + 1}–${s.end + 1})`}
                  </span>
                );
              })}
            </div>
          )}
          <div className="q-nav">
            {mapQuestions.map(({ qq, i }) => {
              let cls = "q-btn";
              if (i === idx) cls += " current";
              else if (answers[qq.answer_id]) cls += " answered";
              return (
                <div
                  key={qq.answer_id}
                  className={cls}
                  onClick={() => {
                    go(i);
                    setMapOpen(false);
                  }}
                >
                  {i + 1}
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>
            {sectionMeta
              ? `أسئلة ${sectionMeta.start + 1}–${sectionMeta.end + 1} (القسم الحالي فقط)`
              : isFinalReview
                ? "المراجعة نهائية: اختر إجاباتك دون معرفة الصح أو الخطأ، ثم تظهر النتيجة بعد إنهاء الاختبار."
                : "بعد اختيار الإجابة تظهر علامة الصح أو الخطأ، ثم شرح المدرس أو فيديو الشرح إن وُجد"}
          </p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            style={{ marginTop: 14 }}
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
