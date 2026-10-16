import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import client from "../api/client";
import MathText from "../components/MathText";

const LEVEL = { easy: "سهل", medium: "متوسط", hard: "صعب" };

export default function QuestionFolders() {
  const { folderId } = useParams();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [remaining, setRemaining] = useState(20);
  const [detail, setDetail] = useState(null);
  const [newName, setNewName] = useState("");
  const [rename, setRename] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadList() {
    const { data } = await client.get("/question-folders/");
    setList(data.results || []);
    setRemaining(data.remaining ?? 0);
  }

  async function loadDetail(id) {
    const { data } = await client.get(`/question-folders/${id}/`);
    setDetail(data);
    setRename(data.name || "");
  }

  useEffect(() => {
    setLoading(true);
    setMsg("");
    const p = folderId
      ? loadDetail(folderId).then(() => loadList())
      : loadList().then(() => setDetail(null));
    p.catch((e) => setMsg(e.response?.data?.detail || "تعذّر التحميل")).finally(
      () => setLoading(false)
    );
  }, [folderId]);

  async function createFolder() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setMsg("");
    try {
      const { data } = await client.post("/question-folders/", { name });
      setNewName("");
      await loadList();
      navigate(`/question-folders/${data.id}`);
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر الإنشاء");
    } finally {
      setBusy(false);
    }
  }

  async function saveRename() {
    if (!detail || !rename.trim()) return;
    setBusy(true);
    try {
      await client.patch(`/question-folders/${detail.id}/`, {
        name: rename.trim(),
      });
      setMsg("تم تعديل الاسم ✓");
      await loadDetail(detail.id);
      await loadList();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر التعديل");
    } finally {
      setBusy(false);
    }
  }

  async function removeFolder() {
    if (!detail || !confirm(`حذف ملف «${detail.name}»؟`)) return;
    setBusy(true);
    try {
      await client.delete(`/question-folders/${detail.id}/`);
      navigate("/question-folders");
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر الحذف");
    } finally {
      setBusy(false);
    }
  }

  async function removeQuestion(qid) {
    if (!detail) return;
    setBusy(true);
    try {
      await client.delete(`/question-folders/${detail.id}/items/${qid}/`);
      await loadDetail(detail.id);
      await loadList();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر الحذف");
    } finally {
      setBusy(false);
    }
  }

  async function practice(subjectId = null) {
    if (!detail) return;
    setBusy(true);
    setMsg("");
    try {
      const payload = { review_mode: "immediate" };
      if (subjectId) payload.subject_id = subjectId;
      const { data } = await client.post(
        `/question-folders/${detail.id}/practice/`,
        payload
      );
      navigate(`/exam/${data.exam.id}`);
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر بدء التمرين");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="spinner">جاري التحميل…</div>;

  if (folderId && detail) {
    return (
      <div className="q-folders">
        <Link to="/question-folders" className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }}>
          ← كل الملفات
        </Link>
        <div className="q-folders__hero">
          <div>
            <p className="q-folders__eyebrow">ملف أسئلة</p>
            <h1>{detail.name}</h1>
            <p>
              {detail.question_count} سؤال · {detail.subject_count} مادة — كل مادة لوحدها
            </p>
          </div>
          <div className="q-folders__actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !detail.question_count}
              onClick={() => practice(null)}
            >
              حل كل الملف
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ color: "var(--error)" }}
              disabled={busy}
              onClick={removeFolder}
            >
              حذف الملف
            </button>
          </div>
        </div>

        {msg && <div className="banner" style={{ marginBottom: 12 }}>{msg}</div>}

        <div className="card" style={{ padding: 14, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            className="form-control"
            style={{ flex: 1, minWidth: 180 }}
            value={rename}
            onChange={(e) => setRename(e.target.value)}
          />
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={saveRename}>
            حفظ الاسم
          </button>
        </div>

        {(detail.subjects || []).length === 0 && (
          <p style={{ color: "var(--text-muted)" }}>
            الملف فاضي — أثناء حل التجميعات اضغط «احفظ في ملف» على أي سؤال.
          </p>
        )}

        {(detail.subjects || []).map((g) => (
          <section key={g.subject} className="q-folders__subject">
            <div className="q-folders__subject-head">
              <h2>{g.subject_name}</h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() => practice(g.subject)}
              >
                حل أسئلة {g.subject_name} ({g.questions.length})
              </button>
            </div>
            <ul className="q-folders__qlist">
              {g.questions.map((q, i) => (
                <li key={q.question_id} className="card q-folders__q">
                  <div className="q-folders__q-meta">
                    <span>#{i + 1}</span>
                    <span>{LEVEL[q.difficulty] || q.difficulty}</span>
                    {q.question_year ? <span>{q.question_year}</span> : null}
                  </div>
                  <div className="q-folders__q-text">
                    <MathText>{q.text}</MathText>
                  </div>
                  {q.text_image ? (
                    <img src={q.text_image} alt="" style={{ maxWidth: "100%", borderRadius: 8, marginTop: 8 }} />
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: "var(--error)", marginTop: 8 }}
                    disabled={busy}
                    onClick={() => removeQuestion(q.question_id)}
                  >
                    إزالة من الملف
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="q-folders">
      <div className="q-folders__hero">
        <div>
          <p className="q-folders__eyebrow">مراجعتي</p>
          <h1>ملفات الأسئلة المهمة</h1>
          <p>
            أنشئ ملف (حد 20) وعلّم فيه أي سؤال من التجميعات — تراجعه أو تحلّه تاني، وكل مادة جوه الملف لوحدها.
          </p>
        </div>
      </div>

      {msg && <div className="banner" style={{ marginBottom: 12 }}>{msg}</div>}

      {remaining > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            className="form-control"
            style={{ flex: 1, minWidth: 200 }}
            placeholder="اسم الملف الجديد — مثلاً: أسئلة مهمة"
            value={newName}
            maxLength={80}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") createFolder();
            }}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !newName.trim()}
            onClick={createFolder}
          >
            إنشاء ملف
          </button>
          <span style={{ color: "var(--text-muted)", fontSize: 13, alignSelf: "center" }}>
            متبقي {remaining} من 20
          </span>
        </div>
      )}

      {list.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>لسه مفيش ملفات. اعمل أول ملف فوق.</p>
      ) : (
        <div className="q-folders__grid">
          {list.map((f) => (
            <Link key={f.id} to={`/question-folders/${f.id}`} className="card q-folders__card">
              <strong>{f.name}</strong>
              <span>
                {f.question_count} سؤال · {f.subject_count} مادة
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
