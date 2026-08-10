import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { filterSubjectsForUser } from "../auth/teacherScope";
import client from "../api/client";
import BackToCourses from "../components/BackToCourses";

/** Student difficulty presets (ratios applied on the server). */
const DIFFICULTY_PRESETS = [
  {
    id: "easy",
    label: "سهل",
    hint: "٦٠٪ سهل · ٣٥٪ متوسط · ٥٪ صعب",
    tone: "mix-easy",
  },
  {
    id: "medium",
    label: "متوسط",
    hint: "٤٠٪ سهل · ٦٠٪ متوسط · ١٠٪ صعب",
    tone: "mix-medium",
  },
  {
    id: "advanced",
    label: "متقدم",
    hint: "٢٥٪ سهل · ٥٥٪ متوسط · ٢٠٪ صعب",
    tone: "mix-advanced",
  },
  {
    id: "challenge",
    label: "تحدي",
    hint: "١٠٪ سهل · ٤٠٪ متوسط · ٥٠٪ صعب",
    tone: "mix-challenge",
  },
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
  { id: "open", label: "بدون زمن", minutes: null },
  { id: "15", label: "١٥ دقيقة", minutes: 15 },
  { id: "30", label: "٣٠ دقيقة", minutes: 30 },
  { id: "45", label: "٤٥ دقيقة", minutes: 45 },
  { id: "60", label: "٦٠ دقيقة", minutes: 60 },
];

/**
 * Multi-subject / multi-lesson simulator setup (تجميعات + اختبارات).
 * Optional route param subjectId or ?lesson=&subject= to preselect.
 */
export default function SimulatorSetup() {
  const { subjectId: routeSubjectId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [subjects, setSubjects] = useState([]);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [years, setYears] = useState([]);
  const [selectedLessons, setSelectedLessons] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const [count, setCount] = useState(8);
  const [takeAll, setTakeAll] = useState(false);
  const [difficultyMix, setDifficultyMix] = useState("medium");
  const [reviewMode, setReviewMode] = useState("immediate");
  const [questionPool, setQuestionPool] = useState("any");
  const [timePreset, setTimePreset] = useState("open");
  const [customMinutes, setCustomMinutes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const autoSelectLessons = useRef(true);

  const preLesson = searchParams.get("lesson");
  const preSubject = searchParams.get("subject") || routeSubjectId || "";
  const fromCollections = searchParams.get("from") === "collections";

  useEffect(() => {
    client.get("/subjects/").then((res) => {
      const list = filterSubjectsForUser(res.data.results || res.data || [], user);
      setSubjects(list);
      if (preSubject) {
        setSelectedSubjects([Number(preSubject)]);
      } else if (list.length) {
        setSelectedSubjects(list.map((s) => s.id));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  useEffect(() => {
    // Changing subjects allows one fresh auto-select of lessons.
    autoSelectLessons.current = true;
  }, [selectedSubjects.join(",")]);

  useEffect(() => {
    if (!selectedSubjects.length) {
      setLessons([]);
      setYears([]);
      setSelectedLessons([]);
      return;
    }
    let cancelled = false;
    setOptionsLoading(true);
    const params = new URLSearchParams();
    selectedSubjects.forEach((id) => params.append("subjects", String(id)));
    client
      .get(`/exams/simulator/options/?${params.toString()}`)
      .then((res) => {
        if (cancelled) return;
        const rows = res.data.lessons || [];
        setLessons(rows);
        setYears(res.data.years || []);
        setSelectedLessons((prev) => {
          const allowed = new Set(rows.map((l) => l.id));
          const kept = prev.filter((id) => allowed.has(id));
          // Respect user clear / manual selection — do not re-select all.
          if (!autoSelectLessons.current) {
            return kept;
          }
          autoSelectLessons.current = false;
          if (preLesson && allowed.has(Number(preLesson))) {
            return [Number(preLesson)];
          }
          return rows.map((l) => l.id);
        });
        setSelectedYears((prev) => prev.filter((y) => (res.data.years || []).includes(y)));
      })
      .catch(() => {
        if (!cancelled) {
          setLessons([]);
          setYears([]);
        }
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubjects.join(",")]);

  const lessonsBySubject = useMemo(() => {
    const map = new Map();
    for (const l of lessons) {
      const key = l.subject;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(l);
    }
    return map;
  }, [lessons]);

  function toggleSubject(id) {
    setSelectedSubjects((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }

  function selectAllSubjects() {
    setSelectedSubjects(subjects.map((s) => s.id));
  }

  function toggleLesson(id) {
    autoSelectLessons.current = false;
    setSelectedLessons((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function selectAllLessons() {
    autoSelectLessons.current = false;
    setSelectedLessons(lessons.map((l) => l.id));
  }

  function clearLessons() {
    autoSelectLessons.current = false;
    setSelectedLessons([]);
  }

  function toggleYear(y) {
    setSelectedYears((prev) =>
      prev.includes(y) ? prev.filter((x) => x !== y) : [...prev, y]
    );
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
    if (selectedSubjects.length === 0) {
      setError("اختر مادة واحدةً على الأقل");
      return;
    }
    if (selectedLessons.length === 0) {
      setError("اختر درساً واحداً على الأقل");
      return;
    }
    if (!difficultyMix) {
      setError("اختر مستوى الصعوبة");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        subjects: selectedSubjects,
        lessons: selectedLessons,
        count,
        take_all: takeAll || (fromCollections && selectedLessons.length === 1),
        difficulty_mix: difficultyMix,
        review_mode: reviewMode,
        question_pool: questionPool,
        time_limit_minutes: resolveTimeLimit(),
      };
      if (selectedYears.length) payload.years = selectedYears;
      const { data } = await client.post("/exams/simulator/", payload);
      navigate(`/exam/${data.exam.id}`);
    } catch (e) {
      setError(e.response?.data?.detail || "تعذّر بدء الاختبار");
    } finally {
      setBusy(false);
    }
  }

  const backSubject =
    selectedSubjects.length === 1 ? selectedSubjects[0] : preSubject || null;

  return (
    <div>
      {backSubject ? (
        <BackToCourses subjectId={backSubject} />
      ) : (
        <div style={{ marginBottom: 12 }}>
          <Link to="/tests" className="btn btn-ghost btn-sm">
            ← الاختبارات
          </Link>
        </div>
      )}

      <div className="card form-card" style={{ maxWidth: 820 }}>
        <h2 style={{ marginBottom: 8 }}>
          {fromCollections ? "تدريب التجميعات" : "المحاكي الشخصي"}
        </h2>
        <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>
          اختر مادة أو أكثر، ثم الدروس داخل كل مادة، وسنة الأسئلة إن رغبت، ومدة الاختبار أو اتركها بدون زمن.
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
            <label style={{ margin: 0 }}>المواد ({selectedSubjects.length})</label>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={selectAllSubjects}>
                كل المواد
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  setSelectedSubjects(subjects[0] ? [subjects[0].id] : [])
                }
              >
                مادة واحدة فقط
              </button>
            </div>
          </div>
          <div className="filter-row">
            {subjects.map((s) => (
              <span
                key={s.id}
                className={`chip ${selectedSubjects.includes(s.id) ? "active" : ""}`}
                onClick={() => toggleSubject(s.id)}
                role="button"
                tabIndex={0}
              >
                {s.name}
              </span>
            ))}
          </div>
        </div>

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
            <label style={{ margin: 0 }}>الدروس ({selectedLessons.length})</label>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={selectAllLessons}>
                كل الدروس
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearLessons}>
                مسح
              </button>
            </div>
          </div>
          {optionsLoading && (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>جاري تحميل الدروس…</p>
          )}
          {!optionsLoading && lessons.length === 0 && (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>لا توجد دروس للمواد المختارة.</p>
          )}
          {[...lessonsBySubject.entries()].map(([sid, rows]) => (
            <div key={sid} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
                {rows[0]?.subject_name || `مادة ${sid}`}
              </div>
              <div className="filter-row">
                {rows.map((l) => (
                  <span
                    key={l.id}
                    className={`chip ${selectedLessons.includes(l.id) ? "active" : ""}`}
                    onClick={() => toggleLesson(l.id)}
                    role="button"
                    tabIndex={0}
                  >
                    {l.order_number}. {l.title}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="form-group">
          <label>سنة الأسئلة (اختياري)</label>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 0 }}>
            اتركها فارغة لكل السنوات، أو اختر سنة أو أكثر
          </p>
          <div className="filter-row">
            <span
              className={`chip ${selectedYears.length === 0 ? "active" : ""}`}
              onClick={() => setSelectedYears([])}
              role="button"
              tabIndex={0}
            >
              كل السنوات
            </span>
            {years.map((y) => (
              <span
                key={y}
                className={`chip ${selectedYears.includes(y) ? "active" : ""}`}
                onClick={() => toggleYear(y)}
                role="button"
                tabIndex={0}
              >
                {y}
              </span>
            ))}
          </div>
          {!years.length && (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
              لا توجد سنوات مسجّلة على الأسئلة بعد — سيُؤخذ الكل.
            </p>
          )}
        </div>

        <div className="form-group">
          <label>عدد الأسئلة</label>
          <div className="filter-row" style={{ marginBottom: 8 }}>
            <span
              className={`chip ${!takeAll ? "active" : ""}`}
              onClick={() => setTakeAll(false)}
              role="button"
              tabIndex={0}
            >
              عدد محدد
            </span>
            <span
              className={`chip ${takeAll ? "active" : ""}`}
              onClick={() => setTakeAll(true)}
              role="button"
              tabIndex={0}
            >
              كل الأسئلة المختارة
            </span>
          </div>
          {!takeAll && (
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
          )}
        </div>

        <div className="form-group">
          <label>مستوى الصعوبة</label>
          <div className="filter-row" style={{ marginBottom: 8 }}>
            {DIFFICULTY_PRESETS.map((lv) => (
              <span
                key={lv.id}
                className={`chip chip-mix ${lv.tone} ${difficultyMix === lv.id ? "active" : ""}`}
                onClick={() => setDifficultyMix(lv.id)}
                role="button"
                tabIndex={0}
              >
                {lv.label}
              </span>
            ))}
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
            {DIFFICULTY_PRESETS.find((p) => p.id === difficultyMix)?.hint}
          </p>
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
          disabled={busy || optionsLoading}
        >
          {busy ? "…" : "ابدأ الاختبار ←"}
        </button>
      </div>
    </div>
  );
}
