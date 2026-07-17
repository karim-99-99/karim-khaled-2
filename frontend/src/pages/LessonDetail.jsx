import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import client from "../api/client";
import VideoPlayer from "../components/VideoPlayer";
import MathText from "../components/MathText";
import { useAuth } from "../auth/AuthContext";

export default function LessonDetail() {
  const { lessonId } = useParams();
  const { user } = useAuth();
  const [lesson, setLesson] = useState(null);
  const [tab, setTab] = useState("video");
  const [homework, setHomework] = useState([]);
  const freeTier = user?.role === "student" && !user?.has_active_subscription;

  useEffect(() => {
    client.get(`/lessons/${lessonId}/`).then((res) => setLesson(res.data));
    client
      .get(`/my-homework/?lesson=${lessonId}`)
      .then((res) => setHomework(res.data.results || res.data))
      .catch(() => setHomework([]));
  }, [lessonId]);

  if (!lesson) return <div className="spinner">جاري التحميل…</div>;

  if (lesson.is_locked) {
    return (
      <div>
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

  return (
    <div>
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
          <span key={t} className={`chip ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
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
          {homework.map((q, i) => (
            <div key={q.id} className="card" style={{ padding: 20, marginBottom: 12 }}>
              <strong>سؤال {i + 1}:</strong> <MathText>{q.text}</MathText>
              <div style={{ marginTop: 12 }}>
                {q.options.map((o) => (
                  <div key={o.key} className="answer-option">
                    <span>{o.key})</span> <MathText>{o.text}</MathText>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
