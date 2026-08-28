import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { canEditSubject } from "../auth/teacherScope";
import client from "../api/client";
import BackToCourses from "../components/BackToCourses";
import MathText from "../components/MathText";
import QuestionImportPanel from "../components/QuestionImportPanel";
import TeacherQuestionForm from "../components/TeacherQuestionForm";
import VideoPlayer from "../components/VideoPlayer";

const LEVELS = [
  { id: "easy", label: "سهل" },
  { id: "medium", label: "متوسط" },
  { id: "hard", label: "صعب" },
];

/**
 * داخل درس التجميع: للطالب اختيار المستويات + السنة وبدء الاختبار بكل الأسئلة المطابقة.
 * نسب المزج (سهل/متقدم/تحدي) خاصة بالمحاكي الشخصي فقط.
 * للمدرس: فيديو / PDF / إدارة بنك الأسئلة.
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
  const [selectedLevels, setSelectedLevels] = useState([]);
  const [years, setYears] = useState([]);
  const [yearStats, setYearStats] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const [reviewMode, setReviewMode] = useState("immediate");
  const [showImport, setShowImport] = useState(false);

  const canEdit = canEditSubject(user, subjectId || lesson?.subject);
  const canRenameLesson =
    canEdit && (user?.role === "teacher" || user?.role === "admin");
  const listUrl = `/courses/${subjectId || lesson?.subject}/collections`;
  const levelCounts = lesson?.collection_difficulty_counts || {
    easy: 0,
    medium: 0,
    hard: 0,
  };
  const bankTotal =
    (Number(levelCounts.easy) || 0) +
    (Number(levelCounts.medium) || 0) +
    (Number(levelCounts.hard) || 0);

  const filteredLevelCounts = useMemo(() => {
    if (!selectedYears.length) {
      return {
        easy: Number(levelCounts.easy) || 0,
        medium: Number(levelCounts.medium) || 0,
        hard: Number(levelCounts.hard) || 0,
      };
    }
    const out = { easy: 0, medium: 0, hard: 0 };
    for (const row of yearStats) {
      if (!selectedYears.includes(row.year)) continue;
      out.easy += Number(row.easy) || 0;
      out.medium += Number(row.medium) || 0;
      out.hard += Number(row.hard) || 0;
    }
    return out;
  }, [selectedYears, yearStats, levelCounts.easy, levelCounts.medium, levelCounts.hard]);

  const selectedCount = useMemo(() => {
    if (!selectedLevels.length) return 0;
    return selectedLevels.reduce(
      (sum, lv) => sum + (Number(filteredLevelCounts[lv]) || 0),
      0
    );
  }, [selectedLevels, filteredLevelCounts]);

  function toggleLevel(id) {
    setSelectedLevels((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleYear(y) {
    setSelectedYears((prev) =>
      prev.includes(y) ? prev.filter((x) => x !== y) : [...prev, y]
    );
  }

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
    setSelectedLevels([]);
    setSelectedYears([]);
    setShowImport(false);
    loadLesson()
      .then((data) => {
        if (cancelled) return;
        const sid = subjectId || data.subject;
        const params = new URLSearchParams();
        params.append("subjects", String(sid));
        params.append("lessons", String(lessonId));
        return client
          .get(`/exams/simulator/options/?${params.toString()}`)
          .then((res) => {
            if (cancelled) return;
            setYears(res.data.years || []);
            setYearStats(res.data.year_stats || []);
          })
          .catch(() => {
            if (!cancelled) {
              setYears([]);
              setYearStats([]);
            }
          })
          .then(() => {
            if (cancelled) return;
            if (canEditSubject(user, sid)) {
              return loadQuestions();
            }
            setQList([]);
          });
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

  async function approveQuestion(id) {
    try {
      await client.patch(`/collection-questions/${id}/`, {
        needs_review: false,
        review_notes: "",
      });
      setMsg("تم اعتماد السؤال — أصبح ظاهراً للطلاب ✓");
      loadQuestions();
      loadLesson();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر الاعتماد");
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

  async function startExam() {
    setMsg("");
    if (!selectedLevels.length) {
      setMsg("اختر مستوى صعوبة واحداً على الأقل");
      return;
    }
    if (selectedCount < 1) {
      setMsg("لا توجد أسئلة بالمستويات/السنوات المختارة");
      return;
    }
    setStartBusy(true);
    try {
      const payload = {
        subjects: [Number(subjectId || lesson.subject)],
        subject: Number(subjectId || lesson.subject),
        lessons: [Number(lessonId)],
        levels: selectedLevels,
        take_all: true,
        review_mode: reviewMode,
        time_limit_minutes: null,
        title: `تجميعات ${lesson.subject_name || ""} ( ${lesson.title || ""} )`
          .replace(/\s+/g, " ")
          .trim(),
      };
      if (selectedYears.length) {
        payload.years = selectedYears;
      }
      const { data } = await client.post("/exams/simulator/", payload);
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

  const reviewCount = qList.filter((q) => q.needs_review).length;
  const visibleQs =
    filterLevel === "all"
      ? qList
      : filterLevel === "review"
        ? qList.filter((q) => q.needs_review)
        : qList.filter((q) => q.difficulty === filterLevel);

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

      {canRenameLesson ? (
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

      {canEdit && (
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
      )}

      {canEdit && tab === "video" && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div className="form-group">
            <label>فيديو الدرس — Bunny أو رابط (YouTube / Drive / أي رابط)</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                className="form-control"
                style={{ flex: 1, minWidth: 180 }}
                value={editVideo}
                onChange={(e) => setEditVideo(e.target.value)}
                placeholder="Bunny GUID أو https://youtube.com/... أو Drive"
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
          {lesson.bunny_video_id ? (
            <VideoPlayer bunnyId={lesson.bunny_video_id} />
          ) : (
            <p style={{ color: "var(--text-muted)" }}>لا يوجد فيديو لهذا الدرس بعد.</p>
          )}
        </div>
      )}

      {canEdit && tab === "pdf" && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
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
          {lesson.pdf_url ? (
            <a href={lesson.pdf_url} target="_blank" rel="noreferrer" className="btn btn-secondary">
              فتح ملف PDF
            </a>
          ) : (
            <p style={{ color: "var(--text-muted)" }}>لا يوجد ملف بعد.</p>
          )}
        </div>
      )}

      {(!canEdit || tab === "questions") && (
        <>
          <div className="card" style={{ padding: 16, marginBottom: 20 }}>
            <div className="section-title" style={{ marginTop: 0 }}>
              ابدأ بالتدريب
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 12 }}>
              اختر المستويات وسنة الاختبار (اختياري) — يظهر لك كل الأسئلة المطابقة في هذا الدرس.
              نسب المزج موجودة في المحاكي الشخصي فقط.
            </p>
            <div style={{ marginBottom: 16 }}>
              <Link
                to={`/tests/simulator/${subjectId || lesson.subject}?lesson=${lessonId}&from=collections`}
                className="btn btn-secondary"
              >
                المحاكي الشخصي (نسب صعوبة · عدة مواد · زمن) ←
              </Link>
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>مستوى الصعوبة — يمكن اختيار أكثر من مستوى</label>
              <div className="filter-row" style={{ marginBottom: 8 }}>
                {LEVELS.map((lv) => (
                  <span
                    key={lv.id}
                    className={`chip ${selectedLevels.includes(lv.id) ? "active" : ""}`}
                    onClick={() => toggleLevel(lv.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") toggleLevel(lv.id);
                    }}
                  >
                    {lv.label} ({filteredLevelCounts[lv.id] || 0})
                  </span>
                ))}
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
                مثال: سهل فقط = كل الأسئلة السهلة · سهل + صعب = كل السهل وكل الصعب
              </p>
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>سنة / تاريخ الاختبار — اختياري (واحد أو أكثر، أو بدون فلتر)</label>
              <div className="filter-row" style={{ marginBottom: 8 }}>
                <span
                  className={`chip ${selectedYears.length === 0 ? "active" : ""}`}
                  onClick={() => setSelectedYears([])}
                  role="button"
                  tabIndex={0}
                >
                  كل السنوات
                </span>
                {years.map((y) => (
                  <span
                    key={y}
                    className={`chip ${selectedYears.includes(y) ? "active" : ""}`}
                    onClick={() => toggleYear(y)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") toggleYear(y);
                    }}
                  >
                    {y}
                  </span>
                ))}
              </div>
              {!years.length && (
                <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
                  لا توجد سنوات مسجّلة على أسئلة هذا الدرس بعد.
                </p>
              )}
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>المراجعة</label>
              <div className="filter-row" style={{ marginBottom: 8 }}>
                <span
                  className={`chip ${reviewMode === "immediate" ? "active" : ""}`}
                  onClick={() => setReviewMode("immediate")}
                  role="button"
                  tabIndex={0}
                >
                  فورية
                </span>
                <span
                  className={`chip ${reviewMode === "final" ? "active" : ""}`}
                  onClick={() => setReviewMode("final")}
                  role="button"
                  tabIndex={0}
                >
                  نهائية
                </span>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="btn btn-primary"
                disabled={startBusy || !selectedLevels.length || selectedCount < 1 || bankTotal < 1}
                onClick={startExam}
              >
                {startBusy ? "جاري البدء…" : "ابدأ هذا الدرس"}
              </button>
              <span style={{ fontWeight: 700, fontSize: 15 }}>
                {!selectedLevels.length
                  ? "اختر المستوى"
                  : `${selectedCount} سؤال سيظهر في الاختبار`}
              </span>
            </div>
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
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowImport((v) => !v);
                      setShowForm(false);
                      setEditingQ(null);
                    }}
                  >
                    {showImport ? "إخفاء الرفع" : "⬆ رفع ملف Word"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setEditingQ(null);
                      setShowImport(false);
                      setShowForm((v) => !v);
                    }}
                  >
                    {showForm && !editingQ ? "إخفاء النموذج" : "+ إضافة سؤال"}
                  </button>
                </div>
              </div>

              {showImport && (
                <QuestionImportPanel
                  importUrl="/collection-questions/import/"
                  lessonId={lessonId}
                  showYearHint
                  templateDownloadName="نموذج-أسئلة-التجميعات.docx"
                  onImported={async (data) => {
                    setMsg(
                      `تم استيراد ${data.created} سؤال ✓` +
                        (data.summary?.needs_review
                          ? ` — منها ${data.summary.needs_review} بحاجة لمراجعتك قبل الظهور للطلاب`
                          : "")
                    );
                    setShowImport(false);
                    await loadQuestions();
                    await loadLesson();
                  }}
                />
              )}

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
                {reviewCount > 0 && (
                  <span
                    className={`chip ${filterLevel === "review" ? "active" : ""}`}
                    onClick={() => setFilterLevel("review")}
                    role="button"
                    tabIndex={0}
                    style={{ background: filterLevel === "review" ? undefined : "#fef3c7", color: filterLevel === "review" ? undefined : "#92400e" }}
                  >
                    بحاجة لمراجعة ({reviewCount})
                  </span>
                )}
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
                      {item.needs_review && (
                        <span
                          className="chip"
                          style={{ background: "#fef3c7", color: "#92400e", marginInlineEnd: 6 }}
                        >
                          بحاجة لمراجعة — مخفي عن الطلاب
                        </span>
                      )}
                      <MathText>{item.text}</MathText>
                      {item.needs_review && item.review_notes && (
                        <div style={{ color: "#b45309", fontSize: 13, marginTop: 4 }}>
                          ملاحظات الاستيراد: {item.review_notes}
                        </div>
                      )}
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
                      {item.needs_review && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => approveQuestion(item.id)}
                        >
                          اعتماد
                        </button>
                      )}
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
