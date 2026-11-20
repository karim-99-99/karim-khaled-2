import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import client from "../api/client";
import SectionPanel from "../components/SectionPanel";
import { useAuth } from "../auth/AuthContext";
import { canEditSubject } from "../auth/teacherScope";
import { lockSubjectTheme } from "../theme/subjects";
import useSubjectSkin from "../theme/useSubjectSkin";
import "../styles/lesson-exact.css";

/**
 * تأسيس — داخل الدرس الرئيسي: قائمة العناوين الفرعية مع توسيع أسفل كل عنوان
 * (فيديو / أسئلة / PDF) بدون صفحة جديدة.
 */
export default function LessonDetail() {
  const { lessonId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lesson, setLesson] = useState(null);
  const [sections, setSections] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [renameId, setRenameId] = useState(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [openId, setOpenId] = useState(
    searchParams.get("section") ? Number(searchParams.get("section")) : null
  );
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const canEdit = canEditSubject(user, lesson?.subject);
  const lessonsUrl = lesson?.subject ? `/courses/${lesson.subject}/lessons` : "/courses";
  const { subjectName, logo, skin, key: subjectKey } = useSubjectSkin(lesson?.subject);

  function load() {
    return client.get(`/lessons/${lessonId}/`).then((res) => {
      setLesson(res.data);
      const rows = res.data.sections || [];
      setSections(
        [...rows].sort((a, b) => (a.order_number || 0) - (b.order_number || 0) || a.id - b.id)
      );
      return res.data;
    });
  }

  useEffect(() => {
    load().catch(() => {});
  }, [lessonId]);

  useEffect(() => {
    if (subjectKey && lesson?.subject) lockSubjectTheme(subjectKey);
  }, [subjectKey, lesson?.subject]);

  useEffect(() => {
    const q = searchParams.get("section");
    if (q) setOpenId(Number(q));
  }, [searchParams]);

  function toggleSection(id) {
    const next = openId === id ? null : id;
    setOpenId(next);
    if (next) setSearchParams({ section: String(next) }, { replace: true });
    else setSearchParams({}, { replace: true });
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
      setMsg("تم إضافة العنوان الفرعي ✓");
      await load();
      if (data?.id) toggleSection(data.id);
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
      setMsg("تم تعديل العنوان الفرعي ✓");
      await load();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر التعديل");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSection(id) {
    if (!confirm("حذف هذا العنوان الفرعي وكل واجبه؟")) return;
    try {
      await client.delete(`/lesson-sections/${id}/`);
      if (openId === id) {
        setOpenId(null);
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
        `مسح كل أسئلة الواجب في الدرس «${lesson.title}» (كل العناوين الفرعية)؟\nلا يمكن التراجع.`
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

  const openSection = sections.find((s) => s.id === openId) || null;
  const doneCount = sections.filter((s) => s.has_video || s.bunny_video_id || s.homework_count).length;
  const progressPct = sections.length ? Math.round((100 * doneCount) / sections.length) : 0;

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
          <div><strong>{sections.length}</strong><span>عناوين فرعية</span></div>
          <div><strong>{sections.filter((s) => s.has_video || s.bunny_video_id).length}</strong><span>فيديو</span></div>
          <div><strong>{sections.filter((s) => s.homework_count).length}</strong><span>واجب</span></div>
        </div>
      </div>

      {msg && <div className="banner" style={{ marginBottom: 12 }}>{msg}</div>}

      <div className="layout">
        <div className="sidecol">
          <aside className="side">
            <h3>العناوين الفرعية</h3>
            <div className="pr">أنجزت {doneCount} من {sections.length}</div>
            <div className="pbar"><i style={{ width: `${progressPct}%` }} /></div>
            {sections.map((s) => {
              const on = openId === s.id;
              const done = s.has_video || s.bunny_video_id || s.homework_count;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`st${on ? " on" : ""}${done && !on ? " done" : ""}`}
                  onClick={() => toggleSection(s.id)}
                  style={{ width: "100%", background: "transparent", textAlign: "inherit", cursor: "pointer" }}
                >
                  <span className="n">{done && !on ? "✓" : s.order_number}</span>
                  <div>
                    <b>{s.title}</b>
                    <small>فيديو · واجب · PDF</small>
                  </div>
                  {on ? <span className="tg">الآن</span> : null}
                </button>
              );
            })}
            {canEdit && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAdd((v) => !v)}>
                  {showAdd ? "إلغاء" : "+ عنوان فرعي"}
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

          {openSection ? (
            <>
              <div className="mh">
                <h2><span>العنوان {openSection.order_number}</span>{openSection.title}</h2>
                {canEdit && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setRenameId(openSection.id); setRenameTitle(openSection.title); }}>تعديل الاسم</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => deleteSection(openSection.id)}>حذف</button>
                  </div>
                )}
              </div>
              {renameId === openSection.id && (
                <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  <input className="form-control" style={{ flex: 1 }} value={renameTitle} onChange={(e) => setRenameTitle(e.target.value)} />
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => saveRename(openSection.id)}>حفظ</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenameId(null)}>إلغاء</button>
                </div>
              )}
              <SectionPanel sectionId={openSection.id} onUpdated={() => load()} />
            </>
          ) : (
            <div className="card" style={{ padding: 24, color: "var(--text-muted)" }}>
              اختر عنواناً فرعياً من القائمة لعرض الفيديو والواجب وPDF.
              {canEdit && !sections.length ? " أضف عنواناً فرعياً للبدء." : ""}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
