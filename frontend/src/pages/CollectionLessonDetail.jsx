import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { canEditSubject } from "../auth/teacherScope";
import client from "../api/client";
import BackToCourses from "../components/BackToCourses";
import MathText from "../components/MathText";
import QuestionImportPanel from "../components/QuestionImportPanel";
import QuestionOrderNumber from "../components/QuestionOrderNumber";
import TeacherQuestionForm from "../components/TeacherQuestionForm";
import VideoPlayer from "../components/VideoPlayer";
import { TEACHER_TIERS, tierLabel } from "../constants/teacherTiers";
import { lockSubjectTheme } from "../theme/subjects";
import useSubjectSkin from "../theme/useSubjectSkin";
import "../styles/practice-exact.css";

const CheckMini = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12l5 5L20 7" />
  </svg>
);

function sortByOrder(rows) {
  return [...(rows || [])].sort(
    (a, b) => (a.order_number || 0) - (b.order_number || 0) || a.id - b.id
  );
}

function moveToPosition(list, id, newPos) {
  const next = [...list];
  const from = next.findIndex((q) => q.id === id);
  if (from < 0) return list;
  const to = Math.max(0, Math.min(next.length - 1, newPos - 1));
  if (from === to) return list;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

const LEVELS = [
  { id: "easy", label: "سهل" },
  { id: "medium", label: "متوسط" },
  { id: "hard", label: "صعب" },
];

/**
 * داخل درس التجميع: للمستويات + الترشيح + المراجعة — بدون فلتر سنة (حسب الـ handoff).
 * للمدرس: فيديو / PDF / إدارة بنك الأسئلة.
 */
export default function CollectionLessonDetail() {
  const { subjectId, lessonId, subLessonId: subLessonIdParam } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const focusedSubId = subLessonIdParam ? Number(subLessonIdParam) : null;
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
  const [yearStats, setYearStats] = useState([]);
  const [tierStats, setTierStats] = useState([]);
  const [filterBreakdown, setFilterBreakdown] = useState([]);
  const [selectedTiers, setSelectedTiers] = useState([]);
  const [reviewMode, setReviewMode] = useState("immediate");
  const [showImport, setShowImport] = useState(false);
  /** After save/cancel, scroll back so this question stays in view. */
  const [scrollBackToQId, setScrollBackToQId] = useState(null);
  const [subLessons, setSubLessons] = useState([]);
  /**
   * Teacher view scope on the main lesson page: "all" | "none" (direct) | sub-lesson id.
   * When focusedSubId is set (sub route), scope is locked to that sub-lesson.
   */
  const [activeSub, setActiveSub] = useState(focusedSubId ?? "all");
  /** Student filter: sub-lesson ids; 0 = questions directly under the main lesson. */
  const [selectedSubs, setSelectedSubs] = useState(
    focusedSubId ? [focusedSubId] : []
  );

  const canEdit = canEditSubject(user, subjectId || lesson?.subject);
  const canRenameLesson =
    canEdit && (user?.role === "teacher" || user?.role === "admin");
  const listUrl = `/courses/${subjectId || lesson?.subject}/collections`;
  const { subjectName, logo, skin, key: subjectKey } = useSubjectSkin(subjectId || lesson?.subject);
  const practiceSkin = {
    ...skin,
    "--p": skin["--g"],
    "--pd": skin["--gd"],
    "--pl": skin["--gl"],
    "--pl2": skin["--gl2"],
    "--y": skin["--g"],
    "--yd": skin["--gd"],
  };

  useEffect(() => {
    if (subjectKey) lockSubjectTheme(subjectKey);
  }, [subjectKey]);
  const levelCounts = lesson?.collection_difficulty_counts || {
    easy: 0,
    medium: 0,
    hard: 0,
  };

  const allowedYears = null;

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
    setTab("questions");
    setActiveSub(focusedSubId ?? "all");
    setSelectedSubs(focusedSubId ? [focusedSubId] : []);
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
            setYearStats(res.data.year_stats || []);
            setTierStats(res.data.tier_stats || []);
            setFilterBreakdown(res.data.filter_breakdown || []);
          })
          .catch(() => {
            if (!cancelled) {
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
  }, [lessonId, focusedSubId, user, subjectId]);

  function loadQuestions() {
    const params = new URLSearchParams({ lesson: String(lessonId) });
    if (focusedSubId) params.set("sub_lesson", String(focusedSubId));
    return client
      .get(`/collection-questions/?${params.toString()}`)
      .then((res) => setQList(sortByOrder(res.data.results || res.data || [])))
      .catch(() => setQList([]));
  }

  async function reorderScopedQuestions(ordered) {
    const payload = {
      lesson: Number(lessonId),
      ordered_ids: ordered.map((q) => q.id),
    };
    if (focusedSubId) payload.sub_lesson = focusedSubId;
    else if (effectiveActiveSub === "none") payload.sub_lesson = "none";
    else if (typeof effectiveActiveSub === "number") payload.sub_lesson = effectiveActiveSub;
    const { data } = await client.post("/collection-questions/reorder/", payload);
    const byId = Object.fromEntries((data || []).map((q) => [q.id, q]));
    setQList((prev) =>
      sortByOrder(
        prev.map((q) => (byId[q.id] ? { ...q, order_number: byId[q.id].order_number } : q))
      )
    );
  }

  async function commitQuestionOrder(item, newPos, scopeList) {
    const ordered = moveToPosition(scopeList, item.id, newPos);
    if (ordered === scopeList) return;
    // Optimistic UI
    const optimistic = ordered.map((q, i) => ({ ...q, order_number: i + 1 }));
    setQList((prev) => {
      const others = prev.filter((q) => !optimistic.some((o) => o.id === q.id));
      return sortByOrder([...others, ...optimistic]);
    });
    try {
      await reorderScopedQuestions(ordered);
      setMsg("تم تحديث ترتيب الأسئلة ✓");
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر تحديث الترتيب");
      await loadQuestions();
    }
  }

  async function bulkDeleteQuestions() {
    const scopeLabel = focusedSubObj
      ? `الدرس الفرعي «${focusedSubObj.title}»`
      : effectiveActiveSub === "none"
        ? "الأسئلة المباشرة تحت الدرس الرئيسي"
        : typeof effectiveActiveSub === "number" && activeSubObj
          ? `الدرس الفرعي «${activeSubObj.title}»`
          : `كل أسئلة الدرس «${lesson.title}»`;
    const countHint =
      effectiveActiveSub === "all" && !focusedSubId
        ? qList.length
        : subScopedQs.length;
    if (
      !confirm(
        `مسح ${countHint} سؤال من ${scopeLabel}؟\nلا يمكن التراجع عن هذا الإجراء.`
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const payload = { lesson: Number(lessonId) };
      if (focusedSubId) payload.sub_lesson = focusedSubId;
      else if (effectiveActiveSub === "none") payload.sub_lesson = "none";
      else if (typeof effectiveActiveSub === "number") payload.sub_lesson = effectiveActiveSub;
      // when "all" on main: omit sub_lesson → delete entire lesson bank
      const { data } = await client.post("/collection-questions/bulk-delete/", payload);
      setEditingQ(null);
      setShowForm(false);
      await Promise.all([loadQuestions(), loadLesson(), loadSubLessons()]);
      setMsg(`تم مسح ${data.deleted ?? countHint} سؤال ✓`);
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر المسح الجماعي");
    } finally {
      setBusy(false);
    }
  }

  function loadSubLessons() {
    return client
      .get(`/collection-sub-lessons/?lesson=${lessonId}`)
      .then((res) => {
        const rows = res.data.results || res.data || [];
        setSubLessons(rows);
        if (focusedSubId && !rows.some((s) => s.id === focusedSubId)) {
          setMsg("الدرس الفرعي غير موجود — تم التحويل للدرس الرئيسي");
          navigate(`/courses/${subjectId}/collections/${lessonId}`, { replace: true });
          return;
        }
        if (!focusedSubId) {
          setActiveSub(rows.length ? "none" : "all");
        }
      })
      .catch(() => setSubLessons([]));
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
      setMsg("لا توجد أسئلة بالمستويات/الترشيحات المختارة");
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
  const focusedSubObj = focusedSubId
    ? subLessons.find((s) => s.id === focusedSubId) || null
    : null;
  const effectiveActiveSub = focusedSubId ?? activeSub;
  const activeSubObj =
    typeof effectiveActiveSub === "number"
      ? subLessons.find((s) => s.id === effectiveActiveSub)
      : null;
  const subScopedQs =
    effectiveActiveSub === "all"
      ? qList
      : effectiveActiveSub === "none"
        ? qList.filter((q) => !q.sub_lesson)
        : qList.filter((q) => q.sub_lesson === effectiveActiveSub);
  const reviewCount = subScopedQs.filter((q) => q.needs_review).length;
  const visibleQs =
    filterLevel === "all"
      ? subScopedQs
      : filterLevel === "review"
        ? subScopedQs.filter((q) => q.needs_review)
        : subScopedQs.filter((q) => q.difficulty === filterLevel);
  const studentHasDirect = filterBreakdown.some((r) => r.sub_lesson == null);

  const levelLabel = (d) => LEVELS.find((x) => x.id === d)?.label || d;
  const pageTitle = focusedSubObj
    ? focusedSubObj.title
    : lesson.title;

  const totalQs =
    (Number(levelCounts.easy) || 0) +
    (Number(levelCounts.medium) || 0) +
    (Number(levelCounts.hard) || 0);

  return (
    <div className="practice-exact" style={practiceSkin}>
      <div className="topbar">
        <div className="crumb">
          دورات <i>‹</i> {subjectName} <i>‹</i> تجميعات <i>‹</i>{" "}
          {focusedSubObj ? (
            <>
              <Link to={`${listUrl}/${lessonId}`}>{lesson.title}</Link> <i>‹</i> <b>{focusedSubObj.title}</b>
            </>
          ) : (
            <b>{pageTitle}</b>
          )}
        </div>
        <div className="backs">
          <Link className="back" to={listUrl}>→ دروس التجميعات</Link>
          <Link className="back" to="/courses">كل المواد</Link>
        </div>
      </div>

      <div className="hero">
        <div className="lg"><img src={logo} alt="" /></div>
        <span className="sep" />
        <div>
          <small>تجميعات · الدرس {lesson.order_number || ""}</small>
          <h1>{pageTitle}</h1>
        </div>
        <div className="qn">
          <strong>{totalQs}</strong>
          <span>سؤال في الدرس</span>
        </div>
      </div>

      {canRenameLesson && !focusedSubId && (
        <div className="card" style={{ padding: 16, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input className="form-control" style={{ flex: 1, minWidth: 200, fontSize: 20, fontWeight: 700 }} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => saveLessonPatch({ title: editTitle.trim() }, "تم تعديل الاسم ✓")}>حفظ الاسم</button>
        </div>
      )}

      {focusedSubObj && (
        <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>
          درس فرعي من «{lesson.title}» — أضف الأسئلة هنا مباشرة.
        </p>
      )}

      {canEdit && !focusedSubId && subLessons.length === 0 && (
        <div className="banner" style={{ marginBottom: 16 }}>
          أسئلة هذا الدرس تظهر لكل طلاب المادة — وليست لمجموعتك فقط (عكس تأسيس).
          لإضافة دروس فرعية اضغط + بجانب الدرس من{" "}
          <Link to={listUrl}>قائمة التجميعات</Link>.
        </div>
      )}

      {canEdit && !focusedSubId && subLessons.length > 0 && (
        <div className="banner" style={{ marginBottom: 16 }}>
          لهذا الدرس دروس فرعية — أدرها من{" "}
          <Link to={listUrl}>قائمة التجميعات</Link>، أو اضغط على درس فرعي لإضافة أسئلته.
          الأسئلة هنا تُضاف مباشرة تحت الدرس الرئيسي (بدون فرع).
        </div>
      )}

      {canEdit && focusedSubId && (
        <div className="banner" style={{ marginBottom: 16 }}>
          أسئلة هذا الدرس الفرعي تظهر لكل طلاب المادة مع أسئلة التجميع.
        </div>
      )}

      {msg && (
        <div className="banner" style={{ marginBottom: 12 }}>
          {msg}
        </div>
      )}

      {canEdit && !focusedSubId && (
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

      {canEdit && !focusedSubId && tab === "video" && (
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

      {canEdit && !focusedSubId && tab === "pdf" && (
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
          <div className="layout" style={{ marginBottom: 20 }}>
            <div>
              <div className="box">
                <div className="bh">
                  <h3><span className="step">1</span>مستوى الصعوبة</h3>
                  <span className="opt">ممكن أكتر من مستوى</span>
                </div>
                <div className="seg">
                  {LEVELS.map((lv) => {
                    const on = selectedLevels.includes(lv.id);
                    const cls = lv.id === "easy" ? "e" : lv.id === "medium" ? "m" : "h";
                    return (
                      <button
                        key={lv.id}
                        type="button"
                        className={`ch ${cls}${on ? " on" : ""}`}
                        onClick={() => toggleLevel(lv.id)}
                      >
                        <i className="cb">{on ? <CheckMini /> : null}</i>
                        {lv.label}
                        <em>{filteredLevelCounts[lv.id] || 0}</em>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="box">
                <div className="bh">
                  <h3><span className="step">2</span>ترشيحات المدرسين</h3>
                  <span className="opt">اختياري</span>
                </div>
                <div className="seg">
                  <button type="button" className={`ch${selectedTiers.length === 0 ? " on" : ""}`} onClick={() => setSelectedTiers([])}>
                    <i className="cb">{selectedTiers.length === 0 ? <CheckMini /> : null}</i>
                    كل الترشيحات
                  </button>
                  {TEACHER_TIERS.map((t) => {
                    const on = selectedTiers.includes(t.id);
                    const cls = t.id === "gold" ? "g" : t.id === "silver" ? "s" : "b";
                    return (
                      <button key={t.id} type="button" className={`ch ${cls}${on ? " on" : ""}`} onClick={() => toggleTier(t.id)}>
                        <i className="cb">{on ? <CheckMini /> : null}</i>
                        {t.label}
                        <em>{tierCountsForFilter[t.id] || 0}</em>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="box">
                <div className="bh">
                  <h3><span className="step">3</span>المراجعة</h3>
                </div>
                <div className="rv">
                  <button type="button" className={`rvo${reviewMode === "immediate" ? " on" : ""}`} onClick={() => setReviewMode("immediate")}>
                    <i className="rad" />
                    <div><b>فورية</b><small>تظهر الإجابة بعد كل سؤال</small></div>
                  </button>
                  <button type="button" className={`rvo${reviewMode === "final" ? " on" : ""}`} onClick={() => setReviewMode("final")}>
                    <i className="rad" />
                    <div><b>نهائية</b><small>بعد انتهاء الاختبار</small></div>
                  </button>
                </div>
              </div>

              {!focusedSubObj && subLessons.length > 0 && (
                <div className="box">
                  <div className="bh">
                    <h3><span className="step">4</span>الدروس الفرعية</h3>
                    <span className="opt">اختياري</span>
                  </div>
                  <div className="seg">
                    <button type="button" className={`ch${selectedSubs.length === 0 ? " on" : ""}`} onClick={() => setSelectedSubs([])}>
                      <i className="cb">{selectedSubs.length === 0 ? <CheckMini /> : null}</i>
                      الدرس كاملاً
                    </button>
                    {subLessons.map((s) => {
                      const on = selectedSubs.includes(s.id);
                      return (
                        <button key={s.id} type="button" className={`ch${on ? " on" : ""}`} onClick={() => toggleSub(s.id)}>
                          <i className="cb">{on ? <CheckMini /> : null}</i>
                          {s.title}
                          <em>{subCountsForFilter[s.id] || 0}</em>
                        </button>
                      );
                    })}
                    {studentHasDirect && (
                      <button type="button" className={`ch${selectedSubs.includes(0) ? " on" : ""}`} onClick={() => toggleSub(0)}>
                        <i className="cb">{selectedSubs.includes(0) ? <CheckMini /> : null}</i>
                        أسئلة عامة
                        <em>{subCountsForFilter[0] || 0}</em>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <aside className="side">
              <div className="sum">
                <h3>ملخص التدريب</h3>
                <div className="si"><span>الصعوبة</span><b>{selectedLevels.length ? selectedLevels.map((id) => LEVELS.find((l) => l.id === id)?.label).join(" + ") : "—"}</b></div>
                <div className="si"><span>الترشيح</span><b>{selectedTiers.length ? selectedTiers.map((id) => tierLabel(id)).join(" + ") : "الكل"}</b></div>
                <div className="si"><span>المراجعة</span><b>{reviewMode === "immediate" ? "فورية" : "نهائية"}</b></div>
                <div className="big"><strong>{selectedLevels.length ? selectedCount : "—"}</strong><span>سؤال مطابق</span></div>
                <button
                  type="button"
                  className="start"
                  disabled={startBusy || !selectedLevels.length || selectedCount < 1}
                  onClick={startExam}
                >
                  {startBusy ? "جاري البدء…" : "ابدأ الحل ←"}
                </button>
              </div>
            </aside>
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
                        : "+ إضافة سؤال على الفصل"}
                  </button>
                  {(focusedSubId
                    ? subScopedQs.length > 0
                    : effectiveActiveSub === "all"
                      ? qList.length > 0
                      : subScopedQs.length > 0) && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ color: "var(--error)" }}
                      disabled={busy}
                      onClick={bulkDeleteQuestions}
                    >
                      مسح كل الأسئلة هنا
                    </button>
                  )}
                </div>
              </div>

              {!focusedSubId && subLessons.length > 0 && (
                <div className="card" style={{ padding: 14, marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>الدروس الفرعية</div>
                  <div className="filter-row" style={{ marginBottom: 0 }}>
                    {subLessons.map((s) => (
                      <Link
                        key={s.id}
                        to={`${listUrl}/${lessonId}/sub/${s.id}`}
                        className="chip"
                        style={{ textDecoration: "none" }}
                      >
                        {s.title}
                      </Link>
                    ))}
                    <Link to={listUrl} className="chip" style={{ textDecoration: "none" }}>
                      إدارة من القائمة (+)
                    </Link>
                  </div>
                </div>
              )}

              {showImport && (
                <QuestionImportPanel
                  importUrl="/collection-questions/import/"
                  lessonId={lessonId}
                  subLessonId={focusedSubId || null}
                  targetLabel={
                    focusedSubObj
                      ? `الدرس الفرعي «${focusedSubObj.title}»`
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
                  defaultSubLessonId={focusedSubId || null}
                  onCancel={() => setShowForm(false)}
                  onSaved={() => {
                    loadQuestions();
                    loadSubLessons();
                    setShowForm(false);
                    setMsg("تم إضافة السؤال ✓");
                  }}
                />
              )}

              {canEdit &&
                subScopedQs.length > 1 &&
                (focusedSubId || effectiveActiveSub === "none" || typeof effectiveActiveSub === "number") && (
                  <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 8 }}>
                    رتّب الأسئلة بالترقيم (#) — غيّر الرقم ثم Enter. مش محتاج أسهم.
                  </p>
                )}

              {visibleQs.map((item, i) => {
                const isEditing = editingQ?.id === item.id;
                const options = Array.isArray(item.options) ? item.options : [];
                const scopeForOrder = subScopedQs;
                const orderIndex = scopeForOrder.findIndex((q) => q.id === item.id);
                const canNumberOrder =
                  orderIndex >= 0 &&
                  scopeForOrder.length > 1 &&
                  (focusedSubId ||
                    effectiveActiveSub === "none" ||
                    typeof effectiveActiveSub === "number");
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
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            flexWrap: "wrap",
                            marginBottom: 4,
                          }}
                        >
                          {canNumberOrder ? (
                            <QuestionOrderNumber
                              value={orderIndex + 1}
                              max={scopeForOrder.length}
                              disabled={busy}
                              onCommit={(n) => commitQuestionOrder(item, n, scopeForOrder)}
                            />
                          ) : (
                            <strong style={{ color: "var(--text-muted)" }}>س{i + 1}</strong>
                          )}
                          <strong>
                            {levelLabel(item.difficulty)}
                            {item.question_year ? ` · ${item.question_year}` : ""}
                            {item.teacher_tier ? ` · ${tierLabel(item.teacher_tier)}` : ""}:
                          </strong>
                        </div>{" "}
                        {effectiveActiveSub === "all" && item.sub_lesson && subTitleById[item.sub_lesson] && (
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
                          defaultSubLessonId={focusedSubId || item.sub_lesson || null}
                          onCancel={() => closeQuestionEdit(item.id)}
                          onSaved={() => {
                            Promise.all([loadQuestions(), loadSubLessons()]).then(() => {
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
