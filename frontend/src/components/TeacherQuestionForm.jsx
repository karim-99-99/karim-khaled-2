import { useEffect, useState } from "react";
import client from "../api/client";
import EquationEditor from "./EquationEditor";
import ImagePicker from "./ImagePicker";

const OPTION_KEYS = ["أ", "ب", "ج", "د"];

function emptyOptions() {
  return OPTION_KEYS.map((k) => ({ key: k, text: "", image: "" }));
}

function normalizeOptions(options) {
  const byKey = Object.fromEntries(
    (Array.isArray(options) ? options : []).map((o) => [o.key, o]),
  );
  return OPTION_KEYS.map((k) => ({
    key: k,
    text: byKey[k]?.text || "",
    image: byKey[k]?.image || "",
  }));
}

function formFromQuestion(q, defaultDifficulty) {
  if (!q) {
    return {
      difficulty: defaultDifficulty,
      question_year: "",
      text: "",
      text_image: "",
      options: emptyOptions(),
      correct_answer: "أ",
      explanation: "",
      explanation_image: "",
      video_bunny_id: "",
      video_timing: "after",
    };
  }
  return {
    difficulty: q.difficulty || defaultDifficulty,
    question_year: q.question_year || "",
    text: q.text || "",
    text_image: q.text_image || "",
    options: normalizeOptions(q.options),
    correct_answer: q.correct_answer || "أ",
    explanation: q.explanation || q.written_correction || "",
    explanation_image: q.explanation_image || "",
    video_bunny_id: q.video_bunny_id || "",
    video_timing: q.video_timing || "after",
  };
}

/**
 * Add or edit homework / collection questions in the student navigation flow.
 */
export default function TeacherQuestionForm({
  subjectId,
  lessonId,
  sectionId = null,
  kind = "homework", // homework | collection
  defaultDifficulty = "medium",
  initialQuestion = null, // when set → edit mode (PATCH)
  onSaved,
  onCancel,
}) {
  const editing = Boolean(initialQuestion?.id);
  const [form, setForm] = useState(() => formFromQuestion(initialQuestion, defaultDifficulty));
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const radioName = `correct-${kind}-${initialQuestion?.id || "new"}-${lessonId}-${sectionId || "x"}`;

  useEffect(() => {
    setForm(formFromQuestion(initialQuestion, defaultDifficulty));
    setMsg("");
  }, [initialQuestion, defaultDifficulty, lessonId, sectionId, kind]);

  function setOption(i, patch) {
    setForm((f) => {
      const options = [...f.options];
      options[i] = { ...options[i], ...patch };
      return { ...f, options };
    });
  }

  async function save() {
    setMsg("");
    if (!form.text.trim() && !form.text_image) {
      setMsg("اكتب نص السؤال أو أضف صورة");
      return;
    }
    setBusy(true);
    const base = kind === "homework" ? "/homework-questions/" : "/collection-questions/";
    const payload = {
      subject: Number(subjectId),
      lesson: Number(lessonId),
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
      video_bunny_id: form.video_bunny_id || "",
      video_timing: form.video_timing,
    };
    // تجميعات = بنك عام لكل الطلاب (بدون تقييد مجموعة)
    if (kind === "collection") {
      payload.group = null;
      payload.question_year = (form.question_year || "").trim();
    }
    if (kind === "homework" && sectionId) {
      payload.section = Number(sectionId);
    }
    try {
      if (editing) {
        await client.patch(`${base}${initialQuestion.id}/`, payload);
        setMsg("تم تعديل السؤال ✓");
      } else {
        await client.post(base, payload);
        setMsg("تم حفظ السؤال ✓");
        setForm(formFromQuestion(null, defaultDifficulty));
      }
      onSaved?.();
    } catch (e) {
      const detail = e.response?.data;
      setMsg(
        (typeof detail === "object" && (detail.detail || JSON.stringify(detail))) ||
          "تعذّر الحفظ",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: 20, marginTop: 16 }}>
      <h3 style={{ marginBottom: 12 }}>
        {editing
          ? kind === "homework"
            ? "تعديل سؤال واجب"
            : "تعديل سؤال تجميع"
          : kind === "homework"
            ? "إضافة سؤال واجب"
            : "إضافة سؤال تجميع"}
      </h3>

      {kind === "collection" && (
        <>
          <div className="form-group">
            <label>المستوى</label>
            <select
              className="form-control"
              value={form.difficulty}
              onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
            >
              <option value="easy">سهل</option>
              <option value="medium">متوسط</option>
              <option value="hard">صعب</option>
            </select>
          </div>
          <div className="form-group">
            <label>سنة السؤال (اختياري)</label>
            <input
              className="form-control"
              value={form.question_year}
              onChange={(e) => setForm((f) => ({ ...f, question_year: e.target.value }))}
              placeholder="مثال: 1445 أو 2024 — اتركه فارغاً إن لم ترد"
            />
          </div>
        </>
      )}

      <div className="form-group">
        <label>نص السؤال</label>
        <EquationEditor
          value={form.text}
          onChange={(text) => setForm((f) => ({ ...f, text }))}
          placeholder="اكتب السؤال…"
        />
      </div>
      <ImagePicker
        label="صورة السؤال (اختياري)"
        value={form.text_image}
        onChange={(text_image) => setForm((f) => ({ ...f, text_image }))}
      />

      <div className="section-title" style={{ marginTop: 12 }}>الاختيارات</div>
      {form.options.map((o, i) => (
        <div key={o.key} className="form-group">
          <label>
            <input
              type="radio"
              name={radioName}
              checked={form.correct_answer === o.key}
              onChange={() => setForm((f) => ({ ...f, correct_answer: o.key }))}
              style={{ marginLeft: 8 }}
            />
            الاختيار {o.key} (صح إن مُحدَّد)
          </label>
          <EquationEditor
            value={o.text}
            onChange={(text) => setOption(i, { text })}
            rows={2}
            placeholder={`نص الاختيار ${o.key}`}
          />
          <ImagePicker
            label={`صورة ${o.key}`}
            value={o.image}
            onChange={(image) => setOption(i, { image })}
          />
        </div>
      ))}

      <div className="form-group">
        <label>الشرح (اختياري)</label>
        <EquationEditor
          value={form.explanation}
          onChange={(explanation) => setForm((f) => ({ ...f, explanation }))}
          rows={2}
        />
      </div>
      <ImagePicker
        label="صورة الشرح"
        value={form.explanation_image}
        onChange={(explanation_image) => setForm((f) => ({ ...f, explanation_image }))}
      />

      <div className="form-group">
        <label>فيديو شرح السؤال — Bunny ID (اختياري)</label>
        <input
          className="form-control"
          value={form.video_bunny_id}
          onChange={(e) => setForm((f) => ({ ...f, video_bunny_id: e.target.value }))}
          placeholder="GUID من Bunny Stream"
        />
      </div>
      <div className="form-group">
        <label>توقيت ظهور الفيديو</label>
        <div className="filter-row">
          <span
            className={`chip ${form.video_timing === "before" ? "active" : ""}`}
            onClick={() => setForm((f) => ({ ...f, video_timing: "before" }))}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                setForm((f) => ({ ...f, video_timing: "before" }));
              }
            }}
          >
            قبل الإجابة
          </span>
          <span
            className={`chip ${form.video_timing === "after" ? "active" : ""}`}
            onClick={() => setForm((f) => ({ ...f, video_timing: "after" }))}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                setForm((f) => ({ ...f, video_timing: "after" }));
              }
            }}
          >
            بعد الإجابة
          </span>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 6 }}>
          يظهر السؤال لطلاب مجموعاتك في هذه المادة فقط — ليس لكل المجموعات.
        </p>
      </div>

      {msg && (
        <div className="banner" style={{ marginBottom: 12 }}>
          {msg}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-primary" type="button" disabled={busy} onClick={save}>
          {busy ? "جاري الحفظ…" : editing ? "حفظ التعديلات" : "حفظ السؤال"}
        </button>
        {(editing || onCancel) && (
          <button
            className="btn btn-ghost"
            type="button"
            disabled={busy}
            onClick={() => onCancel?.()}
          >
            إلغاء
          </button>
        )}
      </div>
    </div>
  );
}
