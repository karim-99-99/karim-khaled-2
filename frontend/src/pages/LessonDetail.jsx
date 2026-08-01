import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import client from "../api/client";
import VideoPlayer from "../components/VideoPlayer";
import MathText from "../components/MathText";
import { useAuth } from "../auth/AuthContext";

export default function LessonDetail() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lesson, setLesson] = useState(null);
  const [tab, setTab] = useState("video");
  const [homework, setHomework] = useState([]);
  const [hwIndex, setHwIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const freeTier = user?.role === "student" && !user?.has_active_subscription;

  useEffect(() => {
    client.get(`/lessons/${lessonId}/`).then((res) => setLesson(res.data));
    client
      .get(`/my-homework/?lesson=${lessonId}`)
      .then((res) => setHomework(res.data.results || res.data || []))
      .catch(() => setHomework([]));
    setHwIndex(0);
    setAnswers({});
  }, [lessonId]);

  if (!lesson) return <div className="spinner">جاري التحميل…</div>;

  const lessonsUrl = lesson.subject
    ? `/courses/${lesson.subject}/lessons`
    : "/courses";

  if (lesson.is_locked) {
    return (
      <div>
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} onClick={() => navigate(lessonsUrl)}>
          ← العودة للدروس
        </button>
        <div className="breadcrumb">
          تأسيس &gt; <span>{lesson.title}</span>
        </div>
        <h1 style={{ fontSize: 28, marginBottom: 16 }}>{lesson.title}</h1>
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <p style={{ marginBottom: 16, lineHeight: 1.9 }}>
            هذا الدرس يتطلب تفعيل الحساب من الإدارة أو الاشتراك.
          </p>
          <Link to="/subscription" className="btn btn-primary">
            الذهاب لصفحة الاشتراك
          </Link>
        </div>
      </div>
    );
  }

  const q = homework[hwIndex];
  const answeredCount = Object.keys(answers).length;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(lessonsUrl)}>
          ← العودة للدروس
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
          الصفحة السابقة
        </button>
      </div>

      <div className="breadcrumb">
        تأسيس &gt; <span>{lesson.title}</span>
      </div>
      <h1 style={{ fontSize: 28, marginBottom: 16 }}>{lesson.title}</h1>

      {freeTier && (
        <div className="banner" style={{ marginBottom: 16 }}>
          معاينة مجانية: أول درس + أول ١٠ أسئلة فقط حتى يتم تفعيل حسابك من الإدارة.
        </div>
      )}

      <div className="filter-row">
        {["video", "pdf", "homework"].map((t) => (
          <span
            key={t}
            className={`chip ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "video" ? "فيديو" : t === "pdf" ? "PDF" : "واجب"}
          </span>
        ))}
      </div>

      {tab === "video" && (
        lesson.bunny_video_id ? (
          <VideoPlayer bunnyId={lesson.bunny_video_id} />
        ) : (
          <div className="card" style={{ padding: 24 }}>
            <p style={{ color: "var(--text-muted)" }}>لا يوجد فيديو لهذا الدرس بعد.</p>
          </div>
        )
      )}

      {tab === "pdf" && (
        <div className="card" style={{ padding: 24 }}>
          {lesson.pdf_url ? (
            <a className="btn btn-primary" href={lesson.pdf_url} target="_blank" rel="noreferrer">
              فتح ملف PDF
            </a>
          ) : (
            <p style={{ color: "var(--text-muted)" }}>لا يوجد ملف PDF لهذا الدرس بعد.</p>
          )}
        </div>
      )}

      {tab === "homework" && (
        <div>
          {freeTier && homework.length > 0 && (
            <p style={{ color: "var(--text-muted)", marginBottom: 12, fontSize: 14 }}>
              تظهر لك أول ١٠ أسئلة فقط في المعاينة المجانية.
            </p>
          )}

          {homework.length === 0 && (
            <p style={{ color: "var(--text-muted)" }}>لا يوجد واجب متاح لمجموعتك.</p>
          )}

          {homework.length > 0 && q && (
            <>
              <div
                className="card"
                style={{
                  padding: 16,
                  marginBottom: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <span>
                  سؤال {hwIndex + 1} من {homework.length}
                </span>
                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  تمت الإجابة على {answeredCount} / {homework.length}
                </span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(lessonsUrl)}>
                  خروج من الواجب
                </button>
              </div>

              <div style={{ height: 6, background: "var(--border)", borderRadius: 4, marginBottom: 16 }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.round(((hwIndex + 1) / homework.length) * 100)}%`,
                    background: "var(--primary)",
                    borderRadius: 4,
                  }}
                />
              </div>

              <div className="grid" style={{ gridTemplateColumns: "1fr 220px", gap: 16 }}>
                <div className="card" style={{ padding: 24 }}>
                  <div style={{ marginBottom: 16, fontSize: 18, lineHeight: 1.8 }}>
                    <strong>سؤال {hwIndex + 1}:</strong> <MathText>{q.text}</MathText>
                  </div>
                  {q.text_image && (
                    <img
                      src={q.text_image}
                      alt=""
                      style={{ display: "block", maxWidth: "100%", marginBottom: 12, borderRadius: 8 }}
                    />
                  )}

                  <div style={{ marginTop: 8 }}>
                    {q.options.map((o) => {
                      const selected = answers[q.id] === o.key;
                      return (
                        <div
                          key={o.key}
                          className={`answer-option${selected ? " selected" : ""}`}
                          onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.key }))}
                          style={{ cursor: "pointer" }}
                        >
                          <span>{o.key})</span> <MathText>{o.text}</MathText>
                          {o.image && (
                            <img
                              src={o.image}
                              alt=""
                              style={{ display: "block", maxWidth: 160, marginTop: 6, borderRadius: 6 }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {(q.explanation || q.explanation_image) && answers[q.id] && (
                    <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                      <strong>الشرح:</strong> <MathText>{q.explanation}</MathText>
                      {q.explanation_image && (
                        <img
                          src={q.explanation_image}
                          alt=""
                          style={{ display: "block", maxWidth: "100%", marginTop: 8, borderRadius: 8 }}
                        />
                      )}
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={hwIndex === 0}
                      onClick={() => setHwIndex((i) => i - 1)}
                    >
                      ← السابق
                    </button>
                    {hwIndex < homework.length - 1 ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setHwIndex((i) => i + 1)}
                      >
                        التالي →
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => navigate(lessonsUrl)}
                      >
                        إنهاء والعودة للدروس
                      </button>
                    )}
                  </div>
                </div>

                <div className="card" style={{ padding: 16, height: "fit-content" }}>
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>خريطة الأسئلة</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {homework.map((item, i) => {
                      let bg = "var(--border)";
                      let color = "inherit";
                      if (i === hwIndex) {
                        bg = "var(--primary)";
                        color = "#fff";
                      } else if (answers[item.id]) {
                        bg = "#dcfce7";
                        color = "#166534";
                      }
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setHwIndex(i)}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            border: "none",
                            cursor: "pointer",
                            background: bg,
                            color,
                            fontWeight: 700,
                          }}
                        >
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
