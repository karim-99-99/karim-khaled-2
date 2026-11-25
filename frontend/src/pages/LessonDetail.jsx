import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import client from "../api/client";
import SectionPanel from "../components/SectionPanel";
import HomeworkPanel from "../components/HomeworkPanel";
import { useAuth } from "../auth/AuthContext";
import { canEditSubject } from "../auth/teacherScope";
import { lockSubjectTheme } from "../theme/subjects";
import useSubjectSkin from "../theme/useSubjectSkin";
import "../styles/lesson-exact.css";

/**
 * تأسيس — داخل الدرس: عناوين فيديو/PDF + عناوين واجبات عامة (Task 16).
 */
export default function LessonDetail() {
  const { lessonId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lesson, setLesson] = useState(null);
  const [sections, setSections] = useState([]);
  const [hwTitles, setHwTitles] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [showAddHw, setShowAddHw] = useState(false);
  const [newHwTitle, setNewHwTitle] = useState("");
  const [renameId, setRenameId] = useState(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renameHwId, setRenameHwId] = useState(null);
  const [renameHwTitle, setRenameHwTitle] = useState("");
  const [panel, setPanel] = useState(() => {
    if (searchParams.get("hw")) return { type: "hw", id: Number(searchParams.get("hw")) };
    if (searchParams.get("section")) return { type: "section", id: Number(searchParams.get("section")) };
    return { type: null, id: null };
  });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const canEdit = canEditSubject(user, lesson?.subject);
  const lessonsUrl = lesson?.subject ? `/courses/${lesson.subject}/lessons` : "/courses";
  const { subjectName, logo, skin, key: subjectKey } = useSubjectSkin(lesson?.subject);

  function loadHw() {
    return client
      .get(`/homework-sub-lessons/?lesson=${lessonId}`)
      .then((res) => {
        const rows = res.data.results || res.data || [];
        setHwTitles(
          [...rows].sort((a, b) => (a.order_number || 0) - (b.order_number || 0) || a.id - b.id)
        );
      })
      .catch(() => setHwTitles([]));
  }

  function load() {
    return client.get(`/lessons/${lessonId}/`).then((res) => {
      setLesson(res.data);
      const rows = res.data.sections || [];
      setSections(
        [...rows].sort((a, b) => (a.order_number || 0) - (b.order_number || 0) || a.id - b.id)
      );
      return loadHw().then(() => res.data);
    });
  }

  useEffect(() => {
    load().catch(() => {});
  }, [lessonId]);

  useEffect(() => {
    if (subjectKey && lesson?.subject) lockSubjectTheme(subjectKey);
  }, [subjectKey, lesson?.subject]);

  useEffect(() => {
    if (searchParams.get("hw")) {
      setPanel({ type: "hw", id: Number(searchParams.get("hw")) });
    } else if (searchParams.get("section")) {
      setPanel({ type: "section", id: Number(searchParams.get("section")) });
    }
  }, [searchParams]);

  function selectSection(id) {
    setPanel({ type: "section", id });
    setSearchParams({ section: String(id) }, { replace: true });
  }

  function selectHw(id) {
    setPanel({ type: "hw", id });
    setSearchParams({ hw: String(id) }, { replace: true });
  }

  async function createSection() {
    if (!newSectionTitle.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      const { data } = await client.post(`/lessons/${lessonId}/sections/`, {
        title: newSectionTitle.trim(),
        order_number: sections.length + 1,
      });
      setNewSectionTitle("");
      setShowAdd(false);
      setMsg("تم إضافة عنوان الفيديو ✓");
      await load();
      if (data?.id) openSection(data.id);
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر الإضافة");
    } finally {
      setBusy(false);
    }
  }

  async function createHwTitle() {
    if (!newHwTitle.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      const { data } = await client.post("/homework-sub-lessons/", {
        lesson: Number(lessonId),
        title: newHwTitle.trim(),
        order_number: hwTitles.length + 1,
      });
      setNewHwTitle("");
      setShowAddHw(false);
      setMsg("تم إضافة عنوان واجب ✓");
      await load();
      if (data?.id) openHw(data.id);
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر الإضافة");
    } finally {
      setBusy(false);
    }
  }

  async function saveRename(id) {
    if (!renameTitle.trim()) return;
    setBusy(true);
    try {
      await client.patch(`/lesson-sections/${id}/`, { title: renameTitle.trim() });
      setRenameId(null);
      setMsg("تم تعديل العنوان ✓");
      await load();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر التعديل");
    } finally {
      setBusy(false);
    }
  }

  async function saveRenameHw(id) {
    if (!renameHwTitle.trim()) return;
    setBusy(true);
    try {
      await client.patch(`/homework-sub-lessons/${id}/`, { title: renameHwTitle.trim() });
      setRenameHwId(null);
      setMsg("تم تعديل عنوان الواجب ✓");
      await load();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر التعديل");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSection(id) {
    if (!confirm("حذف هذا العنوان (فيديو/PDF)؟")) return;
    try {
      await client.delete(`/lesson-sections/${id}/`);
      if (panel.type === "section" && panel.id === id) {
        setPanel({ type: null, id: null });
        setSearchParams({}, { replace: true });
      }
      setMsg("تم الحذف");
      await load();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر الحذف");
    }
  }

  async function deleteHw(id) {
    if (!confirm("حذف عنوان الواجب؟ الأسئلة تبقى تحت الدرس (بدون عنوان).")) return;
    try {
      await client.delete(`/homework-sub-lessons/${id}/`);
      if (panel.type === "hw" && panel.id === id) {
        setPanel({ type: null, id: null });
        setSearchParams({}, { replace: true });
      }
      setMsg("تم الحذف");
      await load();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر الحذف");
    }
  }

  async function bulkDeleteLessonHomework() {
    if (
      !confirm(
        `مسح كل أسئلة الواجب في الدرس «${lesson.title}»؟\nلا يمكن التراجع.`
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const { data } = await client.post("/homework-questions/bulk-delete/", {
        lesson: Number(lessonId),
      });
      setMsg(`تم مسح ${data.deleted ?? 0} سؤال من واجب هذا الدرس ✓`);
      await load();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر المسح الجماعي");
    } finally {
      setBusy(false);
    }
  }

  if (!lesson) return <div className="spinner">جاري التحميل…</div>;

  if (lesson.schedule_locked && !canEdit) {
    return (
      <div className="lesson-exact" style={skin}>
        <div className="topbar">
          <div className="crumb">دورات <i>‹</i> {subjectName} <i>‹</i> <b>تأسيس</b></div>
          <div className="backs">
            <button type="button" className="back" onClick={() => navigate(lessonsUrl)}>→ العودة للدروس</button>
            <Link className="back" to="/courses">كل المواد</Link>
          </div>
        </div>
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <p style={{ fontSize: 22, marginBottom: 8 }}>🔒</p>
          <h2 style={{ marginBottom: 12 }}>{lesson.title}</h2>
          <p style={{ marginBottom: 16 }}>
            {lesson.lock_label || lesson.detail || "هذا الدرس هيفتح يوم حصتك في جدول مجموعتك."}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => navigate(lessonsUrl)}>
            العودة للدروس
          </button>
        </div>
      </div>
    );
  }

  if (lesson.is_locked && !canEdit) {
    return (
      <div className="lesson-exact" style={skin}>
        <div className="topbar">
          <div className="crumb">دورات <i>‹</i> {subjectName} <i>‹</i> <b>تأسيس</b></div>
          <div className="backs">
            <button type="button" className="back" onClick={() => navigate(lessonsUrl)}>→ العودة للدروس</button>
            <Link className="back" to="/courses">كل المواد</Link>
          </div>
        </div>
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <p style={{ marginBottom: 16 }}>هذا الدرس يتطلب تفعيل الحساب أو الاشتراك.</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate("/subscription")}>الاشتراك</button>
        </div>
      </div>
    );
  }

  const activeSection = panel.type === "section" ? sections.find((s) => s.id === panel.id) : null;
  const activeHw = panel.type === "hw" ? hwTitles.find((s) => s.id === panel.id) : null;
  const hwQuestionTotal = hwTitles.reduce((n, t) => n + (t.question_count || 0), 0);

  return (
    <div className="lesson-exact" style={skin}>
      <div className="topbar">
        <div className="crumb">
          دورات <i>‹</i> {subjectName} <i>‹</i> تأسيس <i>‹</i> <b>{lesson.title}</b>
        </div>
        <div className="backs">
          <button type="button" className="back" onClick={() => navigate(lessonsUrl)}>→ العودة للدروس</button>
          <Link className="back" to="/courses">كل المواد</Link>
        </div>
      </div>

      <div className="hero">
        <img src={logo} alt="" />
        <span className="sep" />
        <div>
          <small>تأسيس · الدرس {lesson.order_number || ""}</small>
          <h1>{lesson.title}</h1>
        </div>
        <div className="hstats">
          <div><strong>{sections.length}</strong><span>عناوين فيديو</span></div>
          <div><strong>{sections.filter((s) => s.has_video || s.bunny_video_id).length}</strong><span>فيديو</span></div>
          <div><strong>{hwTitles.length}</strong><span>واجبات</span></div>
          <div><strong>{hwQuestionTotal}</strong><span>أسئلة واجب</span></div>
        </div>
      </div>

      {msg && <div className="banner" style={{ marginBottom: 12 }}>{msg}</div>}

      <div className="layout">
        <div className="sidecol">
          <aside className="side">
            <h3>فيديو / PDF</h3>
            {sections.map((s) => {
              const on = panel.type === "section" && panel.id === s.id;
              const done = s.has_video || s.bunny_video_id;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`st${on ? " on" : ""}${done && !on ? " done" : ""}`}
                  onClick={() => selectSection(s.id)}
                  style={{ width: "100%", background: "transparent", textAlign: "inherit", cursor: "pointer" }}
                >
                  <span className="n">{done && !on ? "✓" : s.order_number}</span>
                  <div>
                    <b>{s.title}</b>
                    <small>فيديو · PDF</small>
                  </div>
                  {on ? <span className="tg">الآن</span> : null}
                </button>
              );
            })}
            {canEdit && (
              <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={() => setShowAdd((v) => !v)}>
                {showAdd ? "إلغاء" : "+ عنوان فيديو"}
              </button>
            )}

            <h3 style={{ marginTop: 20 }}>الواجبات</h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px" }}>
              مكتبة عامة لكل المجموعات
            </p>
            {hwTitles.map((t) => {
              const on = panel.type === "hw" && panel.id === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`st${on ? " on" : ""}`}
                  onClick={() => selectHw(t.id)}
                  style={{ width: "100%", background: "transparent", textAlign: "inherit", cursor: "pointer" }}
                >
                  <span className="n">{t.order_number}</span>
                  <div>
                    <b>{t.title}</b>
                    <small>{t.question_count || 0} سؤال</small>
                  </div>
                  {on ? <span className="tg">الآن</span> : null}
                </button>
              );
            })}
            {!hwTitles.length && (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>لا عناوين واجب بعد.</p>
            )}
            {canEdit && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAddHw((v) => !v)}>
                  {showAddHw ? "إلغاء" : "+ عنوان واجب"}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--error)" }} disabled={busy} onClick={bulkDeleteLessonHomework}>
                  مسح كل أسئلة الدرس
                </button>
              </div>
            )}
          </aside>
        </div>

        <section className="mainc">
          {canEdit && showAdd && (
            <div className="card" style={{ padding: 16, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input className="form-control" style={{ flex: 1, minWidth: 180 }} placeholder="مثال: السرعة" value={newSectionTitle} onChange={(e) => setNewSectionTitle(e.target.value)} />
              <button type="button" className="btn btn-primary" disabled={busy} onClick={createSection}>حفظ</button>
            </div>
          )}
          {canEdit && showAddHw && (
            <div className="card" style={{ padding: 16, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input className="form-control" style={{ flex: 1, minWidth: 180 }} placeholder="مثال: الممالك الخمس" value={newHwTitle} onChange={(e) => setNewHwTitle(e.target.value)} />
              <button type="button" className="btn btn-primary" disabled={busy} onClick={createHwTitle}>حفظ عنوان الواجب</button>
            </div>
          )}

          {activeSection ? (
            <>
              <div className="mh">
                <h2><span>فيديو {activeSection.order_number}</span>{activeSection.title}</h2>
                {canEdit && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setRenameId(activeSection.id); setRenameTitle(activeSection.title); }}>تعديل الاسم</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => deleteSection(activeSection.id)}>حذف</button>
                  </div>
                )}
              </div>
              {renameId === activeSection.id && (
                <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  <input className="form-control" style={{ flex: 1 }} value={renameTitle} onChange={(e) => setRenameTitle(e.target.value)} />
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => saveRename(activeSection.id)}>حفظ</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenameId(null)}>إلغاء</button>
                </div>
              )}
              <SectionPanel sectionId={activeSection.id} onUpdated={() => load()} />
            </>
          ) : activeHw ? (
            <>
              <div className="mh">
                <h2><span>واجب {activeHw.order_number}</span>{activeHw.title}</h2>
                {canEdit && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setRenameHwId(activeHw.id); setRenameHwTitle(activeHw.title); }}>تعديل الاسم</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => deleteHw(activeHw.id)}>حذف</button>
                  </div>
                )}
              </div>
              {renameHwId === activeHw.id && (
                <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  <input className="form-control" style={{ flex: 1 }} value={renameHwTitle} onChange={(e) => setRenameHwTitle(e.target.value)} />
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => saveRenameHw(activeHw.id)}>حفظ</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenameHwId(null)}>إلغاء</button>
                </div>
              )}
              <HomeworkPanel
                subjectId={lesson.subject}
                lessonId={Number(lessonId)}
                homeworkSubLessonId={activeHw.id}
                onUpdated={() => loadHw()}
              />
            </>
          ) : (
            <div className="card" style={{ padding: 24, color: "var(--text-muted)" }}>
              اختر عنوان فيديو أو عنوان واجب من القائمة.
              {canEdit && !sections.length && !hwTitles.length ? " أضف عنواناً للبدء." : ""}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
