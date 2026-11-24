import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { resolveSubjectKey } from "../theme/subjects";

const WEEKDAY_LABELS = [
  { id: 6, label: "الأحد" },
  { id: 0, label: "الإثنين" },
  { id: 1, label: "الثلاثاء" },
  { id: 2, label: "الأربعاء" },
  { id: 3, label: "الخميس" },
  { id: 4, label: "الجمعة" },
  { id: 5, label: "السبت" },
];

const KIND_LABEL = {
  foundation: "تأسيس",
  collections: "تجميع",
  review: "مراجعة",
};

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function taskLink(task) {
  if (!task.lesson || !task.subject) return null;
  if (task.kind === "foundation") return `/lessons/${task.lesson}`;
  if (task.kind === "collections") {
    return `/courses/${task.subject}/collections/${task.lesson}`;
  }
  return null;
}

function groupTasksByDay(tasks) {
  const map = {};
  for (const t of tasks || []) {
    if (!map[t.day_index]) map[t.day_index] = [];
    map[t.day_index].push(t);
  }
  return map;
}

export default function SmartPlan() {
  const [subjects, setSubjects] = useState([]);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [showWizard, setShowWizard] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  const [form, setForm] = useState({
    subject_ids: [],
    start_date: todayISO(),
    end_date: "",
    schedule_mode: "sequential",
    weekly_off: [4, 5],
    custom_off: [],
  });

  function loadActive() {
    setLoading(true);
    client
      .get("/study-plans/active/")
      .then((res) => {
        setPlan(res.data);
        setSelectedDay(res.data.today_day_index || 1);
        setShowWizard(false);
      })
      .catch(() => {
        setPlan(null);
        setShowWizard(true);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    client.get("/subjects/").then((res) => {
      const rows = res.data.results || res.data || [];
      setSubjects(rows);
      setForm((f) => ({
        ...f,
        subject_ids: f.subject_ids.length ? f.subject_ids : rows.map((s) => s.id),
      }));
    });
    loadActive();
  }, []);

  const byDay = useMemo(() => groupTasksByDay(plan?.tasks), [plan]);
  const dayTasks = byDay[selectedDay] || [];
  const dayDone = dayTasks.filter((t) => t.is_done).length;
  const progressPct = plan?.total_count
    ? Math.round((100 * (plan.done_count || 0)) / plan.total_count)
    : 0;

  function toggleSubject(id) {
    setForm((f) => {
      const has = f.subject_ids.includes(id);
      return {
        ...f,
        subject_ids: has
          ? f.subject_ids.filter((x) => x !== id)
          : [...f.subject_ids, id],
      };
    });
  }

  async function generate() {
    setBusy(true);
    setMsg("");
    if (!form.end_date) {
      setMsg("حدد تاريخ نهاية الخطة");
      setBusy(false);
      return;
    }
    try {
      const payload = {
        subject_ids: form.subject_ids,
        start_date: form.start_date,
        end_date: form.end_date,
        schedule_mode: form.schedule_mode,
        weekly_off: form.weekly_off,
        custom_off: form.custom_off,
        include_foundation: true,
        include_collections: true,
        hours_per_day: 2,
      };
      const { data } = await client.post("/study-plans/generate/", payload);
      setPlan(data);
      setSelectedDay(data.today_day_index || 1);
      setShowWizard(false);
      setMsg(
        data.overflow_count
          ? `تم إنشاء الخطة ✓ — تبقّى ${data.overflow_count} درس خارج المدة؛ مدّد تاريخ النهاية.`
          : "تم إنشاء جدولك الذكي ✓ — ابدأ بيومك الحالي"
      );
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر توليد الخطة");
    } finally {
      setBusy(false);
    }
  }

  function toggleOffDay(id) {
    setForm((f) => {
      const has = f.weekly_off.includes(id);
      return {
        ...f,
        weekly_off: has
          ? f.weekly_off.filter((x) => x !== id)
          : [...f.weekly_off, id],
      };
    });
  }

  async function toggleTask(task) {
    if (!plan) return;
    try {
      const { data } = await client.post(
        `/study-plans/${plan.id}/tasks/${task.id}/toggle/`
      );
      setPlan((prev) => {
        if (!prev) return prev;
        const tasks = prev.tasks.map((t) => (t.id === data.id ? { ...t, ...data } : t));
        const done_count = tasks.filter((t) => t.is_done).length;
        return { ...prev, tasks, done_count, total_count: tasks.length };
      });
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر تحديث المهمة");
    }
  }

  async function deletePlan() {
    if (!plan || !confirm("حذف هذه الخطة؟")) return;
    setBusy(true);
    try {
      await client.delete(`/study-plans/${plan.id}/`);
      setPlan(null);
      setShowWizard(true);
      setMsg("تم حذف الخطة");
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر الحذف");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="spinner">جاري التحميل…</div>;
  }

  return (
    <div className="smart-plan">
      <div className="smart-plan__hero">
        <div>
          <p className="smart-plan__eyebrow">الجدول الذكي</p>
          <h1>بدل ما تحتار كل يوم... الخطة ترتّب لك</h1>
          <p className="smart-plan__lead">
            اختر المواد ومدة خطتك — والنظام يرتّب لك جدول مذاكرة يناسب المدة اللي حددتها.
          </p>
        </div>
        <div className="smart-plan__hero-actions">
          {plan && !showWizard && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowWizard(true)}
            >
              إعادة ضبط الخطة
            </button>
          )}
          {plan && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ color: "var(--error)" }}
              disabled={busy}
              onClick={deletePlan}
            >
              حذف الخطة
            </button>
          )}
        </div>
      </div>

      {msg && <div className="banner" style={{ marginBottom: 16 }}>{msg}</div>}

      {(showWizard || !plan) && (
        <div className="wizard-layout smart-plan__wizard">
          <div>
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>أنشئ خطتك</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: 20 }}>
            نفس فكرة خطط التحصيلي الذكية: مدة جاهزة أو مخصّصة حسب وقتك.
          </p>

          <div className="step-block">
            <div className="step-block__head">
              <span className="step-block__num">1</span>
              <h3>المواد</h3>
            </div>
            <div className="filter-row">
              {subjects.map((s) => {
                const key = resolveSubjectKey(s.name);
                const on = form.subject_ids.includes(s.id);
                return (
                  <span
                    key={s.id}
                    className={`chip ${on ? "active" : ""}`}
                    data-subject={key || undefined}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSubject(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") toggleSubject(s.id);
                    }}
                  >
                    {s.name}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="step-block">
            <div className="step-block__head">
              <span className="step-block__num">2</span>
              <h3>مدة الخطة والإجازات</h3>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              <div className="form-group">
                <label>تاريخ البداية</label>
                <input
                  className="form-control"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>تاريخ النهاية</label>
                <input
                  className="form-control"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label>أيام الإجازة الأسبوعية</label>
              <div className="filter-row">
                {WEEKDAY_LABELS.map((d) => (
                  <span
                    key={d.id}
                    className={`chip ${form.weekly_off.includes(d.id) ? "active" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleOffDay(d.id)}
                  >
                    {d.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="step-block">
            <div className="step-block__head">
              <span className="step-block__num">3</span>
              <h3>ترتيب المذاكرة</h3>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div className="filter-row">
                <span
                  className={`chip ${form.schedule_mode === "sequential" ? "active" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setForm((f) => ({ ...f, schedule_mode: "sequential" }))}
                >
                  مادة بعد مادة
                </span>
                <span
                  className={`chip ${form.schedule_mode === "weekly" ? "active" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setForm((f) => ({ ...f, schedule_mode: "weekly" }))}
                >
                  مادة كل أسبوع
                </span>
              </div>
              <small style={{ color: "var(--text-muted)", display: "block", marginTop: 8 }}>
                {form.schedule_mode === "weekly"
                  ? "تناوب أسبوعي بين المواد، والمادة التي تنتهي دروسها تخرج من التناوب."
                  : "أكمل دروس المادة الحالية ثم انتقل للتالية حسب ترتيب اختيارك."}
              </small>
            </div>
          </div>

          {plan && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginBottom: 12 }}
              onClick={() => setShowWizard(false)}
            >
              إلغاء
            </button>
          )}
          </div>

          <aside className="sticky-summary">
            <h3>ملخص الخطة</h3>
            <div className="sticky-summary__meta">
              <div>المواد: {form.subject_ids.length}</div>
              <div>من: {form.start_date || "—"}</div>
              <div>إلى: {form.end_date || "—"}</div>
              <div>
                الترتيب:{" "}
                {form.schedule_mode === "weekly" ? "مادة كل أسبوع" : "مادة بعد مادة"}
              </div>
            </div>
            <div className="sticky-summary__stats">
              <div className="sticky-summary__stat">
                <strong>{form.subject_ids.length}</strong>
                <span>مواد</span>
              </div>
              <div className="sticky-summary__stat">
                <strong>{form.weekly_off.length}</strong>
                <span>أيام إجازة</span>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={busy || !form.subject_ids.length}
              onClick={generate}
            >
              {busy ? "جاري التوليد…" : "ولّد جدولي الذكي"}
            </button>
          </aside>
        </div>
      )}

      {plan && !showWizard && (
        <>
          <div className="smart-plan__stats card">
            <div>
              <strong>{plan.title}</strong>
              <div style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>
                {plan.days_count} يوم مذاكرة ·{" "}
                {plan.schedule_mode === "weekly" ? "مادة كل أسبوع" : "مادة بعد مادة"} ·{" "}
                {plan.done_count}/{plan.total_count} مهمة
              </div>
            </div>
            <div className="smart-plan__progress">
              <div className="smart-plan__progress-bar">
                <span style={{ width: `${progressPct}%` }} />
              </div>
              <div className="smart-plan__progress-label">{progressPct}%</div>
            </div>
          </div>

          <div className="smart-plan__day-nav">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={selectedDay <= 1}
              onClick={() => setSelectedDay((d) => d - 1)}
            >
              ← السابق
            </button>
            <div className="smart-plan__day-label">
              اليوم {selectedDay}
              {selectedDay === plan.today_day_index ? (
                <span className="badge badge-active" style={{ marginInlineStart: 8 }}>
                  اليوم
                </span>
              ) : null}
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {dayTasks[0]?.task_date || ""}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={selectedDay >= plan.days_count}
              onClick={() => setSelectedDay((d) => d + 1)}
            >
              التالي →
            </button>
          </div>

          <div className="smart-plan__day-strip">
            {Array.from({ length: plan.days_count }, (_, i) => i + 1).map((d) => {
              const tasks = byDay[d] || [];
              const allDone = tasks.length > 0 && tasks.every((t) => t.is_done);
              const isToday = d === plan.today_day_index;
              return (
                <button
                  key={d}
                  type="button"
                  className={[
                    "smart-plan__day-dot",
                    selectedDay === d ? "is-selected" : "",
                    isToday ? "is-today" : "",
                    allDone ? "is-done" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setSelectedDay(d)}
                  title={`اليوم ${d}`}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div style={{ marginBottom: 12, color: "var(--text-muted)", fontSize: 14 }}>
            مهام هذا اليوم: {dayDone}/{dayTasks.length}
          </div>

          {dayTasks.map((task) => {
            const href = taskLink(task);
            const key = resolveSubjectKey(task.subject_name);
            return (
              <div
                key={task.id}
                className={`card smart-plan__task ${task.is_done ? "is-done" : ""}`}
                data-subject={key || undefined}
              >
                <div className="smart-plan__task-main">
                  <span className={`smart-plan__kind smart-plan__kind--${task.kind}`}>
                    {KIND_LABEL[task.kind] || task.kind}
                  </span>
                  <div>
                    <strong>{task.title}</strong>
                    {task.detail ? (
                      <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
                        {task.detail}
                      </div>
                    ) : null}
                    <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>
                      ≈ {task.estimated_minutes} دقيقة
                    </div>
                  </div>
                </div>
                <div className="smart-plan__task-actions">
                  {href && (
                    <Link to={href} className="btn btn-secondary btn-sm">
                      ابدأ
                    </Link>
                  )}
                  <button
                    type="button"
                    className={`btn btn-sm ${task.is_done ? "btn-ghost" : "btn-primary"}`}
                    onClick={() => toggleTask(task)}
                  >
                    {task.is_done ? "تراجع" : "تم ✓"}
                  </button>
                </div>
              </div>
            );
          })}

          {dayTasks.length === 0 && (
            <p style={{ color: "var(--text-muted)" }}>لا مهام لهذا اليوم.</p>
          )}
        </>
      )}
    </div>
  );
}
