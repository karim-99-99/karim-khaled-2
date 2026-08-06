import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { canEditSubject } from "../auth/teacherScope";
import client from "../api/client";
import BackToCourses from "../components/BackToCourses";

export default function Lessons() {
  const { subjectId } = useParams();
  const { user } = useAuth();
  const [lessons, setLessons] = useState([]);
  const [msg, setMsg] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [renameId, setRenameId] = useState(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const canEdit = canEditSubject(user, subjectId);
  const freeTier = user?.role === "student" && !user?.has_active_subscription;

  function load() {
    client.get(`/subjects/${subjectId}/lessons/`).then((res) => {
      const rows = res.data.results || res.data || [];
      setLessons(
        [...rows].sort((a, b) => (a.order_number || 0) - (b.order_number || 0) || a.id - b.id)
      );
    });
  }

  useEffect(load, [subjectId]);

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
      setMsg("تم إنشاء الدرس ✓ — ادخل لإضافة عناوين فرعية (حصص)");
      load();
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
      load();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر التعديل");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <BackToCourses subjectId={subjectId} />
      <div className="breadcrumb">دورات &gt; <span>تأسيس</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>تأسيس — الدروس</h1>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? "إلغاء" : "+ درس جديد"}
          </button>
        )}
      </div>

      {canEdit && (
        <div className="banner" style={{ marginBottom: 16 }}>
          تأسيس: درس رئيسي ← عناوين فرعية ← فيديو وواجب وPDF.
        </div>
      )}

      {freeTier && (
        <div className="banner" style={{ marginBottom: 16 }}>
          المعاينة المجانية: يمكنك مشاهدة أول درس فقط وحل أول ١٠ أسئلة —
          الرجاء التواصل مع الإدارة لتفعيل الحساب بالكامل.
        </div>
      )}

      {msg && <div className="banner" style={{ marginBottom: 12 }}>{msg}</div>}

      {canEdit && showAdd && (
        <div className="card" style={{ padding: 16, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            className="form-control"
            style={{ flex: 1, minWidth: 200 }}
            placeholder="عنوان الدرس الجديد"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button type="button" className="btn btn-primary" disabled={busy} onClick={createLesson}>
            حفظ الدرس
          </button>
        </div>
      )}

      {lessons.map((l) => {
        const locked = l.is_locked && !canEdit;
        const renaming = renameId === l.id;

        return (
          <div
            key={l.id}
            className="card"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: 16,
              marginBottom: 12,
              flexWrap: "wrap",
              opacity: locked ? 0.65 : 1,
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
                <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => saveRename(l.id)}>
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
                  <Link to={`/lessons/${l.id}`} style={{ flex: 1, fontWeight: 600 }}>
                    {l.title}
                  </Link>
                )}

                {l.is_free_preview || l.order_number === 1 ? (
                  <span className="badge badge-active">مجاني</span>
                ) : locked ? (
                  <span className="badge badge-expired">يتطلب تفعيل</span>
                ) : null}

                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  {locked ? "مقفل" : "عناوين فرعية · فيديو · واجب"}
                </span>

                {canEdit && (
                  <>
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
                    <Link to={`/lessons/${l.id}`} className="btn btn-secondary btn-sm">
                      فتح وتحرير
                    </Link>
                  </>
                )}
              </>
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
