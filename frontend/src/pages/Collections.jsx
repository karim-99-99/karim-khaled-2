import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { canEditSubject } from "../auth/teacherScope";
import client from "../api/client";
import { lockSubjectTheme, subjectClass } from "../theme/subjects";
import useSubjectSkin from "../theme/useSubjectSkin";
import HeaderLogo from "../components/HeaderLogo";
import "../styles/collections-exact.css";

/**
 * تجميعات — قائمة دروس مع دروس فرعية ظاهرة تحت كل درس (بدون الدخول للدرس الرئيسي أولاً).
 * زر + بجانب الدرس لإضافة درس فرعي · الضغط على الفرعي يدخل لإضافة الأسئلة.
 * إن لم يكن للدرس فروع: الضغط على الدرس يدخل مباشرة لإضافة الأسئلة.
 */
export default function Collections() {
  const { subjectId } = useParams();
  const { user } = useAuth();
  const { subjectName, theme, skin, key: subjectKey } = useSubjectSkin(subjectId);

  useEffect(() => {
    if (subjectKey) lockSubjectTheme(subjectKey);
  }, [subjectKey]);

  const [lessons, setLessons] = useState([]);
  const [subLessons, setSubLessons] = useState([]);
  const [msg, setMsg] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [renameId, setRenameId] = useState(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [busy, setBusy] = useState(false);
  /** lesson id currently showing the add-sub form */
  const [addingSubFor, setAddingSubFor] = useState(null);
  const [newSubTitle, setNewSubTitle] = useState("");
  const [renameSubId, setRenameSubId] = useState(null);
  const [renameSubTitle, setRenameSubTitle] = useState("");
  const [openAcc, setOpenAcc] = useState(null);

  const canEdit = canEditSubject(user, subjectId);
  const freeTier = user?.role === "student" && !user?.has_active_subscription;

  const subsByLesson = useMemo(() => {
    const map = {};
    for (const s of subLessons) {
      const lid = s.lesson;
      if (!map[lid]) map[lid] = [];
      map[lid].push(s);
    }
    for (const lid of Object.keys(map)) {
      map[lid].sort(
        (a, b) => (a.order_number || 0) - (b.order_number || 0) || a.id - b.id
      );
    }
    return map;
  }, [subLessons]);

  function loadSubs() {
    return client
      .get(`/collection-sub-lessons/?subject=${subjectId}`)
      .then((res) => setSubLessons(res.data.results || res.data || []))
      .catch(() => setSubLessons([]));
  }

  function load() {
    return client.get(`/subjects/${subjectId}/lessons/`).then((res) => {
      const rows = res.data.results || res.data || [];
      setLessons(
        [...rows].sort(
          (a, b) => (a.order_number || 0) - (b.order_number || 0) || a.id - b.id
        )
      );
      return loadSubs();
    });
  }

  useEffect(() => {
    load();
  }, [subjectId]);

  async function createLesson() {
    if (!newTitle.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      await client.post("/lessons/", {
        subject: Number(subjectId),
        title: newTitle.trim(),
        order_number: lessons.length + 1,
      });
      setNewTitle("");
      setShowAdd(false);
      setMsg("تم إنشاء الدرس ✓ — ادخل لإضافة الأسئلة، أو اضغط + لإضافة دروس فرعية");
      await load();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر إنشاء الدرس");
    } finally {
      setBusy(false);
    }
  }

  async function saveRename(id) {
    if (!renameTitle.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      await client.patch(`/lessons/${id}/`, { title: renameTitle.trim() });
      setRenameId(null);
      setMsg("تم تعديل اسم الدرس ✓");
      await load();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر التعديل");
    } finally {
      setBusy(false);
    }
  }

  async function deleteLesson(id, title) {
    if (!confirm(`حذف الدرس «${title}»؟ لا يمكن التراجع.`)) return;
    setBusy(true);
    setMsg("");
    try {
      await client.delete(`/lessons/${id}/`);
      setMsg("تم حذف الدرس");
      await load();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر الحذف");
    } finally {
      setBusy(false);
    }
  }

  async function bulkDeleteLessonQuestions(lesson) {
    if (
      !confirm(
        `مسح كل أسئلة التجميع في «${lesson.title}» (الرئيسي + كل الفروع)؟\nلا يمكن التراجع.`
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const { data } = await client.post("/collection-questions/bulk-delete/", {
        lesson: lesson.id,
      });
      setMsg(`تم مسح ${data.deleted ?? 0} سؤال من «${lesson.title}» ✓`);
      await loadSubs();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر المسح الجماعي");
    } finally {
      setBusy(false);
    }
  }

  async function moveLesson(id, dir) {
    const idx = lessons.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const j = dir === "up" ? idx - 1 : idx + 1;
    if (j < 0 || j >= lessons.length) return;
    const next = [...lessons];
    const tmp = next[idx];
    next[idx] = next[j];
    next[j] = tmp;
    setLessons(next);
    setBusy(true);
    setMsg("");
    try {
      await client.post("/lessons/reorder/", {
        subject: Number(subjectId),
        ordered_ids: next.map((l) => l.id),
      });
      setMsg("تم تحديث الترتيب ✓");
      await load();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر تغيير الترتيب");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function createSubLesson(lessonId) {
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
      setAddingSubFor(null);
      await loadSubs();
      setMsg(`تم إنشاء الدرس الفرعي «${data.title}» ✓ — اضغط عليه لإضافة الأسئلة`);
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
      await loadSubs();
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
      await loadSubs();
      setMsg("تم حذف الدرس الفرعي — أسئلته أصبحت في الدرس الرئيسي");
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر الحذف");
    } finally {
      setBusy(false);
    }
  }

  async function moveSubLesson(lessonId, id, dir) {
    const list = [...(subsByLesson[lessonId] || [])];
    const idx = list.findIndex((s) => s.id === id);
    const j = dir === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || j < 0 || j >= list.length) return;
    [list[idx], list[j]] = [list[j], list[idx]];
    setSubLessons((prev) => {
      const others = prev.filter((s) => s.lesson !== lessonId);
      return [...others, ...list];
    });
    try {
      const { data } = await client.post("/collection-sub-lessons/reorder/", {
        lesson: Number(lessonId),
        ordered_ids: list.map((s) => s.id),
      });
      setSubLessons((prev) => {
        const others = prev.filter((s) => s.lesson !== lessonId);
        return [...others, ...(data || list)];
      });
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر تغيير الترتيب");
      await loadSubs();
    }
  }

  return (
    <div className={`collections-exact ${subjectClass(subjectKey)}`} style={skin}>
      <div className="topbar">
        <div className="crumb">
          دورات <i>‹</i> {subjectName} <i>‹</i> <b>تجميعات</b>
        </div>
        <div className="backs">
          <Link className="back" to={`/courses/${subjectId}`}>→ العودة للدورات</Link>
          <Link className="back" to="/courses">كل المواد</Link>
        </div>
      </div>

      <div className="hero lessons-head">
        <div className="lg"><HeaderLogo src={theme?.logo || ""} name={subjectName} /></div>
        <span className="sep" />
        <div className="mid">
          <small>{subjectName}</small>
          <h1>التجميعات — الدروس</h1>
        </div>
        <div className="qn">
          <strong>{lessons.length || 0}</strong>
          <span>درس</span>
        </div>
      </div>

      <Link className="simb" to={`/tests/simulator/${subjectId}?from=collections`}>
        <div className="si">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="12" cy="12" r="1.5" fill="#fff" />
          </svg>
        </div>
        <div><b>الاختبارات المحاكية الشخصية</b></div>
        <span className="go">ابدأ ←</span>
      </Link>

      {canEdit && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <button type="button" className="btn btn-primary" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? "إلغاء" : "+ درس جديد"}
          </button>
        </div>
      )}

      {freeTier && (
        <div className="banner" style={{ marginBottom: 16 }}>
          المعاينة المجانية: أول درس فقط بحد أقصى ١٠ أسئلة —
          <Link to="/subscription"> اشترك الآن</Link>
        </div>
      )}
      {msg && <div className="banner" style={{ marginBottom: 12 }}>{msg}</div>}

      {canEdit && showAdd && (
        <div className="card" style={{ padding: 16, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            className="form-control"
            style={{ flex: 1, minWidth: 200 }}
            placeholder="اسم الدرس الجديد"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") createLesson(); }}
          />
          <button type="button" className="btn btn-primary" disabled={busy} onClick={createLesson}>حفظ الدرس</button>
        </div>
      )}

      <div className="list">
        {lessons.map((l) => {
          const locked = l.is_locked && !canEdit;
          const scheduleLocked = !canEdit && Boolean(l.schedule_locked || l.is_schedule_locked);
          const scheduleLabel = l.lock_label || l.opens_label || "";
          const renaming = renameId === l.id;
          const subs = subsByLesson[l.id] || [];
          const lessonHref = `/courses/${subjectId}/collections/${l.id}`;
          const open = openAcc === l.id || addingSubFor === l.id || renaming;

          return (
            <div
              key={l.id}
              className={`acc${open && subs.length ? " open" : ""}${scheduleLocked ? " locked" : ""}`}
              style={{ opacity: scheduleLocked ? undefined : locked ? 0.65 : 1 }}
            >
              <div className="ls">
                <span className="n">{l.order_number}</span>
                {renaming ? (
                  <>
                    <input className="form-control" style={{ flex: 1 }} value={renameTitle} onChange={(e) => setRenameTitle(e.target.value)} />
                    <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => saveRename(l.id)}>حفظ</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenameId(null)}>إلغاء</button>
                  </>
                ) : (
                  <>
                    {scheduleLocked ? (
                      <b>
                        {l.title}
                        {scheduleLabel ? <small>🔒 {scheduleLabel}</small> : null}
                      </b>
                    ) : locked ? (
                      <b>{l.title}</b>
                    ) : (
                      <Link to={lessonHref} style={{ flex: 1 }}>
                        <b>{l.title}</b>
                      </Link>
                    )}
                    {subs.length > 0 && (
                      <span className="chip">{subs.length} دروس فرعية</span>
                    )}
                    {canEdit && (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => { setAddingSubFor((cur) => (cur === l.id ? null : l.id)); setOpenAcc(l.id); setNewSubTitle(""); }}>
                          {addingSubFor === l.id ? "إلغاء" : "+"}
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => moveLesson(l.id, "up")}>↑</button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => moveLesson(l.id, "down")}>↓</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setRenameId(l.id); setRenameTitle(l.title); }}>تعديل</button>
                        <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--error)" }} disabled={busy} onClick={() => deleteLesson(l.id, l.title)}>حذف</button>
                        <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--error)" }} disabled={busy} onClick={() => bulkDeleteLessonQuestions(l)}>مسح الأسئلة</button>
                      </div>
                    )}
                    {scheduleLocked ? (
                      <span className="ar" aria-hidden="true">🔒</span>
                    ) : subs.length > 0 ? (
                      <button
                        type="button"
                        className="tg"
                        onClick={() => setOpenAcc((cur) => (cur === l.id ? null : l.id))}
                        aria-label="توسيع"
                      >
                        {open ? "⌃" : "⌄"}
                      </button>
                    ) : !locked ? (
                      <Link to={lessonHref} className="ar">←</Link>
                    ) : (
                      <span className="ar" style={{ opacity: 0.4 }}>←</span>
                    )}
                  </>
                )}
              </div>

              {open && (subs.length > 0 || addingSubFor === l.id) && (
                <div className="subs">
                  {canEdit && addingSubFor === l.id && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <input
                        className="form-control"
                        style={{ flex: 1, minWidth: 160 }}
                        placeholder="اسم درس فرعي"
                        value={newSubTitle}
                        autoFocus
                        onChange={(e) => setNewSubTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") createSubLesson(l.id); }}
                      />
                      <button type="button" className="btn btn-primary btn-sm" disabled={busy || !newSubTitle.trim()} onClick={() => createSubLesson(l.id)}>حفظ الفرعي</button>
                    </div>
                  )}
                  {subs.map((s, si) => {
                    const subHref = `/courses/${subjectId}/collections/${l.id}/sub/${s.id}`;
                    const renamingSub = renameSubId === s.id;
                    return (
                      <div key={s.id} className="sb">
                        <span className="sn">{s.order_number || si + 1}</span>
                        {renamingSub ? (
                          <>
                            <input className="form-control" style={{ flex: 1 }} value={renameSubTitle} onChange={(e) => setRenameSubTitle(e.target.value)} />
                            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => saveSubRename(s.id)}>حفظ</button>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenameSubId(null)}>إلغاء</button>
                          </>
                        ) : (
                          <>
                            {locked ? <b>{s.title}</b> : <Link to={subHref} style={{ flex: 1 }}><b>{s.title}</b></Link>}
                            <span className="qc">
                              {typeof s.question_count === "number" ? `${s.question_count} سؤال` : "درس فرعي"}
                            </span>
                            {canEdit && (
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                <button type="button" className="btn btn-ghost btn-sm" disabled={busy || si === 0} onClick={() => moveSubLesson(l.id, s.id, "up")}>↑</button>
                                <button type="button" className="btn btn-ghost btn-sm" disabled={busy || si === subs.length - 1} onClick={() => moveSubLesson(l.id, s.id, "down")}>↓</button>
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setRenameSubId(s.id); setRenameSubTitle(s.title); }}>تعديل</button>
                                <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--error)" }} disabled={busy} onClick={() => deleteSubLesson(s)}>حذف</button>
                              </div>
                            )}
                            {!locked ? <Link to={subHref} className="ar sm">←</Link> : null}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!lessons.length && (
        <p style={{ color: "var(--text-muted)", marginTop: 16 }}>
          لا توجد دروس.{canEdit ? " اضغط «درس جديد» للبدء." : ""}
        </p>
      )}
    </div>
  );
}
