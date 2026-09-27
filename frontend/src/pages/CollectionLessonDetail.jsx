import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { canEditSubject } from "../auth/teacherScope";
import client from "../api/client";
import BackToCourses from "../components/BackToCourses";
import MathText from "../components/MathText";
import QuestionImportPanel from "../components/QuestionImportPanel";
import TeacherQuestionForm from "../components/TeacherQuestionForm";
import VideoPlayer from "../components/VideoPlayer";
import YearScrollPicker, { expandYearRange } from "../components/YearScrollPicker";
import { TEACHER_TIERS, tierLabel } from "../constants/teacherTiers";

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
  const [yearRange, setYearRange] = useState(null);
  const [tierStats, setTierStats] = useState([]);
  const [filterBreakdown, setFilterBreakdown] = useState([]);
  const [selectedTiers, setSelectedTiers] = useState([]);
  const [reviewMode, setReviewMode] = useState("immediate");
  const [showImport, setShowImport] = useState(false);
  /** After save/cancel, scroll back so this question stays in view. */
  const [scrollBackToQId, setScrollBackToQId] = useState(null);
  const [subLessons, setSubLessons] = useState([]);
  /** Teacher view scope: "all" | "none" (direct questions) | sub-lesson id */
  const [activeSub, setActiveSub] = useState("all");
  const [newSubTitle, setNewSubTitle] = useState("");
  const [renameSubId, setRenameSubId] = useState(null);
  const [renameSubTitle, setRenameSubTitle] = useState("");
  /** Student filter: sub-lesson ids; 0 = questions directly under the main lesson. */
  const [selectedSubs, setSelectedSubs] = useState([]);

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

  const allowedYears = useMemo(() => {
    if (!yearRange) return null;
    return new Set(expandYearRange(years, yearRange));
  }, [years, yearRange]);

  const filteredLevelCounts = useMemo(() => {
    if (!allowedYears && !selectedTiers.length && !selectedSubs.length) {
      return {
        easy: Number(levelCounts.easy) || 0,
        medium: Number(levelCounts.medium) || 0,
        hard: Number(levelCounts.hard) || 0,
      };
    }
    const out = { easy: 0, medium: 0, hard: 0 };
    if (filterBreakdown.length) {
      for (const row of filterBreakdown) {
        if (allowedYears && !allowedYears.has(row.question_year || "")) {
          continue;
        }
        if (selectedTiers.length && !selectedTiers.includes(row.teacher_tier || "")) {
          continue;
        }
        if (selectedSubs.length && !selectedSubs.includes(row.sub_lesson ?? 0)) {
          continue;
        }
        const d = row.difficulty;
        if (d in out) out[d] += Number(row.count) || 0;
      }
      return out;
    }
    // Fallback when breakdown unavailable.
    for (const row of yearStats) {
      if (allowedYears && !allowedYears.has(row.year)) continue;
      out.easy += Number(row.easy) || 0;
      out.medium += Number(row.medium) || 0;
      out.hard += Number(row.hard) || 0;
    }
    return out;
  }, [
    allowedYears,
    selectedTiers,
    selectedSubs,
    filterBreakdown,
    yearStats,
    levelCounts.easy,
    levelCounts.medium,
    levelCounts.hard,
  ]);

  const tierCountsForFilter = useMemo(() => {
    const out = Object.fromEntries(TEACHER_TIERS.map((t) => [t.id, 0]));
    for (const row of filterBreakdown) {
      if (allowedYears && !allowedYears.has(row.question_year || "")) continue;
      if (selectedSubs.length && !selectedSubs.includes(row.sub_lesson ?? 0)) continue;
      if (row.teacher_tier && row.teacher_tier in out) {
        out[row.teacher_tier] += Number(row.count) || 0;
      }
    }
    if (!filterBreakdown.length) {
      for (const row of tierStats) {
        if (row.tier in out) out[row.tier] = Number(row.total) || 0;
      }
    }
    return out;
  }, [filterBreakdown, tierStats, allowedYears, selectedSubs]);

  /** Student chip counts per sub-lesson (0 = direct), respecting year + tier filters. */
  const subCountsForFilter = useMemo(() => {
    const out = {};
    for (const row of filterBreakdown) {
      if (allowedYears && !allowedYears.has(row.question_year || "")) continue;
      if (selectedTiers.length && !selectedTiers.includes(row.teacher_tier || "")) continue;
      const key = row.sub_lesson ?? 0;
      out[key] = (out[key] || 0) + (Number(row.count) || 0);
    }
    return out;
  }, [filterBreakdown, allowedYears, selectedTiers]);

  function toggleSub(id) {
    setSelectedSubs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const selectedCount = useMemo(() => {
    if (!selectedLevels.length) return 0;
    return selectedLevels.reduce(
      (sum, lv) => sum + (Number(filteredLevelCounts[lv]) || 0),
      0
    );
  }, [selectedLevels, filteredLevelCounts]);

  function toggleTier(id) {
    setSelectedTiers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleLevel(id) {
    setSelectedLevels((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
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
    setYearRange(null);
    setSelectedTiers([]);
    setShowImport(false);
    setActiveSub("all");
    setSelectedSubs([]);
    setSubLessons([]);
    loadSubLessons();
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
            setTierStats(res.data.tier_stats || []);
            setFilterBreakdown(res.data.filter_breakdown || []);
          })
          .catch(() => {
            if (!cancelled) {
              setYears([]);
              setYearStats([]);
              setTierStats([]);
              setFilterBreakdown([]);
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

  function loadSubLessons() {
    return client
      .get(`/collection-sub-lessons/?lesson=${lessonId}`)
      .then((res) => setSubLessons(res.data.results || res.data || []))
      .catch(() => setSubLessons([]));
  }

  async function createSubLesson() {
    const title = newSubTitle.trim();
    if (!title) return;
    setBusy(true);
    setMsg("");
    try {
      const { data } = await client.post("/collection-sub-lessons/", {
        lesson: Number(lessonId),
        title,
      });
      setNewSubTitle("");
      await loadSubLessons();
      setActiveSub(data.id);
      setMsg(`تم إنشاء الدرس الفرعي «${data.title}» ✓ — أضف أسئلته الآن`);
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر إنشاء الدرس الفرعي");
    } finally {
      setBusy(false);
    }
  }

  async function saveSubRename(id) {
    const title = renameSubTitle.trim();
    if (!title) return;
    setBusy(true);
    setMsg("");
    try {
      await client.patch(`/collection-sub-lessons/${id}/`, { title });
      setRenameSubId(null);
      await loadSubLessons();
      setMsg("تم تعديل اسم الدرس الفرعي ✓");
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر التعديل");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSubLesson(sub) {
    if (
      !confirm(
        `حذف الدرس الفرعي «${sub.title}»؟\nأسئلته لن تُحذف — ستنتقل مباشرة إلى الدرس الرئيسي.`
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      await client.delete(`/collection-sub-lessons/${sub.id}/`);
      if (activeSub === sub.id) setActiveSub("all");
      await Promise.all([loadSubLessons(), loadQuestions()]);
      setMsg("تم حذف الدرس الفرعي — أسئلته أصبحت في الدرس الرئيسي");
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر الحذف");
    } finally {
      setBusy(false);
    }
  }

  async function moveSubLesson(id, dir) {
    const idx = subLessons.findIndex((s) => s.id === id);
    const j = dir === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || j < 0 || j >= subLessons.length) return;
    const next = [...subLessons];
    [next[idx], next[j]] = [next[j], next[idx]];
    setSubLessons(next);
    try {
      const { data } = await client.post("/collection-sub-lessons/reorder/", {
        lesson: Number(lessonId),
        ordered_ids: next.map((s) => s.id),
      });
      setSubLessons(data);
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر تغيير الترتيب");
      loadSubLessons();
    }
  }

  /** Close the inline editor and keep the same question visible on screen. */
  function closeQuestionEdit(questionId, okMsg) {
    if (okMsg) setMsg(okMsg);
    setEditingQ(null);
    setShowForm(false);
    setScrollBackToQId(questionId);
  }

  useLayoutEffect(() => {
    if (!scrollBackToQId || editingQ) return;
    const id = scrollBackToQId;
    const el = document.getElementById(`collection-q-${id}`);
    if (!el) return;
    const top = window.scrollY + el.getBoundingClientRect().top - 16;
    window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
    setScrollBackToQId(null);
  }, [scrollBackToQId, editingQ, qList, msg]);

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
      setQList((prev) => prev.filter((q) => q.id !== id));
      if (editingQ?.id === id) {
        setEditingQ(null);
        setShowForm(false);
      }
      setMsg("تم حذف السؤال");
      await loadQuestions();
      loadLesson();
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
      setMsg("لا توجد أسئلة بالمستويات/السنوات/الترشيحات المختارة");
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
      if (yearRange) {
        const expanded = expandYearRange(years, yearRange);
        if (expanded.length) payload.years = expanded;
      }
      if (selectedTiers.length) {
        payload.tiers = selectedTiers;
      }
      if (selectedSubs.length) {
        payload.sub_lessons = selectedSubs;
        const names = subLessons
          .filter((s) => selectedSubs.includes(s.id))
          .map((s) => s.title);
        if (selectedSubs.includes(0)) names.push("أسئلة عامة");
        if (names.length) payload.title = `${payload.title} › ${names.join("، ")}`.slice(0, 200);
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

  const subTitleById = Object.fromEntries(subLessons.map((s) => [s.id, s.title]));
  const activeSubObj =
    typeof activeSub === "number" ? subLessons.find((s) => s.id === activeSub) : null;
  const directQCount = qList.filter((q) => !q.sub_lesson).length;
  const subScopedQs =
    activeSub === "all"
      ? qList
      : activeSub === "none"
        ? qList.filter((q) => !q.sub_lesson)
        : qList.filter((q) => q.sub_lesson === activeSub);
  const reviewCount = subScopedQs.filter((q) => q.needs_review).length;
  const visibleQs =
    filterLevel === "all"
      ? subScopedQs
      : filterLevel === "review"
        ? subScopedQs.filter((q) => q.needs_review)
        : subScopedQs.filter((q) => q.difficulty === filterLevel);
  const studentHasDirect = filterBreakdown.some((r) => r.sub_lesson == null);

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
            {subLessons.length > 0 && (
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>الدروس الفرعية — اختياري (واحد أو أكثر، أو الدرس كاملاً)</label>
                <div className="filter-row" style={{ marginBottom: 8 }}>
                  <span
                    className={`chip ${selectedSubs.length === 0 ? "active" : ""}`}
                    onClick={() => setSelectedSubs([])}
                    role="button"
                    tabIndex={0}
                  >
                    الدرس كاملاً
                  </span>
                  {subLessons.map((s) => (
                    <span
                      key={s.id}
                      className={`chip ${selectedSubs.includes(s.id) ? "active" : ""}`}
                      onClick={() => toggleSub(s.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") toggleSub(s.id);
                      }}
                    >
                      {s.title} ({subCountsForFilter[s.id] || 0})
                    </span>
                  ))}
                  {studentHasDirect && (
                    <span
                      className={`chip ${selectedSubs.includes(0) ? "active" : ""}`}
                      onClick={() => toggleSub(0)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") toggleSub(0);
                      }}
                    >
                      أسئلة عامة ({subCountsForFilter[0] || 0})
                    </span>
                  )}
                </div>
              </div>
            )}
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
              <label>سنة / تاريخ الاختبار — اختياري</label>
              <YearScrollPicker
                years={years}
                value={yearRange}
                onChange={setYearRange}
                yearStats={yearStats}
                emptyMessage="لا توجد سنوات مسجّلة على أسئلة هذا الدرس بعد."
              />
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>ترشيحات المدرسين — اختياري (واحد أو أكثر، أو الكل)</label>
              <div className="filter-row" style={{ marginBottom: 8 }}>
                <span
                  className={`chip ${selectedTiers.length === 0 ? "active" : ""}`}
                  onClick={() => setSelectedTiers([])}
                  role="button"
                  tabIndex={0}
                >
                  كل الترشيحات
                </span>
                {TEACHER_TIERS.map((t) => (
                  <span
                    key={t.id}
                    className={`chip ${selectedTiers.includes(t.id) ? "active" : ""}`}
                    onClick={() => toggleTier(t.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") toggleTier(t.id);
                    }}
                  >
                    {t.label} ({tierCountsForFilter[t.id] || 0})
                  </span>
                ))}
              </div>
              {!tierStats.length && !filterBreakdown.some((r) => r.teacher_tier) && (
                <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
                  لا توجد ترشيحات مسجّلة على أسئلة هذا الدرس بعد.
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
                    {showForm && !editingQ
                      ? "إخفاء النموذج"
                      : activeSubObj
                        ? `+ إضافة سؤال في «${activeSubObj.title}»`
                        : "+ إضافة سؤال"}
                  </button>
                </div>
              </div>

              <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                <div className="section-title" style={{ marginTop: 0, fontSize: 17 }}>
                  الدروس الفرعية (اختياري)
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 10 }}>
                  يمكنك إضافة الأسئلة مباشرة في هذا الدرس، أو تقسيمه إلى دروس فرعية وإضافة
                  أسئلة كل درس فرعي بداخله. اختر درساً فرعياً لعرض أسئلته وإضافة أسئلة جديدة إليه.
                </p>
                <div className="filter-row" style={{ marginBottom: 10 }}>
                  <span
                    className={`chip ${activeSub === "all" ? "active" : ""}`}
                    onClick={() => setActiveSub("all")}
                    role="button"
                    tabIndex={0}
                  >
                    كل أسئلة الدرس ({qList.length})
                  </span>
                  {subLessons.length > 0 && (
                    <span
                      className={`chip ${activeSub === "none" ? "active" : ""}`}
                      onClick={() => setActiveSub("none")}
                      role="button"
                      tabIndex={0}
                    >
                      مباشرة في الدرس الرئيسي ({directQCount})
                    </span>
                  )}
                  {subLessons.map((s) => (
                    <span
                      key={s.id}
                      className={`chip ${activeSub === s.id ? "active" : ""}`}
                      onClick={() => setActiveSub(s.id)}
                      role="button"
                      tabIndex={0}
                    >
                      {s.title} ({qList.filter((q) => q.sub_lesson === s.id).length})
                    </span>
                  ))}
                </div>

                {activeSubObj && (
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    {renameSubId === activeSubObj.id ? (
                      <>
                        <input
                          className="form-control"
                          style={{ flex: 1, minWidth: 180 }}
                          value={renameSubTitle}
                          onChange={(e) => setRenameSubTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveSubRename(activeSubObj.id);
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={busy}
                          onClick={() => saveSubRename(activeSubObj.id)}
                        >
                          حفظ
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setRenameSubId(null)}
                        >
                          إلغاء
                        </button>
                      </>
                    ) : (
                      <>
                        <strong style={{ flex: 1 }}>الدرس الفرعي: {activeSubObj.title}</strong>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busy || subLessons[0]?.id === activeSubObj.id}
                          onClick={() => moveSubLesson(activeSubObj.id, "up")}
                          title="للأعلى"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busy || subLessons[subLessons.length - 1]?.id === activeSubObj.id}
                          onClick={() => moveSubLesson(activeSubObj.id, "down")}
                          title="للأسفل"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setRenameSubId(activeSubObj.id);
                            setRenameSubTitle(activeSubObj.title);
                          }}
                        >
                          تعديل الاسم
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ color: "var(--error)" }}
                          disabled={busy}
                          onClick={() => deleteSubLesson(activeSubObj)}
                        >
                          حذف
                        </button>
                      </>
                    )}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    className="form-control"
                    style={{ flex: 1, minWidth: 200 }}
                    placeholder="اسم درس فرعي جديد (مثال: السرعة)"
                    value={newSubTitle}
                    onChange={(e) => setNewSubTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") createSubLesson();
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy || !newSubTitle.trim()}
                    onClick={createSubLesson}
                  >
                    + درس فرعي
                  </button>
                </div>
              </div>

              {showImport && (
                <QuestionImportPanel
                  importUrl="/collection-questions/import/"
                  lessonId={lessonId}
                  subLessonId={activeSubObj?.id}
                  targetLabel={
                    activeSubObj
                      ? `الدرس الفرعي «${activeSubObj.title}»`
                      : `الدرس الرئيسي «${lesson.title}»`
                  }
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
                  الكل ({subScopedQs.length})
                </span>
                {LEVELS.map((lv) => (
                  <span
                    key={lv.id}
                    className={`chip ${filterLevel === lv.id ? "active" : ""}`}
                    onClick={() => setFilterLevel(lv.id)}
                    role="button"
                    tabIndex={0}
                  >
                    {lv.label} ({subScopedQs.filter((q) => q.difficulty === lv.id).length})
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

              {showForm && !editingQ && (
                <TeacherQuestionForm
                  subjectId={lesson.subject}
                  lessonId={lesson.id}
                  kind="collection"
                  defaultDifficulty={
                    ["easy", "medium", "hard"].includes(filterLevel) ? filterLevel : "medium"
                  }
                  initialQuestion={null}
                  subLessons={subLessons}
                  defaultSubLessonId={activeSubObj?.id ?? null}
                  onCancel={() => setShowForm(false)}
                  onSaved={() => {
                    loadQuestions();
                    setShowForm(false);
                    setMsg("تم إضافة السؤال ✓");
                  }}
                />
              )}

              {visibleQs.map((item, i) => {
                const isEditing = editingQ?.id === item.id;
                const options = Array.isArray(item.options) ? item.options : [];
                return (
                  <div
                    key={item.id}
                    id={`collection-q-${item.id}`}
                    className="card"
                    style={{
                      padding: 14,
                      marginTop: 8,
                      outline: isEditing ? "2px solid var(--primary, #2563eb)" : undefined,
                    }}
                  >
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
                          {item.question_year ? ` · ${item.question_year}` : ""}
                          {item.teacher_tier ? ` · ${tierLabel(item.teacher_tier)}` : ""}:
                        </strong>{" "}
                        {activeSub === "all" && item.sub_lesson && subTitleById[item.sub_lesson] && (
                          <span className="chip" style={{ marginInlineEnd: 6 }}>
                            {subTitleById[item.sub_lesson]}
                          </span>
                        )}
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
                        {!isEditing && options.length > 0 && (
                          <ul
                            style={{
                              margin: "8px 0 0",
                              paddingInlineStart: 18,
                              fontSize: 14,
                              lineHeight: 1.7,
                            }}
                          >
                            {options.map((o) => (
                              <li key={o.key || o.text}>
                                <strong>{o.key})</strong>{" "}
                                <MathText>{o.text || ""}</MathText>
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
                                {item.correct_answer === o.key && (
                                  <span style={{ color: "var(--success, #15803d)", marginInlineStart: 6 }}>
                                    ✓ صحيح
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                        {!isEditing && (
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
                        )}
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
                            if (isEditing) {
                              closeQuestionEdit(item.id);
                              return;
                            }
                            setShowForm(false);
                            setShowImport(false);
                            setEditingQ(item);
                          }}
                        >
                          {isEditing ? "إغلاق التعديل" : "تعديل"}
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

                    {isEditing && (
                      <div id={`collection-q-edit-${item.id}`} style={{ marginTop: 12 }}>
                        <TeacherQuestionForm
                          subjectId={lesson.subject}
                          lessonId={lesson.id}
                          kind="collection"
                          defaultDifficulty={item.difficulty || "medium"}
                          initialQuestion={editingQ}
                          subLessons={subLessons}
                          onCancel={() => closeQuestionEdit(item.id)}
                          onSaved={() => {
                            loadQuestions().then(() => {
                              closeQuestionEdit(item.id, "تم تعديل السؤال ✓");
                            });
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {visibleQs.length === 0 && !showForm && !editingQ && (
                <p style={{ color: "var(--text-muted)" }}>
                  {activeSubObj
                    ? `لا توجد أسئلة في «${activeSubObj.title}» بعد — اضغط «+ إضافة سؤال» أو ارفع ملف Word.`
                    : "لا توجد أسئلة بعد — أضف سؤالاً أعلاه."}
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
