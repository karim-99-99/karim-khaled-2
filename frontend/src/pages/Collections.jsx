import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { canEditSubject } from "../auth/teacherScope";
import client from "../api/client";
import BackToCourses from "../components/BackToCourses";

/**
 * تجميعات — قائمة دروس مع دروس فرعية ظاهرة تحت كل درس (بدون الدخول للدرس الرئيسي أولاً).
 * زر + بجانب الدرس لإضافة درس فرعي · الضغط على الفرعي يدخل لإضافة الأسئلة.
 * إن لم يكن للدرس فروع: الضغط على الدرس يدخل مباشرة لإضافة الأسئلة.
 */
export default function Collections() {
  const { subjectId } = useParams();
  const { user } = useAuth();
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
    <div>
      <BackToCourses subjectId={subjectId} />
      <div className="breadcrumb">دورات &gt; <span>تجميع</span></div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <h1 style={{ fontSize: 28, margin: 0 }}>التجميعات — الدروس</h1>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? "إلغاء" : "+ درس جديد"}
          </button>
        )}
      </div>

      <div className="banner" style={{ marginBottom: 16 }}>
        {canEdit
          ? "أسئلة التجميع تظهر لكل طلاب المادة. اضغط + بجانب أي درس لإضافة دروس فرعية تظهر هنا مباشرة — أو ادخل للدرس لإضافة الأسئلة بدون فروع."
          : "اختر درساً أو درساً فرعياً للتدريب، أو خصّص مواداً ودروساً وسنة ومدة من الإعداد الكامل."}
      </div>

      {!canEdit && (
        <div style={{ marginBottom: 16 }}>
          <Link
            to={`/tests/simulator/${subjectId}?from=collections`}
            className="btn btn-primary"
          >
            تدريب مخصص (مواد · دروس · سنة · مدة) ←
          </Link>
        </div>
      )}

      {freeTier && (
        <div className="banner" style={{ marginBottom: 16 }}>
          المعاينة المجانية: أول درس فقط بحد أقصى ١٠ أسئلة —
          <Link to="/subscription"> اشترك الآن</Link>
        </div>
      )}

      {msg && (
        <div className="banner" style={{ marginBottom: 12 }}>
          {msg}
        </div>
      )}

      {canEdit && showAdd && (
        <div className="card" style={{ padding: 16, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            className="form-control"
            style={{ flex: 1, minWidth: 200 }}
            placeholder="اسم الدرس الجديد"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") createLesson();
            }}
          />
          <button type="button" className="btn btn-primary" disabled={busy} onClick={createLesson}>
            حفظ الدرس
          </button>
        </div>
      )}

      {lessons.map((l) => {
        const locked = l.is_locked && !canEdit;
        const renaming = renameId === l.id;
        const subs = subsByLesson[l.id] || [];
        const lessonHref = `/courses/${subjectId}/collections/${l.id}`;

        return (
          <div key={l.id} style={{ marginBottom: 16 }}>
            <div
              className="card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 16,
                marginBottom: 0,
                flexWrap: "wrap",
                opacity: locked ? 0.65 : 1,
                borderBottomLeftRadius: subs.length || addingSubFor === l.id ? 0 : undefined,
                borderBottomRightRadius: subs.length || addingSubFor === l.id ? 0 : undefined,
              }}
            >
              <span className="lesson-num" aria-hidden="true">
                {l.order_number}
              </span>

              {renaming ? (
                <>
                  <input
                    className="form-control"
                    style={{ flex: 1, minWidth: 180 }}
                    value={renameTitle}
                    onChange={(e) => setRenameTitle(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={() => saveRename(l.id)}
                  >
                    حفظ
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenameId(null)}>
                    إلغاء
                  </button>
                </>
              ) : (
                <>
                  {locked ? (
                    <span style={{ flex: 1, fontWeight: 600 }}>{l.title}</span>
                  ) : (
                    <Link to={lessonHref} style={{ flex: 1, fontWeight: 600 }}>
                      {l.title}
                      {subs.length > 0 ? (
                        <span style={{ color: "var(--text-muted)", fontWeight: 500, fontSize: 13, marginInlineStart: 8 }}>
                          ({subs.length} فرعي)
                        </span>
                      ) : null}
                    </Link>
                  )}

                  {freeTier && (l.is_free_preview || l.order_number === 1) ? (
                    <span className="badge badge-active">مجاني</span>
                  ) : locked ? (
                    <span className="badge badge-expired">يتطلب تفعيل</span>
                  ) : null}

                  <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                    {locked
                      ? "مقفل"
                      : subs.length
                        ? "اضغط درساً فرعياً للأسئلة — أو الدرس للأسئلة العامة"
                        : "أسئلة · فيديو · صور · سهل/متوسط/صعب"}
                  </span>

                  {canEdit && (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy}
                        title="إضافة درس فرعي"
                        onClick={() => {
                          setAddingSubFor((cur) => (cur === l.id ? null : l.id));
                          setNewSubTitle("");
                          setRenameSubId(null);
                        }}
                      >
                        {addingSubFor === l.id ? "إلغاء" : "+"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={busy}
                        onClick={() => moveLesson(l.id, "up")}
                        title="للأعلى"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={busy}
                        onClick={() => moveLesson(l.id, "down")}
                        title="للأسفل"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setRenameId(l.id);
                          setRenameTitle(l.title);
                        }}
                      >
                        تعديل الاسم
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: "var(--error)" }}
                        disabled={busy}
                        onClick={() => deleteLesson(l.id, l.title)}
                      >
                        حذف
                      </button>
                      <Link to={lessonHref} className="btn btn-secondary btn-sm">
                        فتح الدرس
                      </Link>
                    </>
                  )}
                </>
              )}
            </div>

            {(subs.length > 0 || (canEdit && addingSubFor === l.id)) && (
              <div
                style={{
                  marginInlineStart: 20,
                  borderInlineStart: "3px solid var(--border, #e5e7eb)",
                  paddingInlineStart: 12,
                  paddingTop: 8,
                  paddingBottom: 4,
                }}
              >
                {canEdit && addingSubFor === l.id && (
                  <div
                    className="card"
                    style={{
                      padding: 12,
                      marginBottom: 8,
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      background: "var(--surface-2, #f8fafc)",
                    }}
                  >
                    <input
                      className="form-control"
                      style={{ flex: 1, minWidth: 180 }}
                      placeholder="اسم درس فرعي (مثال: السرعة)"
                      value={newSubTitle}
                      autoFocus
                      onChange={(e) => setNewSubTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") createSubLesson(l.id);
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busy || !newSubTitle.trim()}
                      onClick={() => createSubLesson(l.id)}
                    >
                      حفظ الفرعي
                    </button>
                  </div>
                )}

                {subs.map((s, si) => {
                  const subHref = `/courses/${subjectId}/collections/${l.id}/sub/${s.id}`;
                  const renamingSub = renameSubId === s.id;
                  return (
                    <div
                      key={s.id}
                      className="card"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "12px 14px",
                        marginBottom: 8,
                        flexWrap: "wrap",
                        opacity: locked ? 0.65 : 1,
                      }}
                    >
                      <span className="lesson-num lesson-num--sm" aria-hidden="true">
                        {s.order_number || si + 1}
                      </span>
                      {renamingSub ? (
                        <>
                          <input
                            className="form-control"
                            style={{ flex: 1, minWidth: 160 }}
                            value={renameSubTitle}
                            onChange={(e) => setRenameSubTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveSubRename(s.id);
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={busy}
                            onClick={() => saveSubRename(s.id)}
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
                          {locked ? (
                            <span style={{ flex: 1, fontWeight: 600 }}>{s.title}</span>
                          ) : (
                            <Link to={subHref} style={{ flex: 1, fontWeight: 600 }}>
                              {s.title}
                            </Link>
                          )}
                          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                            {typeof s.question_count === "number"
                              ? `${s.question_count} سؤال`
                              : "درس فرعي"}
                          </span>
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                disabled={busy || si === 0}
                                onClick={() => moveSubLesson(l.id, s.id, "up")}
                                title="للأعلى"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                disabled={busy || si === subs.length - 1}
                                onClick={() => moveSubLesson(l.id, s.id, "down")}
                                title="للأسفل"
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                  setRenameSubId(s.id);
                                  setRenameSubTitle(s.title);
                                }}
                              >
                                تعديل
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ color: "var(--error)" }}
                                disabled={busy}
                                onClick={() => deleteSubLesson(s)}
                              >
                                حذف
                              </button>
                              <Link to={subHref} className="btn btn-secondary btn-sm">
                                فتح وإضافة أسئلة
                              </Link>
                            </>
                          )}
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

      {lessons.length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>
          لا توجد دروس.{canEdit ? " اضغط «درس جديد» للبدء." : ""}
        </p>
      )}
    </div>
  );
}
