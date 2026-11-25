import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { canTeachSubject } from "../auth/teacherScope";
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
const TIER_OPTS = [
  { id: "all", label: "الكل" },
  { id: "gold", label: "★ ذهبي فقط" },
  { id: "gold_silver", label: "ذهبي + فضي" },
];

function toIsoLocal(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  // Treat as Asia/Riyadh local wall time → send as ISO without Z; backend parses aware
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, hh - 3, mm || 0)); // Riyadh = UTC+3
  return dt.toISOString();
}

/**
 * المدرس يبني اختباراً مسمّى من بنك التجميعات (B4):
 * مجموعاته · دروس · أسئلة (تلقائي/يدوي) · نافذة فتح · مدة كامل أو لكل سؤال.
 */
export default function TeacherTestSetup() {
  const { subjectId } = useParams();
  const { user } = useAuth();
  const canTeach = canTeachSubject(user, subjectId);

  const [lessons, setLessons] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedLessons, setSelectedLessons] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [bank, setBank] = useState([]);
  const [selectedQs, setSelectedQs] = useState([]);
  const [levelFilter, setLevelFilter] = useState("all");
  const [mode, setMode] = useState("manual"); // auto | manual
  const [autoCount, setAutoCount] = useState(20);
  const [easyN, setEasyN] = useState(8);
  const [medN, setMedN] = useState(8);
  const [hardN, setHardN] = useState(4);
  const [tier, setTier] = useState("all");
  const [name, setName] = useState("");
  const [reviewMode, setReviewMode] = useState("final");
  const [testDate, setTestDate] = useState("");
  const [opensTime, setOpensTime] = useState("16:00");
  const [closesTime, setClosesTime] = useState("22:00");
  const [durationMode, setDurationMode] = useState("whole");
  const [durationValue, setDurationValue] = useState(45);
  const [myTests, setMyTests] = useState([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingBank, setLoadingBank] = useState(false);
  const [showAllQs, setShowAllQs] = useState(false);

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
    client
      .get("/teacher/home/")
      .then((res) => {
        const gs = (res.data?.groups || []).filter(
          (g) => !subjectId || String(g.subject_id || res.data?.subject?.id) === String(subjectId) || !g.subject_id,
        );
        setGroups(gs.length ? gs : res.data?.groups || []);
      })
      .catch(() => setGroups([]));
    loadTests();
  }, [subjectId]);

  useEffect(() => {
    if (!canTeach || selectedLessons.length === 0) {
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
  }, [subjectId, selectedLessons, canTeach]);

  useEffect(() => {
    const allowed = new Set(bank.map((q) => q.id));
    setSelectedQs((ids) => ids.filter((id) => allowed.has(id)));
  }, [bank]);

  function toggleLesson(id) {
    setSelectedLessons((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleGroup(id) {
    setSelectedGroups((prev) =>
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
    let rows = bank;
    if (levelFilter !== "all") rows = rows.filter((q) => q.difficulty === levelFilter);
    if (tier === "gold") rows = rows.filter((q) => q.teacher_tier === "gold" || q.tier === "gold");
    if (tier === "gold_silver") {
      rows = rows.filter((q) => {
        const t = q.teacher_tier || q.tier;
        return t === "gold" || t === "silver" || !t;
      });
    }
    return rows;
  }, [bank, levelFilter, tier]);

  function pickAuto() {
    setError("");
    const total = easyN + medN + hardN;
    if (total !== autoCount) {
      setError(`توزيع الصعوبة يجب أن يساوي ${autoCount} (حالياً ${total})`);
      return;
    }
    const byDiff = { easy: [], medium: [], hard: [] };
    for (const q of filteredBank) {
      const d = q.difficulty || "medium";
      if (byDiff[d]) byDiff[d].push(q);
    }
    const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
    const picked = [
      ...shuffle(byDiff.easy).slice(0, easyN),
      ...shuffle(byDiff.medium).slice(0, medN),
      ...shuffle(byDiff.hard).slice(0, hardN),
    ];
    if (picked.length < autoCount) {
      setError(`المتوفر ${picked.length} سؤال فقط من المطلوب ${autoCount}`);
    }
    setSelectedQs(picked.map((q) => q.id));
    setShowAllQs(false);
  }

  function replaceQuestion(qid) {
    const cur = bank.find((q) => q.id === qid);
    if (!cur) return;
    const used = new Set(selectedQs);
    const pool = bank.filter(
      (q) =>
        !used.has(q.id) &&
        q.difficulty === cur.difficulty &&
        (q.lesson_id === cur.lesson_id || q.sub_lesson_id === cur.sub_lesson_id),
    );
    if (!pool.length) {
      setError("لا بديل بنفس العنوان والصعوبة");
      return;
    }
    const next = pool[Math.floor(Math.random() * pool.length)];
    setSelectedQs((prev) => prev.map((id) => (id === qid ? next.id : id)));
  }

  async function saveTest(publish = true) {
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
        group_ids: selectedGroups.map(Number),
        review_mode: reviewMode,
        is_published: publish,
        opens_at: toIsoLocal(testDate, opensTime),
        closes_at: toIsoLocal(testDate, closesTime),
        duration_mode: durationMode,
        duration_value: Number(durationValue) || (durationMode === "whole" ? 45 : 90),
      });
      setMsg(
        publish
          ? `تم نشر الاختبار «${name.trim()}» — يظهر للطلاب في صفحة الاختبارات.`
          : `تم حفظ المسودة «${name.trim()}».`,
      );
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

  const selectedMeta = useMemo(() => {
    const map = Object.fromEntries(bank.map((q) => [q.id, q]));
    return selectedQs.map((id) => map[id]).filter(Boolean);
  }, [selectedQs, bank]);

  const visibleSelected = showAllQs ? selectedMeta : selectedMeta.slice(0, 6);
  const hiddenCount = Math.max(0, selectedMeta.length - 6);

  const groupLabel = selectedGroups.length
    ? groups
        .filter((g) => selectedGroups.includes(g.id))
        .map((g) => g.name)
        .join("، ")
    : "كل مجموعاتك";

  if (!canTeach) {
    return (
      <div>
        <BackToCourses subjectId={subjectId} />
        <div className="banner">إنشاء اختبار المدرس متاح لمدرسي هذه المادة (أساسي أو ثانوي) فقط.</div>
        <Link to={`/courses/${subjectId}/tests`} className="btn btn-secondary">
          ← العودة للاختبارات
        </Link>
      </div>
    );
  }

  return (
    <div>
      <BackToCourses subjectId={subjectId} />
      <div className="breadcrumb">الاختبارات › <span>اختبار جديد</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 32, margin: 0, color: "var(--brand-dark, #0d3b70)" }}>إنشاء اختبار جديد</h1>
          <p style={{ color: "var(--text-muted)", margin: "6px 0 0" }}>
            اختر الدروس والأسئلة، ثم حدّد موعد الفتح والمدة (بدون أقسام 22)
          </p>
        </div>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => saveTest(false)}>
          حفظ كمسودة
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 22, alignItems: "start" }}>
        <div>
          <div className="card form-card" style={{ marginBottom: 18 }}>
            <h2 style={{ fontSize: 20, marginTop: 0 }}>1 · بيانات الاختبار</h2>
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
              <label>المجموعات (مجموعاتك فقط)</label>
              <div className="filter-row">
                {groups.map((g) => (
                  <span
                    key={g.id}
                    className={`chip ${selectedGroups.includes(g.id) ? "active" : ""}`}
                    onClick={() => toggleGroup(g.id)}
                    role="button"
                    tabIndex={0}
                  >
                    {g.name}
                  </span>
                ))}
                {!groups.length && (
                  <span style={{ color: "var(--text-muted)" }}>لا مجموعات مرتبطة بحسابك</span>
                )}
              </div>
            </div>
          </div>

          <div className="card form-card" style={{ marginBottom: 18 }}>
            <h2 style={{ fontSize: 20, marginTop: 0 }}>2 · الأسئلة</h2>
            <div className="form-group">
              <label>الدروس ({selectedLessons.length} محدد)</label>
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
            </div>

            <div style={{ display: "flex", background: "#f1f3f6", borderRadius: 12, padding: 4, marginBottom: 14 }}>
              {[
                ["auto", "⚡ اختيار تلقائي"],
                ["manual", "✋ اختيار يدوي"],
              ].map(([k, lab]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setMode(k)}
                  style={{
                    flex: 1,
                    border: 0,
                    padding: "10px 8px",
                    borderRadius: 9,
                    fontWeight: 800,
                    cursor: "pointer",
                    background: mode === k ? "#fff" : "transparent",
                    color: mode === k ? "var(--primary)" : "#667",
                    boxShadow: mode === k ? "0 1px 4px rgba(0,0,0,.08)" : "none",
                  }}
                >
                  {lab}
                </button>
              ))}
            </div>

            {mode === "auto" && (
              <div style={{ background: "#fffbef", border: "1px solid #f3dd9c", borderRadius: 16, padding: 16, marginBottom: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>عدد الأسئلة</label>
                    <input
                      className="form-control"
                      type="number"
                      min={1}
                      max={filteredBank.length || 200}
                      value={autoCount}
                      onChange={(e) => setAutoCount(Number(e.target.value) || 1)}
                    />
                    <small style={{ color: "var(--text-muted)" }}>من {filteredBank.length} متاح</small>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>توزيع الصعوبة (المجموع = العدد)</label>
                    <div style={{ display: "flex", gap: 10 }}>
                      <label style={{ fontWeight: 400 }}>
                        سهل
                        <input type="number" className="form-control" min={0} value={easyN} onChange={(e) => setEasyN(Number(e.target.value) || 0)} />
                      </label>
                      <label style={{ fontWeight: 400 }}>
                        متوسط
                        <input type="number" className="form-control" min={0} value={medN} onChange={(e) => setMedN(Number(e.target.value) || 0)} />
                      </label>
                      <label style={{ fontWeight: 400 }}>
                        صعب
                        <input type="number" className="form-control" min={0} value={hardN} onChange={(e) => setHardN(Number(e.target.value) || 0)} />
                      </label>
                    </div>
                  </div>
                </div>
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label>الترشيح</label>
                  <div className="filter-row">
                    {TIER_OPTS.map((o) => (
                      <span
                        key={o.id}
                        className={`chip ${tier === o.id ? "active" : ""}`}
                        onClick={() => setTier(o.id)}
                        role="button"
                        tabIndex={0}
                      >
                        {o.label}
                      </span>
                    ))}
                  </div>
                </div>
                <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={pickAuto}>
                  🎲 اختر الأسئلة
                </button>
              </div>
            )}

            {mode === "manual" && (
              <>
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
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <label style={{ margin: 0 }}>الأسئلة — المحدد: {selectedQs.length}</label>
                  {filteredBank.length > 0 && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={selectAllVisible}>
                      تحديد الظاهر ({filteredBank.length})
                    </button>
                  )}
                </div>
                {loadingBank && <p style={{ color: "var(--text-muted)" }}>جاري تحميل الأسئلة…</p>}
                <div style={{ maxHeight: 320, overflowY: "auto" }}>
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
                        <div style={{ display: "flex", gap: 10 }}>
                          <input type="checkbox" checked={on} readOnly style={{ marginTop: 4 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                              {q.lesson_title} · {DIFF_LABEL[q.difficulty] || q.difficulty}
                            </div>
                            <MathText>{q.text}</MathText>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {selectedMeta.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <b>الأسئلة المختارة ({selectedMeta.length})</b>
                  {mode === "auto" && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={pickAuto}>
                      🎲 إعادة الاختيار
                    </button>
                  )}
                </div>
                {visibleSelected.map((q, i) => (
                  <div
                    key={q.id}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      border: "1px solid #f3e3b3",
                      background: "#fffdf7",
                      borderRadius: 12,
                      padding: "10px 12px",
                      marginBottom: 8,
                      fontSize: 14,
                    }}
                  >
                    <b>{i + 1}</b>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700 }}>
                      {q.text?.slice(0, 80) || "—"}
                    </span>
                    <span style={{ color: "var(--text-muted)", width: 120 }}>{q.lesson_title}</span>
                    <span className="chip">{DIFF_LABEL[q.difficulty] || q.difficulty}</span>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => replaceQuestion(q.id)} title="تبديل">
                      🔄
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleQuestion(q.id)} title="حذف">
                      ✕
                    </button>
                  </div>
                ))}
                {!showAllQs && hiddenCount > 0 && (
                  <button type="button" className="btn btn-ghost" style={{ width: "100%" }} onClick={() => setShowAllQs(true)}>
                    عرض الـ {hiddenCount} سؤال الباقية ⌄
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="card form-card" style={{ marginBottom: 18 }}>
            <h2 style={{ fontSize: 20, marginTop: 0 }}>3 · موعد الاختبار ومدته</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <div className="form-group">
                <label>اليوم</label>
                <input className="form-control" type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>يفتح الساعة</label>
                <input className="form-control" type="time" value={opensTime} onChange={(e) => setOpensTime(e.target.value)} />
              </div>
              <div className="form-group">
                <label>يُغلق الساعة</label>
                <input className="form-control" type="time" value={closesTime} onChange={(e) => setClosesTime(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 8 }}>
              <button
                type="button"
                className="card"
                onClick={() => {
                  setDurationMode("whole");
                  setDurationValue(45);
                }}
                style={{
                  textAlign: "right",
                  border: durationMode === "whole" ? "1.5px solid var(--primary)" : "1.5px solid var(--line, #e5e7eb)",
                  background: durationMode === "whole" ? "#f1f7ff" : "#fff",
                  padding: 16,
                  cursor: "pointer",
                }}
              >
                <b>مدة الاختبار كامل</b>
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>يحل الطالب الأسئلة بأي ترتيب</div>
                {durationMode === "whole" && (
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      className="form-control"
                      type="number"
                      min={1}
                      value={durationValue}
                      onChange={(e) => setDurationValue(Number(e.target.value) || 1)}
                      style={{ width: 90 }}
                    />
                    <span>دقيقة</span>
                  </div>
                )}
              </button>
              <button
                type="button"
                className="card"
                onClick={() => {
                  setDurationMode("per_question");
                  setDurationValue(90);
                }}
                style={{
                  textAlign: "right",
                  border: durationMode === "per_question" ? "1.5px solid var(--primary)" : "1.5px solid var(--line, #e5e7eb)",
                  background: durationMode === "per_question" ? "#f1f7ff" : "#fff",
                  padding: 16,
                  cursor: "pointer",
                }}
              >
                <b>وقت لكل سؤال</b>
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>يُغلق السؤال عند انتهاء وقته</div>
                {durationMode === "per_question" && (
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      className="form-control"
                      type="number"
                      min={10}
                      value={durationValue}
                      onChange={(e) => setDurationValue(Number(e.target.value) || 10)}
                      style={{ width: 90 }}
                    />
                    <span>ثانية</span>
                  </div>
                )}
              </button>
            </div>

            <div className="form-group" style={{ marginTop: 16 }}>
              <label>المراجعة للطلاب</label>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <label style={{ fontWeight: 400 }}>
                  <input type="radio" checked={reviewMode === "immediate"} onChange={() => setReviewMode("immediate")} />{" "}
                  فورية — بعد كل سؤال
                </label>
                <label style={{ fontWeight: 400 }}>
                  <input type="radio" checked={reviewMode === "final"} onChange={() => setReviewMode("final")} />{" "}
                  نهائية — في آخر الاختبار
                </label>
              </div>
            </div>
          </div>

          {error && <div className="error-text">{error}</div>}
          {msg && <div className="banner" style={{ marginBottom: 12 }}>{msg}</div>}
        </div>

        <aside
          style={{
            background: "linear-gradient(160deg,#0d3b70,#1565c0)",
            color: "#fff",
            borderRadius: 22,
            padding: 22,
            position: "sticky",
            top: 90,
          }}
        >
          <h3 style={{ margin: "0 0 14px", fontSize: 21 }}>ملخص الاختبار</h3>
          <SumRow label="المجموعات" value={groupLabel} />
          <SumRow label="الدروس" value={`${selectedLessons.length}`} />
          <SumRow
            label="الصعوبة"
            value={`${selectedMeta.filter((q) => q.difficulty === "easy").length} سهل · ${selectedMeta.filter((q) => q.difficulty === "medium").length} متوسط · ${selectedMeta.filter((q) => q.difficulty === "hard").length} صعب`}
          />
          <SumRow label="الموعد" value={testDate || "—"} />
          <SumRow label="متاح" value={testDate ? `${opensTime} – ${closesTime}` : "—"} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "16px 0" }}>
            <div style={{ background: "rgba(255,255,255,.14)", borderRadius: 14, padding: 12, textAlign: "center" }}>
              <b style={{ fontSize: 32, display: "block" }}>{selectedQs.length}</b>
              سؤال
            </div>
            <div style={{ background: "rgba(255,255,255,.14)", borderRadius: 14, padding: 12, textAlign: "center" }}>
              <b style={{ fontSize: 32, display: "block" }}>{durationValue}</b>
              {durationMode === "whole" ? "دقيقة" : "ث/سؤال"}
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => saveTest(true)}
            style={{
              display: "block",
              width: "100%",
              background: "#fff",
              color: "#0d3b70",
              textAlign: "center",
              borderRadius: 14,
              padding: 14,
              fontWeight: 800,
              fontSize: 18,
              border: 0,
              cursor: "pointer",
            }}
          >
            {busy ? "…" : "نشر الاختبار ←"}
          </button>
          <p style={{ textAlign: "center", opacity: 0.8, fontSize: 13, margin: "10px 0 0" }}>
            يظهر للطلاب في صفحة الاختبارات (بدون أقسام 22)
          </p>
        </aside>
      </div>

      <div className="section-title" style={{ marginTop: 28 }}>اختباراتي</div>
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
              {!t.is_published && <span className="chip" style={{ marginInlineStart: 8 }}>مسودة</span>}
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {t.question_count} سؤال · {t.duration_mode === "per_question" ? `${t.duration_value}ث/س` : `${t.duration_value}د`} ·{" "}
                {t.lesson_titles?.join("، ") || "—"}
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

function SumRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,.12)", fontSize: 14.5 }}>
      <span style={{ opacity: 0.8 }}>{label}</span>
      <b>{value}</b>
    </div>
  );
}
