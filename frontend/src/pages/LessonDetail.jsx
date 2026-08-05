import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import client from "../api/client";
import BackToCourses from "../components/BackToCourses";
import MathText from "../components/MathText";
import TeacherQuestionForm from "../components/TeacherQuestionForm";
import VideoPlayer from "../components/VideoPlayer";
import { useAuth } from "../auth/AuthContext";
import { canEditSubject } from "../auth/teacherScope";

export default function LessonDetail() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lesson, setLesson] = useState(null);
  const [tab, setTab] = useState("video");
  const [homework, setHomework] = useState([]);
  const [teacherQs, setTeacherQs] = useState([]);
  const [hwIndex, setHwIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showAddQ, setShowAddQ] = useState(false);
  const [editingQ, setEditingQ] = useState(null);
  const [editVideo, setEditVideo] = useState("");
  const [editPdf, setEditPdf] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const canEdit = canEditSubject(user, lesson?.subject);
  const freeTier = user?.role === "student" && !user?.has_active_subscription;

  function loadLesson() {
    return client.get(`/lessons/${lessonId}/`).then((res) => {
      setLesson(res.data);
      setEditVideo(res.data.bunny_video_id || "");
      setEditPdf(res.data.pdf_url || "");
      setEditTitle(res.data.title || "");
      return res.data;
    });
  }

  function loadHomework(asEditor) {
    if (asEditor) {
      return client
        .get(`/homework-questions/?lesson=${lessonId}`)
        .then((res) => {
          const rows = res.data.results || res.data || [];
          setTeacherQs(rows);
          setHomework(rows);
        })
        .catch(() => {
          setTeacherQs([]);
          setHomework([]);
        });
    }
    return client
      .get(`/my-homework/?lesson=${lessonId}`)
      .then((res) => setHomework(res.data.results || res.data || []))
      .catch(() => setHomework([]));
  }

  useEffect(() => {
    let cancelled = false;
    setHwIndex(0);
    setAnswers({});
    setShowAddQ(false);
    setEditingQ(null);
    setMsg("");
    loadLesson()
      .then((data) => {
        if (cancelled) return;
        const editor = canEditSubject(user, data.subject);
        return loadHomework(editor);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lessonId, user]);

  async function saveLessonPatch(patch, okMsg) {
    setBusy(true);
    setMsg("");
    try {
      const { data } = await client.patch(`/lessons/${lessonId}/`, patch);
      setLesson(data);
      setMsg(okMsg || "تم الحفظ ✓");
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  async function deleteQuestion(id) {
    if (!confirm("حذف هذا السؤال؟")) return;
    try {
      await client.delete(`/homework-questions/${id}/`);
      setMsg("تم حذف السؤال");
      loadHomework(canEdit);
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر الحذف");
    }
  }

  if (!lesson) return <div className="spinner">جاري التحميل…</div>;

  const lessonsUrl = lesson.subject ? `/courses/${lesson.subject}/lessons` : "/courses";

  if (lesson.is_locked && !canEdit) {
    return (
      <div>
        <BackToCourses subjectId={lesson.subject} />
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
      <BackToCourses subjectId={lesson.subject} />
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

      {canEdit ? (
        <div className="card" style={{ padding: 16, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="form-control"
            style={{ flex: 1, minWidth: 200, fontSize: 20, fontWeight: 700 }}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={() => saveLessonPatch({ title: editTitle.trim() }, "تم تعديل العنوان ✓")}
          >
            حفظ الاسم
          </button>
        </div>
      ) : (
        <h1 style={{ fontSize: 28, marginBottom: 16 }}>{lesson.title}</h1>
      )}

      {canEdit && (
        <div className="banner" style={{ marginBottom: 16 }}>
          وضع المدرس: عدّل الفيديو وملف PDF وأضف أسئلة الواجب من التبويبات أدناه.
        </div>
      )}

      {msg && <div className="banner" style={{ marginBottom: 12 }}>{msg}</div>}

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
        <div>
          {lesson.bunny_video_id ? (
            <VideoPlayer bunnyId={lesson.bunny_video_id} />
          ) : (
            <div className="card" style={{ padding: 24 }}>
              <p style={{ color: "var(--text-muted)" }}>لا يوجد فيديو لهذا الدرس بعد.</p>
            </div>
          )}
          {canEdit && (
            <div className="card" style={{ padding: 16, marginTop: 12 }}>
              <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>
                Bunny Video ID
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  className="form-control"
                  style={{ flex: 1, minWidth: 220 }}
                  value={editVideo}
                  onChange={(e) => setEditVideo(e.target.value)}
                  placeholder="الصق GUID الفيديو من Bunny Stream"
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() =>
                    saveLessonPatch({ bunny_video_id: editVideo.trim() }, "تم حفظ الفيديو ✓")
                  }
                >
                  حفظ الفيديو
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "pdf" && (
        <div className="card" style={{ padding: 24 }}>
          {lesson.pdf_url ? (
            <a className="btn btn-primary" href={lesson.pdf_url} target="_blank" rel="noreferrer">
              فتح ملف PDF
            </a>
          ) : (
            <p style={{ color: "var(--text-muted)", marginBottom: canEdit ? 12 : 0 }}>
              لا يوجد ملف PDF لهذا الدرس بعد.
            </p>
          )}
          {canEdit && (
            <div style={{ marginTop: 16 }}>
              <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>رابط PDF</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  className="form-control"
                  style={{ flex: 1, minWidth: 220 }}
                  value={editPdf}
                  onChange={(e) => setEditPdf(e.target.value)}
                  placeholder="https://..."
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => saveLessonPatch({ pdf_url: editPdf.trim() }, "تم حفظ PDF ✓")}
                >
                  حفظ PDF
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "homework" && (
        <div>
          {canEdit && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setEditingQ(null);
                  setShowAddQ((v) => !v);
                }}
              >
                {showAddQ && !editingQ ? "إخفاء النموذج" : "+ إضافة سؤال واجب"}
              </button>
              <span style={{ color: "var(--text-muted)", alignSelf: "center", fontSize: 14 }}>
                أسئلتك في هذا الدرس: {teacherQs.length}
              </span>
            </div>
          )}

          {canEdit && (showAddQ || editingQ) && (
            <TeacherQuestionForm
              subjectId={lesson.subject}
              lessonId={lesson.id}
              kind="homework"
              initialQuestion={editingQ}
              onCancel={() => {
                setEditingQ(null);
                setShowAddQ(false);
              }}
              onSaved={() => {
                loadHomework(canEdit);
                setShowAddQ(false);
                setEditingQ(null);
                setMsg(editingQ ? "تم تعديل السؤال ✓" : "تم إضافة السؤال ✓");
              }}
            />
          )}

          {canEdit && teacherQs.length > 0 && (
            <div style={{ marginTop: 16, marginBottom: 20 }}>
              <div className="section-title">أسئلة الواجب (تحرير)</div>
              {teacherQs.map((item, i) => (
                <div key={item.id} className="card" style={{ padding: 14, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ flex: 1 }}>
                      <strong>س{i + 1}:</strong> <MathText>{item.text}</MathText>
                      <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
                        الإجابة الصحيحة: {item.correct_answer}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setShowAddQ(false);
                          setEditingQ(item);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        تعديل
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => deleteQuestion(item.id)}>
                        حذف
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {freeTier && homework.length > 0 && !canEdit && (
            <p style={{ color: "var(--text-muted)", marginBottom: 12, fontSize: 14 }}>
              تظهر لك أول ١٠ أسئلة فقط في المعاينة المجانية.
            </p>
          )}

          {homework.length === 0 && (
            <p style={{ color: "var(--text-muted)" }}>
              {canEdit ? "لا توجد أسئلة واجب بعد — أضف سؤالاً أعلاه." : "لا يوجد واجب متاح لمجموعتك."}
            </p>
          )}

          {homework.length > 0 && q && !canEdit && (
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
