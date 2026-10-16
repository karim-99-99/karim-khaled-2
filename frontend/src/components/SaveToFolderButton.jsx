import { useEffect, useState } from "react";
import client from "../api/client";

/**
 * زر تعليم السؤال وحفظه في ملف أسئلة مهمة (حد 20 ملف).
 */
export default function SaveToFolderButton({ questionId, compact = false }) {
  const [open, setOpen] = useState(false);
  const [folders, setFolders] = useState([]);
  const [folderIds, setFolderIds] = useState([]);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [newName, setNewName] = useState("");

  const saved = folderIds.length > 0;

  async function loadMembership() {
    if (!questionId) return;
    try {
      const { data } = await client.get(
        `/question-folders/membership/?question=${questionId}`
      );
      setFolders(data.folders || []);
      setFolderIds(data.folder_ids || []);
      setRemaining(data.remaining_slots ?? 0);
    } catch {
      setFolders([]);
      setFolderIds([]);
    }
  }

  useEffect(() => {
    if (open) loadMembership();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, questionId]);

  async function toggleFolder(folder) {
    if (!questionId || busy) return;
    setBusy(true);
    setMsg("");
    try {
      if (folder.contains) {
        await client.delete(
          `/question-folders/${folder.id}/items/${questionId}/`
        );
        setMsg(`اتشال من «${folder.name}»`);
      } else {
        await client.post(`/question-folders/${folder.id}/items/`, {
          question_id: questionId,
        });
        setMsg(`اتحفظ في «${folder.name}» ✓`);
      }
      await loadMembership();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  async function createAndSave() {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    setMsg("");
    try {
      const { data: folder } = await client.post("/question-folders/", { name });
      await client.post(`/question-folders/${folder.id}/items/`, {
        question_id: questionId,
      });
      setNewName("");
      setMsg(`اتعمل ملف «${folder.name}» واتحفظ السؤال ✓`);
      await loadMembership();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر إنشاء الملف");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="save-folder">
      <button
        type="button"
        className={`btn btn-sm ${saved ? "btn-primary" : "btn-secondary"}`}
        onClick={() => setOpen((v) => !v)}
        title="احفظ السؤال في ملف للمراجعة"
      >
        {saved ? "★ محفوظ" : compact ? "★ احفظ" : "★ احفظ في ملف"}
      </button>

      {open && (
        <div className="save-folder__panel card">
          <div className="save-folder__head">
            <strong>ملفات الأسئلة المهمة</strong>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setOpen(false)}
            >
              إغلاق
            </button>
          </div>
          <p className="save-folder__hint">
            علّم السؤال في ملف عشان تراجعه أو تحلّه تاني — كل مادة جوه الملف لوحدها.
          </p>

          {folders.length === 0 && (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
              لسه مفيش ملفات — اعمل ملف جديد تحت.
            </p>
          )}

          <ul className="save-folder__list">
            {folders.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className={`save-folder__row ${f.contains ? "is-on" : ""}`}
                  disabled={busy}
                  onClick={() => toggleFolder(f)}
                >
                  <span>{f.contains ? "★" : "☆"}</span>
                  <span className="save-folder__name">{f.name}</span>
                  <span className="save-folder__count">{f.question_count}</span>
                </button>
              </li>
            ))}
          </ul>

          {remaining > 0 ? (
            <div className="save-folder__create">
              <input
                className="form-control"
                placeholder="اسم ملف جديد (مثلاً: أسئلة مهمة)"
                value={newName}
                maxLength={80}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createAndSave();
                }}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy || !newName.trim()}
                onClick={createAndSave}
              >
                أنشئ واحفظ
              </button>
              <span className="save-folder__slots">متبقي {remaining} ملف</span>
            </div>
          ) : (
            <p className="save-folder__slots">وصلت لحد 20 ملف — احذف من صفحة الملفات.</p>
          )}

          {msg && <div className="banner" style={{ marginTop: 10 }}>{msg}</div>}
        </div>
      )}
    </div>
  );
}
