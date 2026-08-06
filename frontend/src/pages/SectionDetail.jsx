import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import client from "../api/client";
import BackToCourses from "../components/BackToCourses";
import MathText from "../components/MathText";
import TeacherQuestionForm from "../components/TeacherQuestionForm";
import VideoPlayer from "../components/VideoPlayer";
import { useAuth } from "../auth/AuthContext";
import { canEditSubject } from "../auth/teacherScope";

/**
 * عنوان فرعي في التأسيس: الفيديو ظاهر، وأزرار للواجب وPDF.
 */
export default function SectionDetail() {
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [section, setSection] = useState(null);
  const [view, setView] = useState("main"); // main | homework
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

  const canEdit = canEditSubject(user, section?.subject);
  const freeTier = user?.role === "student" && !user?.has_active_subscription;
  const lessonUrl = section?.lesson ? `/lessons/${section.lesson}` : "/courses";

  function loadSection() {
    return client.get(`/lesson-sections/${sectionId}/`).then((res) => {
      setSection(res.data);
      setEditVideo(res.data.bunny_video_id || "");
      setEditPdf(res.data.pdf_url || "");
      setEditTitle(res.data.title || "");
      return res.data;
    });
  }

  function loadHomework(asEditor, sec = section) {
    const sid = sec?.id || sectionId;
    if (asEditor) {
      return client
        .get(`/homework-questions/?section=${sid}`)
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
      .get(`/my-homework/?section=${sid}`)
      .then((res) => setHomework(res.data.results || res.data || []))
      .catch(() => setHomework([]));
  }

  useEffect(() => {
    let cancelled = false;
    setView("main");
    setHwIndex(0);
    setAnswers({});
    setShowAddQ(false);
    setEditingQ(null);
    setMsg("");
    loadSection()
      .then((data) => {
        if (cancelled) return;
        return loadHomework(canEditSubject(user, data.subject), data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sectionId, user]);

  async function saveSectionPatch(patch, okMsg) {
    setBusy(true);
    setMsg("");
    try {
      const { data } = await client.patch(`/lesson-sections/${sectionId}/`, patch);
      setSection(data);
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

  if (!section) return <div className="spinner">جاري التحميل…</div>;

  if (section.is_locked && !canEdit) {
    return (
      <div>
        <BackToCourses subjectId={section.subject} />
        <Link to={lessonUrl} className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }}>
          ← العودة للعناوين الفرعية
        </Link>
        <h1 style={{ fontSize: 28, marginBottom: 16 }}>{section.title}</h1>
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <p style={{ marginBottom: 16 }}>تتطلب هذه الحصة تفعيل الحساب أو الاشتراك.</p>
          <Link to="/subscription" className="btn btn-primary">
            الاشتراك
          </Link>
        </div>
      </div>
    );
  }

  const q = homework[hwIndex];
  const answeredCount = Object.keys(answers).length;

  return (
    <div>
      <BackToCourses subjectId={section.subject} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(lessonUrl)}>
          ← العودة لـ {section.lesson_title || "الدروس"}
        </button>
      </div>

      <div className="breadcrumb">
        تأسيس &gt; {section.lesson_title} &gt; <span>{section.title}</span>
      </div>

      {canEdit ? (
        <div
          className="card"
          style={{
            padding: 16,
            marginBottom: 16,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <input
            className="form-control"
            style={{ flex: 1, minWidth: 180, fontSize: 20, fontWeight: 700 }}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={() => saveSectionPatch({ title: editTitle.trim() }, "تم تعديل الاسم ✓")}
          >
            حفظ الاسم
          </button>
        </div>
      ) : (
        <h1 style={{ fontSize: 28, marginBottom: 16 }}>{section.title}</h1>
      )}

      {msg && (
        <div className="banner" style={{ marginBottom: 12 }}>
          {msg}
        </div>
      )}

      {view === "main" && (
        <>
          {/* Video always visible on the section page */}
          <div style={{ marginBottom: 16 }}>
            {section.bunny_video_id ? (
              <VideoPlayer bunnyId={section.bunny_video_id} />
            ) : (
              <div className="card" style={{ padding: 24 }}>
                <p style={{ color: "var(--text-muted)" }}>لا يوجد فيديو لهذه الحصة بعد.</p>
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
                    style={{ flex: 1, minWidth: 200 }}
                    value={editVideo}
                    onChange={(e) => setEditVideo(e.target.value)}
                    placeholder="GUID من Bunny Stream"
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() =>
                      saveSectionPatch(
                        { bunny_video_id: editVideo.trim() },
                        "تم حفظ الفيديو ✓",
                      )
                    }
                  >
                    حفظ الفيديو
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setView("homework");
                setHwIndex(0);
              }}
            >
              الواجب
            </button>
            {section.pdf_url ? (
              <a
                className="btn btn-secondary"
                href={section.pdf_url}
                target="_blank"
                rel="noreferrer"
              >
                فتح PDF
              </a>
            ) : canEdit ? (
              <span className="btn btn-ghost" style={{ pointerEvents: "none", opacity: 0.7 }}>
                لا يوجد PDF بعد
              </span>
            ) : null}
          </div>

          {canEdit && (
            <div className="card" style={{ padding: 16 }}>
              <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>رابط PDF</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  className="form-control"
                  style={{ flex: 1, minWidth: 200 }}
                  value={editPdf}
                  onChange={(e) => setEditPdf(e.target.value)}
                  placeholder="https://…"
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() =>
                    saveSectionPatch({ pdf_url: editPdf.trim() }, "تم حفظ PDF ✓")
                  }
                >
                  حفظ PDF
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {view === "homework" && (
        <div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginBottom: 12 }}
            onClick={() => setView("main")}
          >
            ← العودة للفيديو
          </button>

          {freeTier && (
            <div className="banner" style={{ marginBottom: 12 }}>
              معاينة مجانية: أول ١٠ أسئلة فقط حتى يتم تفعيل حسابك.
            </div>
          )}

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
                عدد الأسئلة: {teacherQs.length}
              </span>
            </div>
          )}

          {canEdit && (showAddQ || editingQ) && (
            <TeacherQuestionForm
              subjectId={section.subject}
              lessonId={section.lesson}
              sectionId={section.id}
              kind="homework"
              initialQuestion={editingQ}
              onCancel={() => {
                setEditingQ(null);
                setShowAddQ(false);
              }}
              onSaved={() => {
                loadHomework(true);
                setShowAddQ(false);
                setEditingQ(null);
                setMsg(editingQ ? "تم تعديل السؤال ✓" : "تم إضافة السؤال ✓");
              }}
            />
          )}

          {canEdit && teacherQs.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {teacherQs.map((item, i) => (
                <div key={item.id} className="card" style={{ padding: 12, marginTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ flex: 1 }}>
                      <strong>س{i + 1}:</strong> <MathText>{item.text}</MathText>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setShowAddQ(false);
                          setEditingQ(item);
                        }}
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => deleteQuestion(item.id)}
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!canEdit && homework.length === 0 && (
            <p style={{ color: "var(--text-muted)" }}>لا يوجد واجب متاح لمجموعتك.</p>
          )}

          {!canEdit && homework.length > 0 && q && (
            <div className="card" style={{ padding: 24 }}>
              <div style={{ marginBottom: 8, color: "var(--text-muted)", fontSize: 13 }}>
                سؤال {hwIndex + 1} من {homework.length}
                {answeredCount > 0 ? ` · أجبت ${answeredCount}` : ""}
              </div>
              <h3 style={{ marginBottom: 16, lineHeight: 1.8 }}>
                <MathText>{q.text}</MathText>
              </h3>
              {q.text_image && (
                <img
                  src={q.text_image}
                  alt=""
                  style={{ maxWidth: "100%", marginBottom: 12, borderRadius: 8 }}
                />
              )}
              {(q.options || []).map((o) => {
                const selected = answers[q.id] === o.key;
                return (
                  <div
                    key={o.key}
                    className={`answer-option ${selected ? "selected" : ""}`}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.key }))}
                  >
                    <span>{o.key})</span> <MathText>{o.text}</MathText>
                  </div>
                );
              })}
              {answers[q.id] && (q.explanation || q.explanation_image) && (
                <div style={{ marginTop: 12 }}>
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
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
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
                  <span style={{ color: "var(--text-muted)", alignSelf: "center" }}>آخر سؤال</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
