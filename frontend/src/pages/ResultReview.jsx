import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import client from "../api/client";
import BackToCourses from "../components/BackToCourses";
import MathText from "../components/MathText";
import QuestionMeta from "../components/QuestionMeta";
import VideoPlayer from "../components/VideoPlayer";
import { applySubjectTheme, lockSubjectTheme, resolveExamThemeKey } from "../theme/subjects";

function DonutChart({ correct = 0, wrong = 0, unanswered = 0, size = 168 }) {
  const total = Math.max(1, correct + wrong + unanswered);
  const cPct = (correct / total) * 100;
  const wPct = (wrong / total) * 100;
  const uPct = (unanswered / total) * 100;
  const gradient = `conic-gradient(
    var(--success) 0 ${cPct}%,
    var(--error) ${cPct}% ${cPct + wPct}%,
    #cbd5e1 ${cPct + wPct}% 100%
  )`;

  return (
    <div
      className="result-donut"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: gradient,
        display: "grid",
        placeItems: "center",
        boxShadow: "0 12px 28px rgba(15, 23, 42, 0.12)",
        flexShrink: 0,
      }}
      aria-hidden
    >
      <div
        style={{
          width: size * 0.58,
          height: size * 0.58,
          borderRadius: "50%",
          background: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          lineHeight: 1.2,
        }}
      >
        <strong style={{ fontSize: 22 }}>
          {Math.round((correct / total) * 100)}%
        </strong>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>نجاح</span>
      </div>
      {/* keep unused vars referenced for lint-ish clarity */}
      <span style={{ display: "none" }}>{uPct}</span>
    </div>
  );
}

export default function ResultReview() {
  const { examId } = useParams();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("all");
  const [openVideo, setOpenVideo] = useState(null);

  useEffect(() => {
    const q = filter === "wrong" ? "?filter=wrong" : "";
    client.get(`/exams/${examId}/review/${q}`).then((res) => setData(res.data));
  }, [examId, filter]);

  useEffect(() => {
    if (!data?.exam) return undefined;
    const key = resolveExamThemeKey(data.exam, data.answers);
    lockSubjectTheme(key);
    applySubjectTheme(key);
    return undefined;
  }, [data?.exam, data?.answers]);

  if (!data) return <div className="spinner">جاري التحميل…</div>;

  const { exam, answers } = data;
  const total = exam.question_count || answers.length || 0;
  const answered = exam.answered_count ?? answers.filter((a) => a.selected_answer).length;
  const unanswered = exam.unanswered_count ?? Math.max(0, total - answered);
  const correct = exam.correct_count ?? 0;
  const wrong = exam.wrong_count ?? 0;

  return (
    <div className="exam-shell">
      <BackToCourses subjectId={exam.subject} />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 20,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="breadcrumb">
            نتائج &gt; <span>{exam.title}</span>
          </div>
          <h1 style={{ fontSize: 24, marginTop: 8 }}>نتيجة الاختبار</h1>
        </div>
        <Link to="/results" className="btn btn-ghost">
          رجوع للقائمة
        </Link>
      </div>

      <div
        className="card result-summary"
        style={{
          padding: 24,
          marginBottom: 24,
          display: "flex",
          gap: 28,
          flexWrap: "wrap",
          alignItems: "center",
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--primary-light) 70%, #fff), #fff)",
        }}
      >
        <DonutChart correct={correct} wrong={wrong} unanswered={unanswered} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 15, color: "var(--text-muted)", marginBottom: 12 }}>
            {exam.subject_name} · {total} سؤال
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
              gap: 12,
            }}
          >
            <div className="result-stat">
              <div className="result-stat__label">أجبت</div>
              <div className="result-stat__value">{answered}</div>
            </div>
            <div className="result-stat">
              <div className="result-stat__label">لم تُجب</div>
              <div className="result-stat__value">{unanswered}</div>
            </div>
            <div className="result-stat result-stat--ok">
              <div className="result-stat__label">صحيح</div>
              <div className="result-stat__value">{correct}</div>
            </div>
            <div className="result-stat result-stat--bad">
              <div className="result-stat__label">خطأ</div>
              <div className="result-stat__value">{wrong}</div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              marginTop: 14,
              fontSize: 13,
              color: "var(--text-muted)",
            }}
          >
            <span>
              <span style={{ color: "var(--success)" }}>●</span> صحيح
            </span>
            <span>
              <span style={{ color: "var(--error)" }}>●</span> خطأ
            </span>
            <span>
              <span style={{ color: "#94a3b8" }}>●</span> لم تُجب
            </span>
          </div>
        </div>
      </div>

      <div className="filter-row">
        <span
          className={`chip ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          الكل
        </span>
        <span
          className={`chip ${filter === "wrong" ? "active" : ""}`}
          onClick={() => setFilter("wrong")}
        >
          الأخطاء فقط
        </span>
      </div>

      {answers.map((a) => {
        const unansweredRow = a.skipped || !a.selected_answer;
        const statusColor = unansweredRow
          ? "var(--text-muted)"
          : a.is_correct
            ? "var(--success)"
            : "var(--error)";
        const statusLabel = unansweredRow
          ? "لم تُجب"
          : a.is_correct
            ? "صحيح"
            : "خطأ";
        return (
          <div key={a.id} className="card" style={{ padding: 20, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 12, color: statusColor }}>
              سؤال {a.order + 1} — {statusLabel}
              {!unansweredRow && ` · إجابتك: ${a.selected_answer}`}
              {!a.is_correct && !unansweredRow && ` · الصحيح: ${a.correct_answer}`}
              {unansweredRow && a.correct_answer ? ` · الصحيح: ${a.correct_answer}` : ""}
            </div>
            <QuestionMeta
              difficulty={a.difficulty}
              difficultyLabel={a.difficulty_label}
              subjectName={a.subject_name}
              lessonTitle={a.lesson_title}
              questionYear={a.question_year}
            />
            <div style={{ marginBottom: 10 }}>
              <MathText>{a.question_text}</MathText>
            </div>
            {a.text_image && (
              <img
                src={a.text_image}
                alt=""
                style={{ maxWidth: "100%", marginBottom: 10, borderRadius: 8 }}
              />
            )}
            {a.options?.map((o) => {
              let cls = "answer-option";
              if (o.key === a.correct_answer) cls += " correct";
              else if (o.key === a.selected_answer && o.key !== a.correct_answer)
                cls += " wrong";
              return (
                <div key={o.key} className={cls} style={{ cursor: "default" }}>
                  <span className="answer-option__key">{o.key}</span>
                  <div className="answer-option__body">
                    <MathText>{o.text}</MathText>
                    {o.image && (
                      <img
                        src={o.image}
                        alt=""
                        style={{
                          display: "block",
                          maxWidth: 160,
                          marginTop: 4,
                          borderRadius: 6,
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
            {a.written_correction && (
              <div className="banner" style={{ marginTop: 8, textAlign: "right" }}>
                <strong style={{ display: "block", marginBottom: 6 }}>شرح السؤال</strong>
                <MathText>{a.written_correction}</MathText>
              </div>
            )}
            {a.explanation_image && (
              <img
                src={a.explanation_image}
                alt=""
                style={{ maxWidth: "100%", marginTop: 8, borderRadius: 8 }}
              />
            )}
            {a.video_bunny_id && (
              <div style={{ marginTop: 10 }}>
                {openVideo === a.id ? (
                  <VideoPlayer bunnyId={a.video_bunny_id} />
                ) : (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setOpenVideo(a.id)}
                  >
                    مشاهدة فيديو الشرح
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
