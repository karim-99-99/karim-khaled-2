import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import client from "../api/client";
import BackToCourses from "../components/BackToCourses";
import SectionPanel from "../components/SectionPanel";
import { useAuth } from "../auth/AuthContext";
import { canEditSubject } from "../auth/teacherScope";

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

  if (!lesson) return <div className="spinner">جاري التحميل…</div>;

  if (lesson.is_locked && !canEdit) {
    return (
      <div>
        <BackToCourses subjectId={lesson.subject} />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ marginBottom: 12 }}
          onClick={() => navigate(lessonsUrl)}
        >
          ← العودة للدروس
        </button>
        <h1 style={{ fontSize: 28, marginBottom: 16 }}>{lesson.title}</h1>
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <p style={{ marginBottom: 16 }}>هذا الدرس يتطلب تفعيل الحساب أو الاشتراك.</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate("/subscription")}>
            الاشتراك
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <BackToCourses subjectId={lesson.subject} />
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        style={{ marginBottom: 12 }}
        onClick={() => navigate(lessonsUrl)}
      >
        ← العودة للدروس
      </button>

      <div className="breadcrumb">
        تأسيس &gt; <span>{lesson.title}</span>
      </div>

      <h1 style={{ fontSize: 28, marginBottom: 8 }}>{lesson.title}</h1>

      <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>
        اضغط على عنوان فرعي لإضافة أو مشاهدة الفيديو والأسئلة وملف PDF أسفله مباشرة.
      </p>

      {canEdit && (
        <div className="banner" style={{ marginBottom: 16 }}>
          التأسيس فقط: أضف عناوين فرعية تحت الدرس. التجميعات تبقى دروساً رئيسية بدون عناوين فرعية.
        </div>
      )}

      {msg && (
        <div className="banner" style={{ marginBottom: 12 }}>
          {msg}
        </div>
      )}

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
          العناوين الفرعية
        </div>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? "إلغاء" : "+ عنوان فرعي"}
          </button>
        )}
      </div>

      {canEdit && showAdd && (
        <div className="card" style={{ padding: 16, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            className="form-control"
            style={{ flex: 1, minWidth: 200 }}
            placeholder="مثال: السرعة"
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.target.value)}
          />
          <button type="button" className="btn btn-primary" disabled={busy} onClick={createSection}>
            حفظ
          </button>
        </div>
      )}

      {sections.map((s) => {
        const renaming = renameId === s.id;
        const open = openId === s.id;
        return (
          <div key={s.id} className="card" style={{ padding: 0, marginBottom: 10, overflow: "hidden" }}>
            <div
              style={{
                padding: 16,
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                cursor: renaming ? "default" : "pointer",
                background: open ? "var(--primary-light)" : undefined,
              }}
              onClick={() => {
                if (!renaming) toggleSection(s.id);
              }}
            >
              <span className="lesson-num lesson-num--sm" aria-hidden="true">
                {s.order_number}
              </span>
              {renaming ? (
                <>
                  <input
                    className="form-control"
                    style={{ flex: 1, minWidth: 160 }}
                    value={renameTitle}
                    onChange={(e) => setRenameTitle(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation();
                      saveRename(s.id);
                    }}
                  >
                    حفظ
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenameId(null);
                    }}
                  >
                    إلغاء
                  </button>
                </>
              ) : (
                <>
                  <strong style={{ flex: 1 }}>{s.title}</strong>
                  <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                    {open ? "▲ إغلاق" : "▼ فيديو · أسئلة · PDF"}
                  </span>
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameId(s.id);
                          setRenameTitle(s.title);
                        }}
                      >
                        تعديل الاسم
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSection(s.id);
                        }}
                      >
                        حذف
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
            {open && (
              <div
                style={{
                  padding: 16,
                  borderTop: "1px solid var(--border)",
                  background: "#fff",
                }}
              >
                <SectionPanel sectionId={s.id} onUpdated={() => load()} />
              </div>
            )}
          </div>
        );
      })}

      {sections.length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>
          لا توجد عناوين فرعية بعد.
          {canEdit ? " اضغط «عنوان فرعي» للبدء." : ""}
        </p>
      )}
    </div>
  );
}
