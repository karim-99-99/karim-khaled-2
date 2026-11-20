import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { getSubjectTheme, resolveSubjectKey } from "../theme/subjects";
import "../styles/smartplan-exact.css";

const DAY_NAMES = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

const KIND_LABEL = {
  foundation: "تأسيس",
  collections: "تجميع",
  review: "مراجعة",
};

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12l5 5L20 7" />
  </svg>
);

const CalIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

function cssKey(key) {
  if (key === "physics") return "phys";
  return key || "math";
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysISO(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatAr(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d} / ${m} / ${y}`;
}

function formatShort(iso) {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function taskLink(task) {
  if (!task.lesson || !task.subject) return null;
  if (task.kind === "foundation") return `/lessons/${task.lesson}`;
  if (task.kind === "collections") return `/courses/${task.subject}/collections/${task.lesson}`;
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
  const [lessons, setLessons] = useState([]);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [showWizard, setShowWizard] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [openSubjects, setOpenSubjects] = useState({});
  const [doneLessons, setDoneLessons] = useState([]);
  const [offWeekdays, setOffWeekdays] = useState([6]);
  const [customHolidays, setCustomHolidays] = useState([]);
  const [orderMode, setOrderMode] = useState("sequential");
  const [subjectOrder, setSubjectOrder] = useState([]);

  const [form, setForm] = useState({
    subject_ids: [],
    days_count: 60,
    hours_per_day: 2,
    start_date: todayISO(),
    exam_date: "",
    include_foundation: true,
    include_collections: true,
  });

  const endDate = useMemo(
    () => form.exam_date || addDaysISO(form.start_date, Math.max(0, form.days_count - 1)),
    [form.start_date, form.days_count, form.exam_date]
  );

  const studyDays = useMemo(() => {
    let count = 0;
    const holidaySet = new Set(customHolidays);
    for (let i = 0; i < form.days_count; i++) {
      const iso = addDaysISO(form.start_date, i);
      if (holidaySet.has(iso)) continue;
      const d = new Date(`${iso}T12:00:00`);
      const jsDay = d.getDay();
      const arIndex = (jsDay + 1) % 7;
      if (offWeekdays.includes(arIndex)) continue;
      count += 1;
    }
    return count;
  }, [form.start_date, form.days_count, offWeekdays, customHolidays]);

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
      const ids = rows.map((s) => s.id);
      setForm((f) => ({
        ...f,
        subject_ids: f.subject_ids.length ? f.subject_ids : ids,
      }));
      setSubjectOrder(ids);
    });
    loadActive();
  }, []);

  useEffect(() => {
    if (!form.subject_ids.length) {
      setLessons([]);
      return;
    }
    const params = new URLSearchParams();
    form.subject_ids.forEach((id) => params.append("subjects", String(id)));
    client
      .get(`/exams/simulator/options/?${params.toString()}`)
      .then((res) => {
        const rows = res.data.lessons || [];
        setLessons(rows);
        setOpenSubjects((prev) => {
          const next = { ...prev };
          for (const id of form.subject_ids) {
            if (next[id] === undefined) next[id] = form.subject_ids[0] === id;
          }
          return next;
        });
      })
      .catch(() => setLessons([]));
  }, [form.subject_ids.join(",")]);

  const lessonsBySubject = useMemo(() => {
    const map = new Map();
    for (const l of lessons) {
      if (!map.has(l.subject)) map.set(l.subject, []);
      map.get(l.subject).push(l);
    }
    return map;
  }, [lessons]);

  const orderedSubjects = useMemo(() => {
    const selected = subjects.filter((s) => form.subject_ids.includes(s.id));
    return [...selected].sort(
      (a, b) => subjectOrder.indexOf(a.id) - subjectOrder.indexOf(b.id)
    );
  }, [subjects, form.subject_ids, subjectOrder]);

  const byDay = useMemo(() => groupTasksByDay(plan?.tasks), [plan]);
  const dayTasks = byDay[selectedDay] || [];
  const dayDone = dayTasks.filter((t) => t.is_done).length;
  const progressPct = plan?.total_count
    ? Math.round((100 * (plan.done_count || 0)) / plan.total_count)
    : 0;

  function toggleSubject(id) {
    setForm((f) => {
      const has = f.subject_ids.includes(id);
      const subject_ids = has ? f.subject_ids.filter((x) => x !== id) : [...f.subject_ids, id];
      return { ...f, subject_ids };
    });
    setSubjectOrder((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function selectAllSubjects() {
    const ids = subjects.map((s) => s.id);
    setForm((f) => ({ ...f, subject_ids: ids }));
    setSubjectOrder(ids);
  }

  function toggleOffDay(idx) {
    setOffWeekdays((prev) =>
      prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx]
    );
  }

  function toggleDoneLesson(id) {
    setDoneLessons((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function moveSubject(id, dir) {
    setSubjectOrder((prev) => {
      const selected = prev.filter((x) => form.subject_ids.includes(x));
      const others = prev.filter((x) => !form.subject_ids.includes(x));
      const i = selected.indexOf(id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= selected.length) return prev;
      const next = [...selected];
      [next[i], next[j]] = [next[j], next[i]];
      return [...next, ...others];
    });
  }

  function addHoliday() {
    const iso = prompt("أدخل تاريخ الإجازة (YYYY-MM-DD)", addDaysISO(form.start_date, 14));
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    setCustomHolidays((prev) => (prev.includes(iso) ? prev : [...prev, iso].sort()));
  }

  async function generate() {
    setBusy(true);
    setMsg("");
    try {
      const payload = {
        ...form,
        exam_date: form.exam_date || endDate || null,
        subject_ids: orderedSubjects.map((s) => s.id),
      };
      const { data } = await client.post("/study-plans/generate/", payload);
      setPlan(data);
      setSelectedDay(data.today_day_index || 1);
      setShowWizard(false);
      setMsg(
        data.overflow_count
          ? `تم إنشاء الخطة ✓ — تبقّى ${data.overflow_count} درس خارج المدة؛ زد الأيام أو الساعات.`
          : "تم إنشاء جدولك الذكي ✓ — ابدأ بيومك الحالي"
      );
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر توليد الخطة");
    } finally {
      setBusy(false);
    }
  }

  async function toggleTask(task) {
    if (!plan) return;
    try {
      const { data } = await client.post(`/study-plans/${plan.id}/tasks/${task.id}/toggle/`);
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

  const remainingLessons = Math.max(0, lessons.length - doneLessons.length);
  const offLabel = [
    ...offWeekdays.map((i) => DAY_NAMES[i]),
    customHolidays.length ? `+ ${customHolidays.length} أيام مخصصة` : null,
  ]
    .filter(Boolean)
    .join(" + ") || "لا يوجد";

  if (loading) {
    return <div className="spinner">جاري التحميل…</div>;
  }

  return (
    <div className="smartplan-exact">
      <div className="hero">
        <div className="h-ic">
          <CalIcon />
        </div>
        <div>
          <small>الجدول الذكي</small>
          <h1>بدل ما تحتار كل يوم... الخطة ترتّب لك</h1>
        </div>
      </div>

      {plan && !showWizard && (
        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          <button type="button" className="addb" onClick={() => setShowWizard(true)}>
            إعادة ضبط الخطة
          </button>
          <button type="button" className="vadd" disabled={busy} onClick={deletePlan} style={{ borderStyle: "solid" }}>
            حذف الخطة
          </button>
        </div>
      )}

      {msg && (
        <div className="banner" style={{ marginBottom: 16 }}>
          {msg}
        </div>
      )}

      {(showWizard || !plan) && (
        <div className="layout">
          <div>
            <div className="box">
              <div className="bh">
                <h3>
                  <span className="step">1</span>المواد
                </h3>
                <button type="button" className="lnk" onClick={selectAllSubjects} style={{ background: "none", border: 0, cursor: "pointer" }}>
                  تحديد الكل
                </button>
              </div>
              <div className="subs">
                {subjects.map((s) => {
                  const key = resolveSubjectKey(s.name) || "math";
                  const on = form.subject_ids.includes(s.id);
                  const theme = getSubjectTheme(key);
                  return (
                    <button key={s.id} type="button" className={`sub ${cssKey(key)}${on ? " on" : ""}`} onClick={() => toggleSubject(s.id)}>
                      <span className="chk">{on ? <Check /> : null}</span>
                      {theme?.logo ? <img src={theme.logo} alt={s.name} /> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="box">
              <div className="bh">
                <h3>
                  <span className="step">2</span>مدة الخطة
                </h3>
              </div>
              <div className="dates">
                <label className="dt">
                  <CalIcon />
                  <div>
                    <small>تبدأ من</small>
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                      style={{ border: 0, fontWeight: 800, fontSize: 16, fontFamily: "inherit", background: "transparent" }}
                    />
                  </div>
                </label>
                <div className="mid">
                  <strong>
                    <input
                      type="number"
                      min={7}
                      max={120}
                      value={form.days_count}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          days_count: Number(e.target.value) || 60,
                          exam_date: "",
                        }))
                      }
                      style={{ width: 64, border: 0, background: "transparent", fontWeight: 800, fontSize: 22, textAlign: "center", fontFamily: "inherit", color: "inherit" }}
                    />
                  </strong>
                  يوم
                </div>
                <label className="dt">
                  <CalIcon />
                  <div>
                    <small>تنتهي في</small>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        const end = e.target.value;
                        const start = new Date(`${form.start_date}T12:00:00`);
                        const endD = new Date(`${end}T12:00:00`);
                        const days = Math.max(7, Math.round((endD - start) / 86400000) + 1);
                        setForm((f) => ({ ...f, exam_date: end, days_count: days }));
                      }}
                      style={{ border: 0, fontWeight: 800, fontSize: 16, fontFamily: "inherit", background: "transparent" }}
                    />
                  </div>
                </label>
              </div>
            </div>

            <div className="box">
              <div className="bh">
                <h3>
                  <span className="step">3</span>أيام الإجازة
                </h3>
                <span className="opt">اضغط على اليوم</span>
              </div>
              <div className="days">
                {DAY_NAMES.map((name, idx) => (
                  <button
                    key={name}
                    type="button"
                    className={`day${offWeekdays.includes(idx) ? " off" : ""}`}
                    onClick={() => toggleOffDay(idx)}
                  >
                    {name}
                    {offWeekdays.includes(idx) ? <i>إجازة</i> : null}
                  </button>
                ))}
              </div>
              <div className="vac">
                <div className="vac-h">
                  <span className="vi">
                    <CalIcon />
                  </span>
                  <div className="vt">
                    <small>أيام إجازة مخصصة</small>
                    <div className="vchips">
                      {customHolidays.map((iso) => (
                        <span key={iso} className="vc">
                          <b dir="ltr">{formatShort(iso)}</b>
                          <button
                            type="button"
                            style={{ background: "none", border: 0, marginInlineStart: 6, cursor: "pointer", color: "inherit" }}
                            onClick={() => setCustomHolidays((p) => p.filter((x) => x !== iso))}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <button type="button" className="vadd" onClick={addHoliday}>
                        + إضافة
                      </button>
                    </div>
                  </div>
                  <span className="vcount">{customHolidays.length}</span>
                </div>
              </div>
              <div className="hint">
                أيام المذاكرة الفعلية: <b>{studyDays} يوم</b>
              </div>
            </div>

            <div className="box">
              <div className="bh">
                <h3>
                  <span className="step">4</span>الدروس التي أنهيتها مسبقاً
                </h3>
                <span className="opt">اختياري</span>
              </div>
              {[...lessonsBySubject.entries()].map(([sid, rows]) => {
                const name = rows[0]?.subject_name || `مادة ${sid}`;
                const key = resolveSubjectKey(name) || "math";
                const selectedCount = rows.filter((l) => doneLessons.includes(l.id)).length;
                const open = openSubjects[sid];
                return (
                  <div key={sid} className={`dd ${cssKey(key)}${open ? " open" : ""}`}>
                    <button
                      type="button"
                      className="dd-h"
                      style={{ width: "100%", border: 0, cursor: "pointer", font: "inherit" }}
                      onClick={() => setOpenSubjects((p) => ({ ...p, [sid]: !p[sid] }))}
                    >
                      <i className="dot" />
                      <span className="nm">{name}</span>
                      <span className={`cnt${selectedCount === 0 ? " zero" : ""}`}>
                        {selectedCount === 0 ? "لا يوجد" : `${selectedCount} من ${rows.length}`}
                      </span>
                      <svg className="arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {open && (
                      <div className="dd-b">
                        <div className="dd-tools">
                          <span role="button" tabIndex={0} onClick={() => setDoneLessons((prev) => [...new Set([...prev, ...rows.map((l) => l.id)])])}>
                            تحديد الكل
                          </span>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              const ids = new Set(rows.map((l) => l.id));
                              setDoneLessons((prev) => prev.filter((id) => !ids.has(id)));
                            }}
                          >
                            مسح
                          </span>
                        </div>
                        <div className="lgrid">
                          {rows.map((l) => {
                            const on = doneLessons.includes(l.id);
                            return (
                              <label key={l.id} className={`ls${on ? " on" : ""}`} onClick={() => toggleDoneLesson(l.id)}>
                                <span className="cb">{on ? <Check /> : null}</span>
                                <em>{l.order_number}</em>
                                {l.title}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {!lessons.length && <p className="hint">اختر المواد لتحميل الدروس.</p>}
            </div>

            <div className="box" id="ord">
              <div className="bh">
                <h3>
                  <span className="step">5</span>ترتيب المذاكرة
                </h3>
                <span className="opt">اسحب لتغيير الترتيب</span>
              </div>
              <div className="om">
                <button type="button" className={`mo${orderMode === "sequential" ? " on" : ""}`} onClick={() => setOrderMode("sequential")}>
                  <i className="rad" />
                  <div>
                    <b>مادة بعد مادة</b>
                    <small>تنهي المادة كاملة ثم تنتقل للتالية</small>
                  </div>
                  <div className="mi">▮▮▮▮ ▮▮▮ ▮▮▮▮</div>
                </button>
                <button type="button" className={`mo${orderMode === "weekly" ? " on" : ""}`} onClick={() => setOrderMode("weekly")}>
                  <i className="rad" />
                  <div>
                    <b>مادة كل أسبوع</b>
                    <small>تتنقل بين المواد أسبوعياً بالتناوب</small>
                  </div>
                  <div className="mi">▮ ▮ ▮ ▮ ▮ ▮</div>
                </button>
              </div>
              <div className="ogrid">
                <div className="olist">
                  {orderedSubjects.map((s, idx) => {
                    const key = resolveSubjectKey(s.name) || "math";
                    const theme = getSubjectTheme(key);
                    return (
                      <div key={s.id}>
                        {idx > 0 && (
                          <div className="conn">
                            <span>↓</span>
                          </div>
                        )}
                        <div className="orow" style={{ "--c": theme?.color, "--bg": theme?.soft }}>
                          <button type="button" className="hd" style={{ background: "none", border: 0, cursor: "pointer" }} onClick={() => moveSubject(s.id, -1)} title="أعلى">
                            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                              <circle cx="9" cy="6" r="1.6" />
                              <circle cx="15" cy="6" r="1.6" />
                              <circle cx="9" cy="12" r="1.6" />
                              <circle cx="15" cy="12" r="1.6" />
                              <circle cx="9" cy="18" r="1.6" />
                              <circle cx="15" cy="18" r="1.6" />
                            </svg>
                          </button>
                          <span className="on">{idx + 1}</span>
                          {theme?.logo ? <img src={theme.logo} alt="" /> : null}
                          <b>{s.name}</b>
                          <button type="button" className="du" onClick={() => moveSubject(s.id, 1)}>
                            ↓
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="prev">
                  <div className="pt">شكل خطتك</div>
                  {orderMode === "sequential" ? (
                    <>
                      <div className="tl">
                        {orderedSubjects.map((s) => {
                          const theme = getSubjectTheme(resolveSubjectKey(s.name));
                          return (
                            <div key={s.id} className="seg" style={{ flex: 1, "--c": theme?.color, background: theme?.color }}>
                              <b>{s.name}</b>
                            </div>
                          );
                        })}
                      </div>
                      <div className="tl-ax">
                        <span dir="ltr">{formatShort(form.start_date)}</span>
                        <span dir="ltr">{formatShort(endDate)}</span>
                      </div>
                      <div className="pnote">
                        {orderedSubjects.length
                          ? `تبدأ بـ${orderedSubjects[0].name} كاملة، ثم ${orderedSubjects
                              .slice(1)
                              .map((s) => s.name)
                              .join("، ثم ")}.`
                          : "اختر المواد لعرض شكل الخطة."}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="wgrid">
                        {Array.from({ length: Math.min(9, Math.max(orderedSubjects.length * 2, 4)) }, (_, i) => {
                          const s = orderedSubjects[i % Math.max(orderedSubjects.length, 1)];
                          if (!s) return null;
                          const theme = getSubjectTheme(resolveSubjectKey(s.name));
                          return (
                            <div key={i} className="wc" style={{ "--c": theme?.color, "--bg": theme?.soft }}>
                              <small>الأسبوع {i + 1}</small>
                              <b>{s.name}</b>
                            </div>
                          );
                        })}
                      </div>
                      <div className="pnote">
                        كل أسبوع مادة واحدة، وتتكرر الدورة
                        {orderedSubjects.length ? `: ${orderedSubjects.map((s) => s.name).join(" ← ")}.` : "."}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {plan && (
              <button type="button" className="vadd" style={{ marginBottom: 12 }} onClick={() => setShowWizard(false)}>
                إلغاء
              </button>
            )}
          </div>

          <aside className="side">
            <div className="sum">
              <h3>ملخص الخطة</h3>
              <div className="si">
                <span>المواد</span>
                <div className="tags">
                  {orderedSubjects.map((s) => (
                    <i key={s.id} className="tg">
                      {s.name}
                    </i>
                  ))}
                </div>
              </div>
              <div className="si">
                <span>من</span>
                <b dir="ltr">{formatAr(form.start_date)}</b>
              </div>
              <div className="si">
                <span>إلى</span>
                <b dir="ltr">{formatAr(endDate)}</b>
              </div>
              <div className="si">
                <span>الترتيب</span>
                <b>{orderMode === "sequential" ? "مادة بعد مادة" : "مادة كل أسبوع"}</b>
              </div>
              <div className="si">
                <span>الإجازة</span>
                <b>{offLabel}</b>
              </div>
              <div className="si">
                <span>دروس منجزة</span>
                <b>{doneLessons.length} دروس</b>
              </div>
              <div className="big">
                <div>
                  <strong>{studyDays}</strong>
                  <small>يوم مذاكرة</small>
                </div>
                <div>
                  <strong>{remainingLessons}</strong>
                  <small>درس متبقي</small>
                </div>
              </div>
              <button
                type="button"
                className="start"
                disabled={busy || !form.subject_ids.length}
                onClick={generate}
                style={{ width: "100%", border: 0, cursor: "pointer" }}
              >
                {busy ? "جاري التوليد…" : "ولّد جدولي الذكي ←"}
              </button>
            </div>
          </aside>
        </div>
      )}

      {plan && !showWizard && (
        <>
          <div className="box" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div>
              <strong style={{ fontSize: 18 }}>{plan.title}</strong>
              <div style={{ color: "var(--mu)", fontSize: 14, marginTop: 4 }}>
                {plan.days_count} يوم · {plan.hours_per_day} ساعة/يوم · {plan.done_count}/{plan.total_count} مهمة
              </div>
            </div>
            <div style={{ minWidth: 160 }}>
              <div style={{ height: 8, background: "#eef2fb", borderRadius: 8, overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${progressPct}%`, background: "#156eb0" }} />
              </div>
              <div style={{ marginTop: 6, fontWeight: 700 }}>{progressPct}%</div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "18px 0" }}>
            <button type="button" className="vadd" disabled={selectedDay <= 1} onClick={() => setSelectedDay((d) => d - 1)}>
              ← السابق
            </button>
            <div style={{ textAlign: "center", fontWeight: 800 }}>
              اليوم {selectedDay}
              {selectedDay === plan.today_day_index ? " · اليوم" : ""}
              <div style={{ fontSize: 13, color: "var(--mu)", fontWeight: 500 }}>{dayTasks[0]?.task_date || ""}</div>
            </div>
            <button type="button" className="vadd" disabled={selectedDay >= plan.days_count} onClick={() => setSelectedDay((d) => d + 1)}>
              التالي →
            </button>
          </div>

          <div style={{ marginBottom: 12, color: "var(--mu)", fontSize: 14 }}>
            مهام هذا اليوم: {dayDone}/{dayTasks.length}
          </div>

          {dayTasks.map((task) => {
            const href = taskLink(task);
            const key = resolveSubjectKey(task.subject_name);
            const theme = getSubjectTheme(key);
            return (
              <div
                key={task.id}
                className="orow"
                style={{ "--c": theme?.color || "#156eb0", "--bg": theme?.soft || "#e8f3fb", marginBottom: 10, opacity: task.is_done ? 0.7 : 1 }}
              >
                <span className="on">{KIND_LABEL[task.kind]?.[0] || "·"}</span>
                <div style={{ flex: 1 }}>
                  <b style={{ display: "block" }}>{task.title}</b>
                  <span className="dr">
                    {KIND_LABEL[task.kind] || task.kind}
                    {task.detail ? ` · ${task.detail}` : ""} · ≈ {task.estimated_minutes} د
                  </span>
                </div>
                {href && (
                  <Link to={href} className="du">
                    ابدأ
                  </Link>
                )}
                <button type="button" className="du" onClick={() => toggleTask(task)}>
                  {task.is_done ? "تراجع" : "تم ✓"}
                </button>
              </div>
            );
          })}

          {dayTasks.length === 0 && <p style={{ color: "var(--mu)" }}>لا مهام لهذا اليوم.</p>}
        </>
      )}
    </div>
  );
}
