import { useEffect, useState } from "react";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";
import EquationEditor from "../components/EquationEditor";
import ImagePicker from "../components/ImagePicker";
import MathText from "../components/MathText";
import { TEACHER_TIERS } from "../constants/teacherTiers";

const OPTION_KEYS = ["أ", "ب", "ج", "د"];

function emptyOptions() {
  return OPTION_KEYS.map((k) => ({ key: k, text: "", image: "" }));
}

export default function QuestionEditor() {
  const { user, refreshUser } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [creatingLesson, setCreatingLesson] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState("");
  const [pickSubject, setPickSubject] = useState("");

  const [form, setForm] = useState({
    lesson: "",
    difficulty: "medium",
    kind: "collection",
    teacher_tier: "",
    question_year: "",
    text: "",
    text_image: "",
    options: emptyOptions(),
    correct_answer: "أ",
    explanation: "",
    explanation_image: "",
    video_bunny_id: "",
    video_timing: "after",
  });

  const subjectId = user?.taught_subject;
  const subjectName = user?.taught_subject_name;
  const selectedLesson = lessons.find((l) => String(l.id) === String(form.lesson));

  useEffect(() => {
    client.get("/subjects/").then((res) => setSubjects(res.data.results || res.data));
  }, []);

  function loadLessons() {
    if (!subjectId) return;
    client.get(`/subjects/${subjectId}/lessons/`).then((res) => {
      const rows = res.data.results || res.data;
      setLessons(Array.isArray(rows) ? rows : []);
    });
  }
  useEffect(loadLessons, [subjectId]);

  useEffect(() => {
    if (!form.lesson) {
      setList([]);
      return;
    }
    const url =
      form.kind === "homework"
        ? `/homework-questions/?lesson=${form.lesson}`
        : `/collection-questions/?lesson=${form.lesson}`;
    client
      .get(url)
      .then((res) => setList(res.data.results || res.data || []))
      .catch(() => setList([]));
  }, [form.lesson, form.kind, msg]);

  async function setMySubject() {
    if (!pickSubject) return;
    await client.patch("/auth/me/", { taught_subject: Number(pickSubject) });
    await refreshUser();
  }

  async function createLesson() {
    if (!newLessonTitle.trim()) return;
    setMsg("");
    try {
      const { data } = await client.post("/lessons/", {
        subject: subjectId,
        title: newLessonTitle.trim(),
        order_number: lessons.length + 1,
      });
      setNewLessonTitle("");
      setCreatingLesson(false);
      setForm((f) => ({ ...f, lesson: String(data.id) }));
      loadLessons();
      setMsg("تم إنشاء الدرس ✓ — يظهر في قائمة دروس المادة للطلبة");
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر إنشاء الدرس");
    }
  }

  async function renameLesson() {
    if (!form.lesson || !renameTitle.trim()) return;
    setMsg("");
    try {
      await client.patch(`/lessons/${form.lesson}/`, { title: renameTitle.trim() });
      setRenaming(false);
      loadLessons();
      setMsg("تم تعديل اسم الدرس ✓");
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر تعديل اسم الدرس");
    }
  }

  function setOption(i, patch) {
    setForm((f) => {
      const options = [...f.options];
      options[i] = { ...options[i], ...patch };
      return { ...f, options };
    });
  }

  async function save() {
    setMsg("");
    if (!form.lesson) {
      setMsg("اختر الدرس أو أنشئ درساً جديداً");
      return;
    }
    if (!form.text.trim() && !form.text_image) {
      setMsg("اكتب نص السؤال أو أضف صورة له");
      return;
    }
    if (form.kind === "collection" && !form.teacher_tier) {
      setMsg("اختر ترشيح المدرس (ذهبي / فضي / برونزي)");
      return;
    }
    const url = form.kind === "homework" ? "/homework-questions/" : "/collection-questions/";
    const payload = {
      subject: subjectId,
      lesson: Number(form.lesson),
      difficulty: form.difficulty,
      text: form.text,
      text_image: form.text_image || "",
      options: form.options.map((o) => ({
        key: o.key,
        text: o.text,
        image: o.image || "",
      })),
      correct_answer: form.correct_answer,
      explanation: form.explanation || "",
      explanation_image: form.explanation_image || "",
      written_correction: form.explanation || "",
      video_bunny_id: form.video_bunny_id,
      video_timing: form.video_timing,
    };
    if (form.kind === "collection") {
      payload.question_year = (form.question_year || "").trim();
      payload.teacher_tier = form.teacher_tier;
    }
    try {
      await client.post(url, payload);
      setMsg("تم حفظ السؤال ✓ — سيظهر للطلبة في مجموعاتك لنفس المادة");
      setForm((f) => ({
        ...f,
        text: "",
        text_image: "",
        options: emptyOptions(),
        correct_answer: "أ",
        explanation: "",
        explanation_image: "",
        video_bunny_id: "",
      }));
    } catch (e) {
      const detail = e.response?.data;
      setMsg(
        (typeof detail === "object" && (detail.detail || JSON.stringify(detail))) ||
          "تعذّر الحفظ"
      );
    }
  }

  if (!subjectId) {
    return (
      <div className="card form-card">
        <h2 style={{ marginBottom: 16 }}>حدد مادتك</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>
          اختر المادة التي تدرّسها لتتمكن من إنشاء الدروس والأسئلة.
        </p>
        <select
          className="form-control"
          value={pickSubject}
          onChange={(e) => setPickSubject(e.target.value)}
        >
          <option value="">اختر المادة</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={setMySubject}>
          حفظ
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>محرر الأسئلة</h1>
      <div className="banner" style={{ marginBottom: 20 }}>
        مادتك: <strong>{subjectName}</strong> — تأكد أن المدير أضافك كمدرس لهذه المادة في
        المجموعة حتى تظهر أسئلتك للطلبة. الدروس مشتركة لكل طلبة المادة.
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div className="card" style={{ padding: 24 }}>
          <div className="form-group">
            <label>نوع السؤال</label>
            <div className="filter-row">
              <span
                className={`chip ${form.kind === "collection" ? "active" : ""}`}
                onClick={() => setForm((f) => ({ ...f, kind: "collection" }))}
              >
                تجميعات / اختبارات
              </span>
              <span
                className={`chip ${form.kind === "homework" ? "active" : ""}`}
                onClick={() => setForm((f) => ({ ...f, kind: "homework" }))}
              >
                واجب
              </span>
            </div>
          </div>

          <div className="form-group">
            <label>الدرس</label>
            {!creatingLesson && !renaming ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select
                  className="form-control"
                  style={{ flex: 1, minWidth: 160 }}
                  value={form.lesson}
                  onChange={(e) => setForm((f) => ({ ...f, lesson: e.target.value }))}
                >
                  <option value="">اختر الدرس</option>
                  {lessons.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.order_number}. {l.title}
                    </option>
                  ))}
                </select>
                <button className="btn btn-secondary" type="button" onClick={() => setCreatingLesson(true)}>
                  + درس جديد
                </button>
                {form.lesson && (
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => {
                      setRenameTitle(selectedLesson?.title || "");
                      setRenaming(true);
                    }}
                  >
                    تعديل الاسم
                  </button>
                )}
              </div>
            ) : creatingLesson ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  className="form-control"
                  placeholder="اسم الدرس الجديد"
                  value={newLessonTitle}
                  onChange={(e) => setNewLessonTitle(e.target.value)}
                />
                <button className="btn btn-primary" type="button" onClick={createLesson}>
                  حفظ
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => setCreatingLesson(false)}>
                  إلغاء
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  className="form-control"
                  placeholder="الاسم الجديد للدرس"
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                />
                <button className="btn btn-primary" type="button" onClick={renameLesson}>
                  حفظ الاسم
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => setRenaming(false)}>
                  إلغاء
                </button>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>مستوى صعوبة السؤال (إجباري — لا يظهر للطالب)</label>
            <div className="filter-row">
              {[["easy", "سهل"], ["medium", "متوسط"], ["hard", "صعب"]].map(([v, t]) => (
                <span
                  key={v}
                  className={`chip ${form.difficulty === v ? "active" : ""}`}
                  onClick={() => setForm((f) => ({ ...f, difficulty: v }))}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {form.kind === "collection" && (
            <>
              <div className="form-group">
                <label>ترشيح المدرس (إجباري)</label>
                <div className="filter-row">
                  {TEACHER_TIERS.map((t) => (
                    <span
                      key={t.id}
                      className={`chip ${form.teacher_tier === t.id ? "active" : ""}`}
                      onClick={() => setForm((f) => ({ ...f, teacher_tier: t.id }))}
                    >
                      {t.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>سنة السؤال (اختياري)</label>
                <input
                  className="form-control"
                  value={form.question_year}
                  onChange={(e) => setForm((f) => ({ ...f, question_year: e.target.value }))}
                  placeholder="مثال: 1446"
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label>نص السؤال</label>
            <EquationEditor value={form.text} onChange={(v) => setForm((f) => ({ ...f, text: v }))} />
            <ImagePicker
              label="صورة السؤال"
              value={form.text_image}
              onChange={(v) => setForm((f) => ({ ...f, text_image: v }))}
            />
          </div>

          <label style={{ fontWeight: 600, fontSize: 14 }}>الخيارات (اختر الإجابة الصحيحة)</label>
          {form.options.map((o, i) => (
            <div key={o.key} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <input
                  type="radio"
                  checked={form.correct_answer === o.key}
                  onChange={() => setForm((f) => ({ ...f, correct_answer: o.key }))}
                />
                <strong>{o.key})</strong>
              </div>
              <EquationEditor
                value={o.text}
                onChange={(v) => setOption(i, { text: v })}
                placeholder={`الخيار ${o.key}`}
                rows={1}
              />
              <ImagePicker
                label={`صورة الخيار ${o.key}`}
                value={o.image || ""}
                onChange={(v) => setOption(i, { image: v })}
              />
            </div>
          ))}

          <div className="form-group">
            <label>الشرح / التصحيح (اختياري)</label>
            <EquationEditor
              value={form.explanation}
              onChange={(v) => setForm((f) => ({ ...f, explanation: v }))}
              placeholder="شرح الإجابة…"
              rows={2}
            />
            <ImagePicker
              label="صورة الشرح"
              value={form.explanation_image}
              onChange={(v) => setForm((f) => ({ ...f, explanation_image: v }))}
            />
          </div>

          <div className="form-group">
            <label>فيديو الشرح — Bunny أو رابط YouTube / Drive — اختياري</label>
            <input
              className="form-control"
              value={form.video_bunny_id}
              onChange={(e) => setForm((f) => ({ ...f, video_bunny_id: e.target.value }))}
              placeholder="Bunny GUID أو https://youtube.com/... أو Drive"
            />
          </div>
          <div className="form-group">
            <label>توقيت ظهور الفيديو</label>
            <div className="filter-row">
              <span
                className={`chip ${form.video_timing === "before" ? "active" : ""}`}
                onClick={() => setForm((f) => ({ ...f, video_timing: "before" }))}
              >
                قبل الإجابة
              </span>
              <span
                className={`chip ${form.video_timing === "after" ? "active" : ""}`}
                onClick={() => setForm((f) => ({ ...f, video_timing: "after" }))}
              >
                بعد الإجابة
              </span>
            </div>
          </div>

          {msg && <div className="banner">{msg}</div>}
          <button className="btn btn-primary btn-block" onClick={save}>
            حفظ السؤال
          </button>
        </div>

        <div>
          <div className="section-title">معاينة السؤال</div>
          <div className="card" style={{ padding: 24, marginBottom: 24 }}>
            <div style={{ marginBottom: 16, fontSize: 18 }}>
              <MathText>{form.text || "نص السؤال..."}</MathText>
            </div>
            {form.text_image && (
              <img src={form.text_image} alt="" style={{ maxWidth: "100%", marginBottom: 12, borderRadius: 8 }} />
            )}
            {form.options.map((o) => (
              <div key={o.key} className={`answer-option ${form.correct_answer === o.key ? "correct" : ""}`}>
                <span className="answer-option__key">{o.key}</span>
                <div className="answer-option__body">
                  <MathText>{o.text}</MathText>
                  {o.image && (
                    <img src={o.image} alt="" style={{ display: "block", maxWidth: 160, marginTop: 6, borderRadius: 6 }} />
                  )}
                </div>
              </div>
            ))}
            {(form.explanation || form.explanation_image) && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                <strong>الشرح:</strong> <MathText>{form.explanation}</MathText>
                {form.explanation_image && (
                  <img
                    src={form.explanation_image}
                    alt=""
                    style={{ display: "block", maxWidth: "100%", marginTop: 8, borderRadius: 8 }}
                  />
                )}
              </div>
            )}
          </div>

          <div className="section-title">
            {form.kind === "homework" ? "واجبات هذا الدرس" : "أسئلة هذا الدرس"} ({list.length})
          </div>
          {list.length === 0 && form.lesson && (
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>لا أسئلة بعد لهذا الدرس.</p>
          )}
          {list.map((q) => (
            <div key={q.id} className="card" style={{ padding: 12, marginBottom: 8, fontSize: 14 }}>
              <MathText>{q.text}</MathText>
              {q.text_image && (
                <img src={q.text_image} alt="" style={{ display: "block", maxWidth: "100%", marginTop: 6, borderRadius: 6 }} />
              )}
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                {q.difficulty === "easy" ? "سهل" : q.difficulty === "hard" ? "صعب" : "متوسط"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
