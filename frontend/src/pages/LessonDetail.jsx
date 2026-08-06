import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import client from "../api/client";
import BackToCourses from "../components/BackToCourses";
import { useAuth } from "../auth/AuthContext";
import { canEditSubject } from "../auth/teacherScope";

/**
 * تأسيس — داخل الدرس الرئيسي: قائمة العناوين الفرعية (الحصص).
 * التجميعات لا تستخدم هذه الصفحة.
 */
export default function LessonDetail() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lesson, setLesson] = useState(null);
  const [sections, setSections] = useState([]);
  const [editTitle, setEditTitle] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [renameId, setRenameId] = useState(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const canEdit = canEditSubject(user, lesson?.subject);
  const lessonsUrl = lesson?.subject ? `/courses/${lesson.subject}/lessons` : "/courses";

  function load() {
    return client.get(`/lessons/${lessonId}/`).then((res) => {
      setLesson(res.data);
      setEditTitle(res.data.title || "");
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

  async function saveLessonTitle() {
    if (!editTitle.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      const { data } = await client.patch(`/lessons/${lessonId}/`, {
        title: editTitle.trim(),
      });
      setLesson(data);
      setSections(data.sections || sections);
      setMsg("تم تعديل اسم الدرس ✓");
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  async function createSection() {
    if (!newSectionTitle.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      await client.post(`/lessons/${lessonId}/sections/`, {
        title: newSectionTitle.trim(),
        order_number: sections.length + 1,
      });
      setNewSectionTitle("");
      setShowAdd(false);
      setMsg("تم إضافة العنوان الفرعي ✓ — ادخل لإضافة فيديو وواجب وPDF");
      await load();
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
          <Link to="/subscription" className="btn btn-primary">
            الاشتراك
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <BackToCourses subjectId={lesson.subject} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(lessonsUrl)}>
          ← العودة للدروس
        </button>
      </div>

      <div className="breadcrumb">
        تأسيس &gt; <span>{lesson.title}</span>
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
            onClick={saveLessonTitle}
          >
            حفظ اسم الدرس
          </button>
        </div>
      ) : (
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>{lesson.title}</h1>
      )}

      <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>
        اختر عنواناً فرعياً (حصة) — داخله الفيديو والواجب وملف PDF إن وُجد.
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
        return (
          <div
            key={s.id}
            className="card"
            style={{
              padding: 16,
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
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
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busy}
                  onClick={() => saveRename(s.id)}
                >
                  حفظ
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenameId(null)}>
                  إلغاء
                </button>
              </>
            ) : (
              <>
                <Link to={`/sections/${s.id}`} style={{ flex: 1, fontWeight: 600 }}>
                  {s.title}
                </Link>
                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  فيديو · واجب · PDF
                </span>
                {canEdit && (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setRenameId(s.id);
                        setRenameTitle(s.title);
                      }}
                    >
                      تعديل الاسم
                    </button>
                    <Link to={`/sections/${s.id}`} className="btn btn-secondary btn-sm">
                      فتح
                    </Link>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => deleteSection(s.id)}
                    >
                      حذف
                    </button>
                  </>
                )}
              </>
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
