import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { canEditSubject } from "../auth/teacherScope";
import client from "../api/client";
import BackToCourses from "../components/BackToCourses";
import MathText from "../components/MathText";
import TeacherQuestionForm from "../components/TeacherQuestionForm";
import VideoPlayer from "../components/VideoPlayer";

const LEVELS = [
  { id: "easy", label: "سهل" },
  { id: "medium", label: "متوسط" },
  { id: "hard", label: "صعب" },
];

/**
 * داخل درس التجميع: فيديو الدرس + أسئلة (نص/صور/فيديو/مستوى).
 * للطالب: اختيار المستوى وبدء اختبار من بنك كل المدرسين.
 */
export default function CollectionLessonDetail() {
  const { subjectId, lessonId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lesson, setLesson] = useState(null);
  const [tab, setTab] = useState("questions");
  const [filterLevel, setFilterLevel] = useState("all");
  const [qList, setQList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingQ, setEditingQ] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editVideo, setEditVideo] = useState("");
  const [editPdf, setEditPdf] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [startBusy, setStartBusy] = useState(false);
  const [selectedLevels, setSelectedLevels] = useState(["medium"]);
  const [questionCount, setQuestionCount] = useState(10);

  const canEdit = canEditSubject(user, subjectId || lesson?.subject);
  const listUrl = `/courses/${subjectId || lesson?.subject}/collections`;

  function loadLesson() {
    return client.get(`/lessons/${lessonId}/`).then((res) => {
      setLesson(res.data);
      setEditTitle(res.data.title || "");
      setEditVideo(res.data.bunny_video_id || "");
      setEditPdf(res.data.pdf_url || "");
      return res.data;
    });
  }

  useEffect(() => {
    let cancelled = false;
    setShowForm(false);
    setEditingQ(null);
    setMsg("");
    loadLesson()
      .then((data) => {
        if (cancelled) return;
        if (canEditSubject(user, subjectId || data.subject)) {
          return loadQuestions();
        }
        setQList([]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lessonId, user, subjectId]);

  function loadQuestions() {
    return client
      .get(`/collection-questions/?lesson=${lessonId}`)
      .then((res) => setQList(res.data.results || res.data || []))
      .catch(() => setQList([]));
  }

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
      await client.delete(`/collection-questions/${id}/`);
      setMsg("تم حذف السؤال");
      loadQuestions();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر الحذف");
    }
  }

  function toggleLevel(id) {
    setSelectedLevels((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }

  async function startExam() {
    setMsg("");
    if (selectedLevels.length === 0) {
      setMsg("اختر مستوى واحداً على الأقل");
      return;
    }
    setStartBusy(true);
    try {
      const { data } = await client.post("/exams/simulator/", {
        subject: Number(subjectId || lesson.subject),
        lessons: [Number(lessonId)],
        count: questionCount,
        levels: selectedLevels,
      });
      navigate(`/exam/${data.exam.id}`);
    } catch (e) {
      setMsg(e.response?.data?.detail || "لا توجد أسئلة كافية بهذه الإعدادات");
      setStartBusy(false);
    }
  }

  if (!lesson) return <div className="spinner">جاري التحميل…</div>;

  if (lesson.is_locked && !canEdit) {
    return (
      <div>
        <BackToCourses subjectId={lesson.subject} />
        <Link to={listUrl} className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }}>
          ← العودة لدروس التجميع
        </Link>
        <h1 style={{ fontSize: 28, marginBottom: 16 }}>{lesson.title}</h1>
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <p style={{ marginBottom: 16 }}>هذا الدرس يتطلب تفعيل الحساب أو الاشتراك.</p>
          <Link to="/subscription" className="btn btn-primary">
            الاشتراك
          </Link>
        </div>
      </div>
    );
  }

  const visibleQs =
    filterLevel === "all" ? qList : qList.filter((q) => q.difficulty === filterLevel);

  const levelLabel = (d) => LEVELS.find((x) => x.id === d)?.label || d;

  return (
    <div>
      <BackToCourses subjectId={lesson.subject} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <Link to={listUrl} className="btn btn-ghost btn-sm">
          ← العودة لدروس التجميع
        </Link>
      </div>

      <div className="breadcrumb">
        تجميع &gt; <span>{lesson.title}</span>
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
            style={{ flex: 1, minWidth: 200, fontSize: 20, fontWeight: 700 }}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={() => saveLessonPatch({ title: editTitle.trim() }, "تم تعديل الاسم ✓")}
          >
            حفظ الاسم
          </button>
        </div>
      ) : (
        <h1 style={{ fontSize: 28, marginBottom: 16 }}>{lesson.title}</h1>
      )}

      {canEdit && (
        <div className="banner" style={{ marginBottom: 16 }}>
          أسئلة هذا الدرس تظهر لكل طلاب المادة — وليست لمجموعتك فقط (عكس تأسيس).
        </div>
      )}

      {msg && (
        <div className="banner" style={{ marginBottom: 12 }}>
          {msg}
        </div>
      )}

      <div className="filter-row" style={{ marginBottom: 16 }}>
        <span
          className={`chip ${tab === "questions" ? "active" : ""}`}
          onClick={() => setTab("questions")}
          role="button"
          tabIndex={0}
        >
          الأسئلة
        </span>
        <span
          className={`chip ${tab === "video" ? "active" : ""}`}
          onClick={() => setTab("video")}
          role="button"
          tabIndex={0}
        >
          فيديو الدرس
        </span>
        <span
          className={`chip ${tab === "pdf" ? "active" : ""}`}
          onClick={() => setTab("pdf")}
          role="button"
          tabIndex={0}
        >
          ملف PDF
        </span>
      </div>

      {tab === "video" && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          {canEdit && (
            <div className="form-group">
              <label>Bunny Video ID</label>
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
          {lesson.bunny_video_id ? (
            <VideoPlayer bunnyId={lesson.bunny_video_id} />
          ) : (
            <p style={{ color: "var(--text-muted)" }}>لا يوجد فيديو لهذا الدرس بعد.</p>
          )}
        </div>
      )}

      {tab === "pdf" && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          {canEdit && (
            <div className="form-group">
              <label>رابط PDF</label>
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
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => saveLessonPatch({ pdf_url: editPdf.trim() }, "تم حفظ الملف ✓")}
                >
                  حفظ الرابط
                </button>
              </div>
            </div>
          )}
          {lesson.pdf_url ? (
            <a href={lesson.pdf_url} target="_blank" rel="noreferrer" className="btn btn-secondary">
              فتح ملف PDF
            </a>
          ) : (
            <p style={{ color: "var(--text-muted)" }}>لا يوجد ملف بعد.</p>
          )}
        </div>
      )}

      {tab === "questions" && (
        <>
          <div className="card" style={{ padding: 16, marginBottom: 20 }}>
            <div className="section-title" style={{ marginTop: 0 }}>
              ابدأ بالتدريب
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 12 }}>
              اختر مستوى أو أكثر (سهل / متوسط / صعب) ثم عدد الأسئلة.
            </p>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>المستوى</label>
              <div className="filter-row">
                {LEVELS.map((lv) => (
                  <span
                    key={lv.id}
                    className={`chip ${selectedLevels.includes(lv.id) ? "active" : ""}`}
                    onClick={() => toggleLevel(lv.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleLevel(lv.id);
                      }
                    }}
                  >
                    {lv.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>عدد الأسئلة</label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setQuestionCount((c) => Math.max(1, c - 1))}
                >
                  −
                </button>
                <div className="form-control" style={{ width: 80, textAlign: "center" }}>
                  {questionCount}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setQuestionCount((c) => Math.min(50, c + 1))}
                >
                  +
                </button>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={startBusy || selectedLevels.length === 0}
              onClick={startExam}
            >
              {startBusy ? "جاري البدء…" : "ابدأ الاختبار"}
            </button>
          </div>

          {canEdit && (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 12,
                }}
              >
                <div className="section-title" style={{ margin: 0 }}>
                  إدارة أسئلة التجميع (للجميع)
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setEditingQ(null);
                    setShowForm((v) => !v);
                  }}
                >
                  {showForm && !editingQ ? "إخفاء النموذج" : "+ إضافة سؤال"}
                </button>
              </div>

              <div className="filter-row" style={{ marginBottom: 12 }}>
                <span
                  className={`chip ${filterLevel === "all" ? "active" : ""}`}
                  onClick={() => setFilterLevel("all")}
                  role="button"
                  tabIndex={0}
                >
                  الكل ({qList.length})
                </span>
                {LEVELS.map((lv) => (
                  <span
                    key={lv.id}
                    className={`chip ${filterLevel === lv.id ? "active" : ""}`}
                    onClick={() => setFilterLevel(lv.id)}
                    role="button"
                    tabIndex={0}
                  >
                    {lv.label} ({qList.filter((q) => q.difficulty === lv.id).length})
                  </span>
                ))}
              </div>

              {(showForm || editingQ) && (
                <TeacherQuestionForm
                  subjectId={lesson.subject}
                  lessonId={lesson.id}
                  kind="collection"
                  defaultDifficulty={
                    filterLevel !== "all" ? filterLevel : editingQ?.difficulty || "medium"
                  }
                  initialQuestion={editingQ}
                  onCancel={() => {
                    setEditingQ(null);
                    setShowForm(false);
                  }}
                  onSaved={() => {
                    loadQuestions();
                    setShowForm(false);
                    setEditingQ(null);
                    setMsg(editingQ ? "تم تعديل السؤال ✓" : "تم إضافة السؤال ✓");
                  }}
                />
              )}

              {visibleQs.map((item, i) => (
                <div key={item.id} className="card" style={{ padding: 14, marginTop: 8 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <strong>
                        س{i + 1} · {levelLabel(item.difficulty)}
                        {item.question_year ? ` · ${item.question_year}` : ""}:
                      </strong>{" "}
                      <MathText>{item.text}</MathText>
                      {item.text_image && (
                        <img
                          src={item.text_image}
                          alt=""
                          style={{ display: "block", maxWidth: "100%", marginTop: 8, borderRadius: 8 }}
                        />
                      )}
                      <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
                        الإجابة: {item.correct_answer}
                        {(item.explanation || item.written_correction) && (
                          <>
                            {" · "}
                            شرح: <MathText>{item.explanation || item.written_correction}</MathText>
                          </>
                        )}
                        {item.video_bunny_id && (
                          <>
                            {" · "}
                            فيديو ({item.video_timing === "before" ? "قبل" : "بعد"})
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setShowForm(false);
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

              {visibleQs.length === 0 && !showForm && !editingQ && (
                <p style={{ color: "var(--text-muted)" }}>لا توجد أسئلة بعد — أضف سؤالاً أعلاه.</p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
