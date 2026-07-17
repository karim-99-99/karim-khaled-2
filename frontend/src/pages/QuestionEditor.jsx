import { useEffect, useState } from "react";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";
import EquationEditor from "../components/EquationEditor";
import MathText from "../components/MathText";

const OPTION_KEYS = ["أ", "ب", "ج", "د"];

export default function QuestionEditor() {
  const { user, refreshUser } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [creatingLesson, setCreatingLesson] = useState(false);
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState("");
  const [pickSubject, setPickSubject] = useState("");

  const [form, setForm] = useState({
    lesson: "",
    difficulty: "medium",
    kind: "collection", // collection (تجميعات/اختبارات) or homework (واجب)
    text: "",
    options: OPTION_KEYS.map((k) => ({ key: k, text: "" })),
    correct_answer: "أ",
    video_bunny_id: "",
    video_timing: "after",
  });

  const subjectId = user?.taught_subject;
  const subjectName = user?.taught_subject_name;

  useEffect(() => {
    client.get("/subjects/").then((res) => setSubjects(res.data.results || res.data));
  }, []);

  function loadLessons() {
    if (!subjectId) return;
    client.get(`/subjects/${subjectId}/lessons/`).then((res) => setLessons(res.data));
  }
  useEffect(loadLessons, [subjectId]);

  useEffect(() => {
    if (form.lesson) {
      const url = form.kind === "homework"
        ? `/homework-questions/?lesson=${form.lesson}`
        : `/collection-questions/?lesson=${form.lesson}`;
      client.get(url).then((res) => setList(res.data.results || res.data)).catch(() => setList([]));
    } else {
      setList([]);
    }
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
      setForm((f) => ({ ...f, lesson: data.id }));
      loadLessons();
    } catch {
      setMsg("تعذّر إنشاء الدرس");
    }
  }

  function setOption(i, val) {
    setForm((f) => {
      const options = [...f.options];
      options[i] = { ...options[i], text: val };
      return { ...f, options };
    });
  }

  async function save() {
    setMsg("");
    if (!form.lesson) {
      setMsg("اختر الدرس أو أنشئ درساً جديداً");
      return;
    }
    const url = form.kind === "homework" ? "/homework-questions/" : "/collection-questions/";
    const payload = {
      // No group → reaches ALL the teacher's groups automatically.
      subject: subjectId,
      lesson: Number(form.lesson),
      difficulty: form.difficulty,
      text: form.text,
      options: form.options,
      correct_answer: form.correct_answer,
      video_bunny_id: form.video_bunny_id,
      video_timing: form.video_timing,
    };
    try {
      await client.post(url, payload);
      setMsg("تم حفظ السؤال ✓");
      setForm((f) => ({
        ...f,
        text: "",
        options: OPTION_KEYS.map((k) => ({ key: k, text: "" })),
        correct_answer: "أ",
        video_bunny_id: "",
      }));
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر الحفظ");
    }
  }

  // Teacher without a subject yet → ask to set it.
  if (!subjectId) {
    return (
      <div className="card form-card">
        <h2 style={{ marginBottom: 16 }}>حدد مادتك</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>
          اختر المادة التي تدرّسها لتتمكن من إنشاء الدروس والأسئلة.
        </p>
        <select className="form-control" value={pickSubject}
          onChange={(e) => setPickSubject(e.target.value)}>
          <option value="">اختر المادة</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
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
        مادتك: <strong>{subjectName}</strong> — الأسئلة التي تضيفها هنا ستظهر تلقائياً
        لكل المجموعات المضاف إليها (الآن أو مستقبلاً). لا حاجة لاختيار مجموعة.
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div className="card" style={{ padding: 24 }}>
          <div className="form-group">
            <label>نوع السؤال</label>
            <div className="filter-row">
              <span className={`chip ${form.kind === "collection" ? "active" : ""}`}
                onClick={() => setForm((f) => ({ ...f, kind: "collection" }))}>تجميعات / اختبارات</span>
              <span className={`chip ${form.kind === "homework" ? "active" : ""}`}
                onClick={() => setForm((f) => ({ ...f, kind: "homework" }))}>واجب</span>
            </div>
          </div>

          <div className="form-group">
            <label>الدرس</label>
            {!creatingLesson ? (
              <div style={{ display: "flex", gap: 8 }}>
                <select className="form-control" value={form.lesson}
                  onChange={(e) => setForm((f) => ({ ...f, lesson: e.target.value }))}>
                  <option value="">اختر الدرس</option>
                  {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                </select>
                <button className="btn btn-secondary" type="button" onClick={() => setCreatingLesson(true)}>
                  + درس جديد
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <input className="form-control" placeholder="اسم الدرس الجديد" value={newLessonTitle}
                  onChange={(e) => setNewLessonTitle(e.target.value)} />
                <button className="btn btn-primary" type="button" onClick={createLesson}>حفظ</button>
                <button className="btn btn-ghost" type="button" onClick={() => setCreatingLesson(false)}>إلغاء</button>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>مستوى صعوبة السؤال (إجباري — لا يظهر للطالب)</label>
            <div className="filter-row">
              {[["easy", "سهل"], ["medium", "متوسط"], ["hard", "صعب"]].map(([v, t]) => (
                <span key={v} className={`chip ${form.difficulty === v ? "active" : ""}`}
                  onClick={() => setForm((f) => ({ ...f, difficulty: v }))}>{t}</span>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>نص السؤال (مع الرموز الرياضية)</label>
            <EquationEditor value={form.text} onChange={(v) => setForm((f) => ({ ...f, text: v }))} />
          </div>

          <label style={{ fontWeight: 600, fontSize: 14 }}>الخيارات (اختر الإجابة الصحيحة)</label>
          {form.options.map((o, i) => (
            <div key={o.key} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <input type="radio" checked={form.correct_answer === o.key}
                  onChange={() => setForm((f) => ({ ...f, correct_answer: o.key }))} />
                <strong>{o.key})</strong>
              </div>
              <EquationEditor value={o.text} onChange={(v) => setOption(i, v)}
                placeholder={`الخيار ${o.key}`} rows={1} />
            </div>
          ))}

          <div className="form-group">
            <label>فيديو الشرح (Bunny video ID) — اختياري</label>
            <input className="form-control" value={form.video_bunny_id}
              onChange={(e) => setForm((f) => ({ ...f, video_bunny_id: e.target.value }))}
              placeholder="مثال: 8f3a-1234-..." />
          </div>
          <div className="form-group">
            <label>توقيت ظهور الفيديو</label>
            <div className="filter-row">
              <span className={`chip ${form.video_timing === "before" ? "active" : ""}`}
                onClick={() => setForm((f) => ({ ...f, video_timing: "before" }))}>قبل الإجابة</span>
              <span className={`chip ${form.video_timing === "after" ? "active" : ""}`}
                onClick={() => setForm((f) => ({ ...f, video_timing: "after" }))}>بعد الإجابة</span>
            </div>
          </div>

          {msg && <div className="banner">{msg}</div>}
          <button className="btn btn-primary btn-block" onClick={save}>حفظ السؤال</button>
        </div>

        <div>
          <div className="section-title">معاينة السؤال</div>
          <div className="card" style={{ padding: 24, marginBottom: 24 }}>
            <div style={{ marginBottom: 16, fontSize: 18 }}><MathText>{form.text || "نص السؤال..."}</MathText></div>
            {form.options.map((o) => (
              <div key={o.key} className={`answer-option ${form.correct_answer === o.key ? "correct" : ""}`}>
                <span>{o.key})</span> <MathText>{o.text}</MathText>
              </div>
            ))}
          </div>

          <div className="section-title">
            {form.kind === "homework" ? "واجبات هذا الدرس" : "أسئلة هذا الدرس"} ({list.length})
          </div>
          {list.map((q) => (
            <div key={q.id} className="card" style={{ padding: 12, marginBottom: 8, fontSize: 14 }}>
              <MathText>{q.text}</MathText>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
