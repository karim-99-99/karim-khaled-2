import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { canEditSubject } from "../auth/teacherScope";
import client from "../api/client";
import BackToCourses from "../components/BackToCourses";
import MathText from "../components/MathText";

const LEVELS = [
  { id: "all", label: "كل المستويات" },
  { id: "easy", label: "سهل" },
  { id: "medium", label: "متوسط" },
  { id: "hard", label: "صعب" },
];

const DIFF_LABEL = { easy: "سهل", medium: "متوسط", hard: "صعب" };

/**
 * المدرس يبني اختباراً مسمّى من بنك التجميعات:
 * اختيار دروس → اختيار أسئلة من كل المستويات → اسم الاختبار → نشر للطلاب.
 */
export default function TeacherTestSetup() {
  const { subjectId } = useParams();
  const { user } = useAuth();
  const canEdit = canEditSubject(user, subjectId);

  const [lessons, setLessons] = useState([]);
  const [selectedLessons, setSelectedLessons] = useState([]);
  const [bank, setBank] = useState([]);
  const [selectedQs, setSelectedQs] = useState([]);
  const [levelFilter, setLevelFilter] = useState("all");
  const [name, setName] = useState("");
  const [reviewMode, setReviewMode] = useState("final");
  const [myTests, setMyTests] = useState([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingBank, setLoadingBank] = useState(false);

  function loadTests() {
    client
      .get(`/teacher-tests/?subject=${subjectId}`)
      .then((res) => setMyTests(res.data.results || res.data || []))
      .catch(() => setMyTests([]));
  }

  useEffect(() => {
    client.get(`/subjects/${subjectId}/lessons/`).then((res) => {
      const rows = res.data.results || res.data || [];
      setLessons(Array.isArray(rows) ? rows : []);
    });
    loadTests();
  }, [subjectId]);

  useEffect(() => {
    if (!canEdit || selectedLessons.length === 0) {
      setBank([]);
      return;
    }
    setLoadingBank(true);
    client
      .get(
        `/teacher-tests/question-bank/?subject=${subjectId}&lessons=${selectedLessons.join(",")}`,
      )
      .then((res) => setBank(res.data || []))
      .catch(() => setBank([]))
      .finally(() => setLoadingBank(false));
  }, [subjectId, selectedLessons, canEdit]);

  // Drop selected questions that no longer belong to selected lessons
  useEffect(() => {
    const allowed = new Set(bank.map((q) => q.id));
    setSelectedQs((ids) => ids.filter((id) => allowed.has(id)));
  }, [bank]);

  function toggleLesson(id) {
    setSelectedLessons((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleQuestion(id) {
    setSelectedQs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function selectAllVisible() {
    const ids = filteredBank.map((q) => q.id);
    setSelectedQs((prev) => Array.from(new Set([...prev, ...ids])));
  }

  const filteredBank = useMemo(() => {
    if (levelFilter === "all") return bank;
    return bank.filter((q) => q.difficulty === levelFilter);
  }, [bank, levelFilter]);

  async function saveTest() {
    setError("");
    setMsg("");
    if (!name.trim()) {
      setError("اكتب اسم الاختبار");
      return;
    }
    if (selectedLessons.length === 0) {
      setError("اختر درساً واحداً على الأقل");
      return;
    }
    if (selectedQs.length === 0) {
      setError("اختر سؤالاً واحداً على الأقل من التجميعات");
      return;
    }
    setBusy(true);
    try {
      await client.post("/teacher-tests/", {
        name: name.trim(),
        subject: Number(subjectId),
        lesson_ids: selectedLessons.map(Number),
        question_ids: selectedQs.map(Number),
        review_mode: reviewMode,
        is_published: true,
      });
      setMsg(`تم حفظ الاختبار «${name.trim()}» — يظهر للطلاب في صفحة الاختبارات.`);
      setName("");
      setSelectedQs([]);
      loadTests();
    } catch (e) {
      setError(e.response?.data?.detail || "تعذّر حفظ الاختبار");
    } finally {
      setBusy(false);
    }
  }

  async function removeTest(id) {
    if (!confirm("حذف هذا الاختبار؟")) return;
    try {
      await client.delete(`/teacher-tests/${id}/`);
      loadTests();
    } catch (e) {
      setError(e.response?.data?.detail || "تعذّر الحذف");
    }
  }

  if (!canEdit) {
    return (
      <div>
        <BackToCourses subjectId={subjectId} />
        <div className="banner">إنشاء اختبار المدرس متاح للمدرس المخصص لهذه المادة فقط.</div>
        <Link to={`/courses/${subjectId}/tests`} className="btn btn-secondary">
          ← العودة للاختبارات
        </Link>
      </div>
    );
  }

  return (
    <div>
      <BackToCourses subjectId={subjectId} />
      <div className="breadcrumb">دورات &gt; اختبارات &gt; <span>اختبار المدرس</span></div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>إنشاء اختبار المدرس</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 20 }}>
        من بنك التجميعات: اختر الدروس ثم الأسئلة (سهل / متوسط / صعب) وأعطِ الاختبار اسماً ليظهر للطلاب.
      </p>

      <div className="card form-card" style={{ maxWidth: 900, marginBottom: 24 }}>
        <div className="form-group">
          <label>اسم الاختبار</label>
          <input
            className="form-control"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: مراجعة الوحدة الأولى"
          />
        </div>

        <div className="form-group">
          <label>
            الدروس ({selectedLessons.length} محدد)
          </label>
          <div className="filter-row">
            {lessons.map((l) => (
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
          {lessons.length === 0 && (
            <p style={{ color: "var(--text-muted)" }}>لا توجد دروس — أضفها من التجميعات أولاً.</p>
          )}
        </div>

        <div className="form-group">
          <label>تصفية مستوى الأسئلة</label>
          <div className="filter-row">
            {LEVELS.map((lv) => (
              <span
                key={lv.id}
                className={`chip ${levelFilter === lv.id ? "active" : ""}`}
                onClick={() => setLevelFilter(lv.id)}
                role="button"
                tabIndex={0}
              >
                {lv.label}
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
            <label style={{ margin: 0 }}>
              الأسئلة من التجميعات — المحدد: {selectedQs.length}
            </label>
            {filteredBank.length > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={selectAllVisible}>
                تحديد الظاهر ({filteredBank.length})
              </button>
            )}
          </div>

          {loadingBank && <p style={{ color: "var(--text-muted)" }}>جاري تحميل الأسئلة…</p>}
          {!loadingBank && selectedLessons.length === 0 && (
            <p style={{ color: "var(--text-muted)" }}>اختر دروساً لعرض أسئلتها.</p>
          )}
          {!loadingBank && selectedLessons.length > 0 && filteredBank.length === 0 && (
            <p style={{ color: "var(--text-muted)" }}>
              لا توجد أسئلة لهذه الدروس في التجميعات.
            </p>
          )}

          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            {filteredBank.map((q) => {
              const on = selectedQs.includes(q.id);
              return (
                <div
                  key={q.id}
                  className="card"
                  onClick={() => toggleQuestion(q.id)}
                  style={{
                    padding: 12,
                    marginBottom: 8,
                    cursor: "pointer",
                    border: on ? "2px solid var(--primary)" : undefined,
                    background: on ? "var(--primary-light, #eef4ff)" : undefined,
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <input type="checkbox" checked={on} readOnly style={{ marginTop: 4 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                        {q.lesson_title} · {DIFF_LABEL[q.difficulty] || q.difficulty}
                        {q.video_bunny_id ? " · فيديو" : ""}
                      </div>
                      <MathText>{q.text}</MathText>
                      {q.text_image && (
                        <img
                          src={q.text_image}
                          alt=""
                          style={{ maxWidth: 160, marginTop: 6, borderRadius: 6 }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="form-group">
          <label>المراجعة للطلاب</label>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label style={{ fontWeight: 400 }}>
              <input
                type="radio"
                checked={reviewMode === "immediate"}
                onChange={() => setReviewMode("immediate")}
              />{" "}
              فورية — بعد كل سؤال
            </label>
            <label style={{ fontWeight: 400 }}>
              <input
                type="radio"
                checked={reviewMode === "final"}
                onChange={() => setReviewMode("final")}
              />{" "}
              نهائية — في آخر الاختبار
            </label>
          </div>
        </div>

        {error && <div className="error-text">{error}</div>}
        {msg && <div className="banner" style={{ marginBottom: 12 }}>{msg}</div>}

        <button className="btn btn-primary btn-block" type="button" disabled={busy} onClick={saveTest}>
          {busy ? "…" : "حفظ الاختبار ونشره للطلاب"}
        </button>
      </div>

      <div className="section-title">اختباراتي المنشورة</div>
      {myTests
        .filter((t) => !t.created_by || t.created_by === user?.id || user?.role === "admin")
        .map((t) => (
          <div
            key={t.id}
            className="card"
            style={{
              padding: 14,
              marginBottom: 10,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div>
              <strong>{t.name}</strong>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {t.question_count} سؤال · {t.lesson_titles?.join("، ") || "—"}
              </div>
            </div>
            {(t.created_by === user?.id || user?.role === "admin") && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeTest(t.id)}>
                حذف
              </button>
            )}
          </div>
        ))}
      {myTests.length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>لم تُنشئ اختبارات بعد.</p>
      )}
    </div>
  );
}
