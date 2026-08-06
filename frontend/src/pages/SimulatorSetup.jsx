import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import client from "../api/client";
import BackToCourses from "../components/BackToCourses";

const LEVELS = [
  { id: "easy", label: "سهل" },
  { id: "medium", label: "متوسط" },
  { id: "hard", label: "صعب" },
];

const POOLS = [
  {
    id: "any",
    label: "الكل",
    hint: "أسئلة جديدة ومكررة معاً من التجميعات",
  },
  {
    id: "new",
    label: "أسئلة جديدة",
    hint: "لم تختبر فيها ولم تجب عليها من قبل",
  },
  {
    id: "seen",
    label: "أسئلة مكررة",
    hint: "أسئلة ظهرت لك أو أجبتها سابقاً",
  },
];

const TIME_PRESETS = [
  { id: "open", label: "مدة مفتوحة", minutes: null },
  { id: "15", label: "١٥ دقيقة", minutes: 15 },
  { id: "30", label: "٣٠ دقيقة", minutes: 30 },
  { id: "45", label: "٤٥ دقيقة", minutes: 45 },
  { id: "60", label: "٦٠ دقيقة", minutes: 60 },
];

/**
 * Personal simulator — multi-lesson, review mode, new/seen pool, timer.
 * Questions always from تجميعات bank.
 */
export default function SimulatorSetup() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState([]);
  const [selected, setSelected] = useState([]);
  const [count, setCount] = useState(8);
  const [selectedLevels, setSelectedLevels] = useState(["easy", "medium", "hard"]);
  const [reviewMode, setReviewMode] = useState("final");
  const [questionPool, setQuestionPool] = useState("any");
  const [timePreset, setTimePreset] = useState("open");
  const [customMinutes, setCustomMinutes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    client.get(`/subjects/${subjectId}/lessons/`).then((res) => {
      const rows = res.data.results || res.data || [];
      setLessons(Array.isArray(rows) ? rows : []);
    });
  }, [subjectId]);

  function toggle(id) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function toggleLevel(id) {
    setSelectedLevels((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }

  function selectAllLessons() {
    setSelected(lessons.map((l) => l.id));
  }

  function resolveTimeLimit() {
    if (timePreset === "custom") {
      const n = Number(customMinutes);
      return n > 0 ? n : null;
    }
    const preset = TIME_PRESETS.find((t) => t.id === timePreset);
    return preset?.minutes ?? null;
  }

  async function start() {
    setError("");
    if (selected.length === 0) {
      setError("اختر درساً واحداً على الأقل");
      return;
    }
    if (selectedLevels.length === 0) {
      setError("اختر مستوى واحداً على الأقل");
      return;
    }
    setBusy(true);
    try {
      const { data } = await client.post("/exams/simulator/", {
        subject: Number(subjectId),
        lessons: selected,
        count,
        levels: selectedLevels,
        review_mode: reviewMode,
        question_pool: questionPool,
        time_limit_minutes: resolveTimeLimit(),
      });
      navigate(`/exam/${data.exam.id}`);
    } catch (e) {
      setError(e.response?.data?.detail || "تعذّر بدء الاختبار");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <BackToCourses subjectId={subjectId} />
      <div className="card form-card" style={{ maxWidth: 720 }}>
        <h2 style={{ marginBottom: 8 }}>المحاكي الشخصي</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>
          الأسئلة من بنك التجميعات — اختر الدروس ونوع الأسئلة والمراجعة والمدة.
        </p>

        <div className="form-group">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <label style={{ margin: 0 }}>الدروس ({selected.length})</label>
            {lessons.length > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={selectAllLessons}>
                تحديد الكل
              </button>
            )}
          </div>
          <div className="filter-row">
            {lessons.map((l) => (
              <span
                key={l.id}
                className={`chip ${selected.includes(l.id) ? "active" : ""}`}
                onClick={() => toggle(l.id)}
                role="button"
                tabIndex={0}
              >
                {l.order_number}. {l.title}
              </span>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>عدد الأسئلة</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setCount((c) => Math.max(1, c - 1))}
            >
              −
            </button>
            <div className="form-control" style={{ width: 80, textAlign: "center" }}>
              {count}
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setCount((c) => c + 1)}
            >
              +
            </button>
          </div>
        </div>

        <div className="form-group">
          <label>مستوى الصعوبة (يمكن اختيار أكثر من واحد)</label>
          <div className="filter-row">
            {LEVELS.map((lv) => (
              <span
                key={lv.id}
                className={`chip ${selectedLevels.includes(lv.id) ? "active" : ""}`}
                onClick={() => toggleLevel(lv.id)}
                role="button"
                tabIndex={0}
              >
                {lv.label}
              </span>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>نوع الأسئلة</label>
          <div className="filter-row" style={{ marginBottom: 8 }}>
            {POOLS.map((p) => (
              <span
                key={p.id}
                className={`chip ${questionPool === p.id ? "active" : ""}`}
                onClick={() => setQuestionPool(p.id)}
                role="button"
                tabIndex={0}
              >
                {p.label}
              </span>
            ))}
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
            {POOLS.find((p) => p.id === questionPool)?.hint}
          </p>
        </div>

        <div className="form-group">
          <label>المراجعة</label>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label style={{ fontWeight: 400 }}>
              <input
                type="radio"
                checked={reviewMode === "immediate"}
                onChange={() => setReviewMode("immediate")}
              />{" "}
              فورية — تظهر الإجابة بعد كل سؤال
            </label>
            <label style={{ fontWeight: 400 }}>
              <input
                type="radio"
                checked={reviewMode === "final"}
                onChange={() => setReviewMode("final")}
              />{" "}
              نهائية — بعد انتهاء الاختبار فقط
            </label>
          </div>
        </div>

        <div className="form-group">
          <label>مدة الاختبار</label>
          <div className="filter-row" style={{ marginBottom: 8 }}>
            {TIME_PRESETS.map((t) => (
              <span
                key={t.id}
                className={`chip ${timePreset === t.id ? "active" : ""}`}
                onClick={() => setTimePreset(t.id)}
                role="button"
                tabIndex={0}
              >
                {t.label}
              </span>
            ))}
            <span
              className={`chip ${timePreset === "custom" ? "active" : ""}`}
              onClick={() => setTimePreset("custom")}
              role="button"
              tabIndex={0}
            >
              مخصص
            </span>
          </div>
          {timePreset === "custom" && (
            <input
              type="number"
              className="form-control"
              style={{ width: 140 }}
              min={1}
              placeholder="بالدقائق"
              value={customMinutes}
              onChange={(e) => setCustomMinutes(e.target.value)}
            />
          )}
        </div>

        {error && <div className="error-text">{error}</div>}
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={start}
          disabled={busy}
        >
          {busy ? "…" : "ابدأ الاختبار ←"}
        </button>
      </div>
    </div>
  );
}
