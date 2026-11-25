import { useEffect, useState } from "react";
import client from "../api/client";
import MathText from "./MathText";
import TeacherQuestionForm from "./TeacherQuestionForm";
import QuestionImportPanel from "./QuestionImportPanel";
import QuestionOrderNumber from "./QuestionOrderNumber";
import { useAuth } from "../auth/AuthContext";
import { canEditSubject } from "../auth/teacherScope";

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

/** Questions under one homework title (global library — Task 16). */
export default function HomeworkPanel({
  subjectId,
  lessonId,
  homeworkSubLessonId,
  onUpdated,
}) {
  const { user } = useAuth();
  const canEdit = canEditSubject(user, subjectId);
  const freeTier = user?.role === "student" && !user?.has_active_subscription;

  const [rows, setRows] = useState([]);
  const [hwIndex, setHwIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showAddQ, setShowAddQ] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingQ, setEditingQ] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    const url = canEdit
      ? `/homework-questions/?homework_sub_lesson=${homeworkSubLessonId}`
      : `/my-homework/?homework_sub_lesson=${homeworkSubLessonId}`;
    return client
      .get(url)
      .then(async (res) => {
        const list = sortByOrder(res.data.results || res.data || []);
        setRows(list);
        setHwIndex(0);
        if (!canEdit && list.length) {
          try {
            const ids = list.map((q) => q.id).join(",");
            const prog = await client.get(
              `/practice-answers/?kind=homework&question_ids=${ids}`
            );
            const map = prog.data.answers || {};
            const next = {};
            Object.entries(map).forEach(([qid, row]) => {
              next[Number(qid)] = row.selected_answer;
            });
            setAnswers(next);
          } catch {
            setAnswers({});
          }
        } else {
          setAnswers({});
        }
      })
      .catch(() => setRows([]));
  }

  useEffect(() => {
    setMsg("");
    setShowAddQ(false);
    setShowImport(false);
    setEditingQ(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeworkSubLessonId, subjectId, canEdit, user?.id]);

  async function persistOrder(nextList) {
    setBusy(true);
    try {
      await client.post("/homework-questions/reorder/", {
        lesson: Number(lessonId),
        homework_sub_lesson: Number(homeworkSubLessonId),
        ordered_ids: nextList.map((q) => q.id),
      });
      setRows(nextList.map((q, i) => ({ ...q, order_number: i + 1 })));
      onUpdated?.();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر إعادة الترتيب");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function deleteQuestion(id) {
    if (!confirm("حذف هذا السؤال؟")) return;
    try {
      await client.delete(`/homework-questions/${id}/`);
      setMsg("تم الحذف");
      await load();
      onUpdated?.();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر الحذف");
    }
  }

  async function bulkDelete() {
    if (!confirm("مسح كل أسئلة هذا العنوان؟")) return;
    setBusy(true);
    try {
      const { data } = await client.post("/homework-questions/bulk-delete/", {
        homework_sub_lesson: Number(homeworkSubLessonId),
      });
      setMsg(`تم مسح ${data.deleted ?? 0} سؤال ✓`);
      await load();
      onUpdated?.();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر المسح");
    } finally {
      setBusy(false);
    }
  }

  async function approveQuestion(id) {
    try {
      await client.patch(`/homework-questions/${id}/`, {
        needs_review: false,
        review_notes: "",
      });
      await load();
      onUpdated?.();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر الاعتماد");
    }
  }

  const current = rows[hwIndex];
  const reviewCount = rows.filter((q) => q.needs_review).length;

  return (
    <div>
      {msg && <div className="banner" style={{ marginBottom: 12 }}>{msg}</div>}
      {freeTier && (
        <div className="banner" style={{ marginBottom: 12 }}>
          معاينة مجانية: أول ١٠ أسئلة فقط حتى يتم تفعيل حسابك.
        </div>
      )}

      {canEdit && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setShowImport((v) => !v);
              setShowAddQ(false);
              setEditingQ(null);
            }}
          >
            {showImport ? "إخفاء الرفع" : "⬆ رفع ملف Word"}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setEditingQ(null);
              setShowImport(false);
              setShowAddQ((v) => !v);
            }}
          >
            {showAddQ && !editingQ ? "إخفاء النموذج" : "+ إضافة سؤال واجب"}
          </button>
          {rows.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ color: "var(--error)" }}
              disabled={busy}
              onClick={bulkDelete}
            >
              مسح كل أسئلة هذا العنوان
            </button>
          )}
          <span style={{ color: "var(--text-muted)", alignSelf: "center", fontSize: 13 }}>
            عدد الأسئلة: {rows.length}
            {reviewCount > 0 ? ` · ${reviewCount} بانتظار المراجعة` : ""}
            {" · للجميع"}
          </span>
        </div>
      )}

      {canEdit && showImport && (
        <QuestionImportPanel
          importUrl="/homework-questions/import/"
          lessonId={lessonId}
          homeworkSubLessonId={homeworkSubLessonId}
          templateDownloadName="نموذج-أسئلة-الواجبات.docx"
          onImported={(data) => {
            setMsg(
              `تم استيراد ${data.created} سؤال ✓` +
                (data.summary?.needs_review
                  ? ` — منها ${data.summary.needs_review} بحاجة لمراجعتك`
                  : "")
            );
            setShowImport(false);
            load();
            onUpdated?.();
          }}
        />
      )}

      {canEdit && (showAddQ || editingQ) && (
        <TeacherQuestionForm
          subjectId={subjectId}
          lessonId={lessonId}
          homeworkSubLessonId={homeworkSubLessonId}
          kind="homework"
          initialQuestion={editingQ}
          onCancel={() => {
            setEditingQ(null);
            setShowAddQ(false);
          }}
          onSaved={() => {
            load();
            setShowAddQ(false);
            setEditingQ(null);
            setMsg(editingQ ? "تم تعديل السؤال ✓" : "تم إضافة السؤال ✓");
            onUpdated?.();
          }}
        />
      )}

      {canEdit && rows.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {rows.map((item, i) => (
            <div key={item.id} className="card" style={{ padding: 12, marginTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <QuestionOrderNumber
                      value={i + 1}
                      disabled={busy}
                      onCommit={(pos) => persistOrder(moveToPosition(rows, item.id, pos))}
                    />
                    {item.needs_review ? (
                      <span className="badge badge-expired">مراجعة</span>
                    ) : null}
                  </div>
                  <MathText text={item.text} />
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-start" }}>
                  {item.needs_review && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => approveQuestion(item.id)}>
                      اعتماد
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setEditingQ(item);
                      setShowAddQ(true);
                      setShowImport(false);
                    }}
                  >
                    تعديل
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--error)" }} onClick={() => deleteQuestion(item.id)}>
                    حذف
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!canEdit && current && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ marginBottom: 8, color: "var(--text-muted)", fontSize: 13 }}>
            سؤال {hwIndex + 1} من {rows.length}
          </div>
          <MathText text={current.text} />
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {(current.options || []).map((o) => (
              <label key={o.key} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <input
                  type="radio"
                  name={`hw-${current.id}`}
                  checked={answers[current.id] === o.key}
                  onChange={async () => {
                    setAnswers((a) => ({ ...a, [current.id]: o.key }));
                    try {
                      await client.post("/practice-answers/", {
                        kind: "homework",
                        question_id: current.id,
                        selected_answer: o.key,
                      });
                    } catch {
                      /* keep local selection even if save fails */
                    }
                  }}
                />
                <span>
                  <strong>{o.key})</strong> <MathText text={o.text} />
                </span>
              </label>
            ))}
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={hwIndex <= 0}
              onClick={() => setHwIndex((i) => Math.max(0, i - 1))}
            >
              السابق
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={hwIndex >= rows.length - 1}
              onClick={() => setHwIndex((i) => Math.min(rows.length - 1, i + 1))}
            >
              التالي
            </button>
          </div>
        </div>
      )}

      {!rows.length && !showAddQ && !showImport && (
        <p style={{ color: "var(--text-muted)" }}>
          {canEdit ? "لا أسئلة بعد — أضف سؤالًا أو ارفع ملفًا." : "لا أسئلة في هذا العنوان."}
        </p>
      )}
    </div>
  );
}
