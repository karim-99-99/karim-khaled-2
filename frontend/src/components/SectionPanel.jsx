import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import MathText from "./MathText";
import TeacherQuestionForm from "./TeacherQuestionForm";
import VideoPlayer from "./VideoPlayer";
import { useAuth } from "../auth/AuthContext";
import { canEditSubject } from "../auth/teacherScope";

/**
 * Inline panel under a lesson subsection: video / homework / PDF.
 */
export default function SectionPanel({ sectionId, onUpdated }) {
  const { user } = useAuth();
  const [section, setSection] = useState(null);
  const [tab, setTab] = useState("video"); // video | homework | pdf
  const [homework, setHomework] = useState([]);
  const [teacherQs, setTeacherQs] = useState([]);
  const [hwIndex, setHwIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showAddQ, setShowAddQ] = useState(false);
  const [editingQ, setEditingQ] = useState(null);
  const [editVideo, setEditVideo] = useState("");
  const [editPdf, setEditPdf] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const canEdit = canEditSubject(user, section?.subject);
  const freeTier = user?.role === "student" && !user?.has_active_subscription;

  function loadSection() {
    return client.get(`/lesson-sections/${sectionId}/`).then((res) => {
      setSection(res.data);
      setEditVideo(res.data.bunny_video_id || "");
      setEditPdf(res.data.pdf_url || "");
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
    setTab("video");
    setHwIndex(0);
    setAnswers({});
    setShowAddQ(false);
    setEditingQ(null);
    setMsg("");
    setSection(null);
    loadSection()
      .then((data) => {
        if (cancelled) return null;
        return loadHomework(canEditSubject(user, data.subject), data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, user]);

  async function saveSectionPatch(patch, okMsg) {
    setBusy(true);
    setMsg("");
    try {
      const { data } = await client.patch(`/lesson-sections/${sectionId}/`, patch);
      setSection(data);
      setMsg(okMsg || "تم الحفظ ✓");
      onUpdated?.(data);
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

  if (!section) {
    return <div className="spinner" style={{ padding: 20 }}>جاري التحميل…</div>;
  }

  if (section.is_locked && !canEdit) {
    return (
      <div style={{ padding: 16, textAlign: "center" }}>
        <p style={{ marginBottom: 12 }}>تتطلب هذه الحصة تفعيل الحساب أو الاشتراك.</p>
        <Link to="/subscription" className="btn btn-primary btn-sm">
          الاشتراك
        </Link>
      </div>
    );
  }

  const q = homework[hwIndex];
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="section-panel">
      <div className="filter-row" style={{ marginBottom: 14 }}>
        {[
          ["video", canEdit ? "إضافة / فيديو" : "فيديو"],
          ["homework", canEdit ? "إضافة أسئلة" : "الواجب"],
          ["pdf", canEdit ? "إضافة PDF" : "PDF"],
        ].map(([id, label]) => (
          <span
            key={id}
            className={`chip ${tab === id ? "active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </span>
        ))}
      </div>

      {msg && (
        <div className="banner" style={{ marginBottom: 12 }}>
          {msg}
        </div>
      )}

      {tab === "video" && (
        <div>
          {section.bunny_video_id ? (
            <VideoPlayer bunnyId={section.bunny_video_id} />
          ) : (
            <p style={{ color: "var(--text-muted)", marginBottom: canEdit ? 12 : 0 }}>
              لا يوجد فيديو لهذه الحصة بعد.
            </p>
          )}
          {canEdit && (
            <div style={{ marginTop: 12 }}>
              <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>
                Bunny Video ID
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  className="form-control"
                  style={{ flex: 1, minWidth: 180 }}
                  value={editVideo}
                  onChange={(e) => setEditVideo(e.target.value)}
                  placeholder="GUID من Bunny Stream"
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busy}
                  onClick={() =>
                    saveSectionPatch({ bunny_video_id: editVideo.trim() }, "تم حفظ الفيديو ✓")
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
        <div>
          {section.pdf_url ? (
            <a
              className="btn btn-secondary"
              href={section.pdf_url}
              target="_blank"
              rel="noreferrer"
              style={{ marginBottom: canEdit ? 12 : 0 }}
            >
              فتح PDF
            </a>
          ) : (
            <p style={{ color: "var(--text-muted)", marginBottom: canEdit ? 12 : 0 }}>
              لا يوجد PDF لهذه الحصة بعد.
            </p>
          )}
          {canEdit && (
            <div>
              <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>رابط PDF</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  className="form-control"
                  style={{ flex: 1, minWidth: 180 }}
                  value={editPdf}
                  onChange={(e) => setEditPdf(e.target.value)}
                  placeholder="https://…"
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busy}
                  onClick={() => saveSectionPatch({ pdf_url: editPdf.trim() }, "تم حفظ PDF ✓")}
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
          {freeTier && (
            <div className="banner" style={{ marginBottom: 12 }}>
              معاينة مجانية: أول ١٠ أسئلة فقط حتى يتم تفعيل حسابك.
            </div>
          )}

          {canEdit && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setEditingQ(null);
                  setShowAddQ((v) => !v);
                }}
              >
                {showAddQ && !editingQ ? "إخفاء النموذج" : "+ إضافة سؤال واجب"}
              </button>
              <span style={{ color: "var(--text-muted)", alignSelf: "center", fontSize: 13 }}>
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
            <div style={{ marginBottom: 8 }}>
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
            <div>
              <div style={{ marginBottom: 8, color: "var(--text-muted)", fontSize: 13 }}>
                سؤال {hwIndex + 1} من {homework.length}
                {answeredCount > 0 ? ` · أجبت ${answeredCount}` : ""}
              </div>
              <h3 style={{ marginBottom: 16, lineHeight: 1.8, fontSize: 16 }}>
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
                    <span className="answer-option__key">{o.key}</span>
                    <div className="answer-option__body">
                      <MathText>{o.text}</MathText>
                    </div>
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
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={hwIndex === 0}
                  onClick={() => setHwIndex((i) => i - 1)}
                >
                  ← السابق
                </button>
                {hwIndex < homework.length - 1 ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setHwIndex((i) => i + 1)}
                  >
                    التالي →
                  </button>
                ) : (
                  <span style={{ color: "var(--text-muted)", alignSelf: "center", fontSize: 13 }}>
                    آخر سؤال
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
