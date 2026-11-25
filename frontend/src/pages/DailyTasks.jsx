import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { resolveSubjectKey, subjectClass } from "../theme/subjects";
import "../styles/daily-tasks.css";

function statusPill(status) {
  if (status === "complete") return ["p-green", "مكتمل ✓"];
  if (status === "partial") return ["p-orange", "جزئي"];
  if (status === "late") return ["p-red", "متأخر"];
  if (status === "today") return ["p-blue", "اليوم"];
  return ["p-blue", "لا مهام"];
}

function ringColor(status) {
  if (status === "complete") return "var(--green)";
  if (status === "partial") return "var(--orange)";
  if (status === "late") return "var(--red)";
  if (status === "today") return "var(--brand)";
  return "#cfd6e0";
}

function subjectCls(name) {
  return subjectClass(resolveSubjectKey(name));
}

function TaskList({ tasks, past }) {
  const hw = tasks.filter((t) => t.type === "homework");
  const col = tasks.filter((t) => t.type === "collection");

  function row(t) {
    const done = Boolean(t.is_done);
    const missed = past && !done;
    const key = resolveSubjectKey(t.subject_name);
    const href =
      t.href ||
      (t.type === "homework"
        ? `/lessons/${t.lesson_id}?hw=${t.homework_sub_lesson_id}`
        : `/courses/${t.subject_id}/collections/${t.collection_lesson_id}`);
    return (
      <div
        key={t.id}
        className={`task ${done ? "done" : ""} ${missed ? "missed" : ""} ${subjectCls(t.subject_name)}`}
      >
        <span className="cb">{done ? "✓" : ""}</span>
        <div className="t">
          <b>{t.title}</b>
          <small>
            {t.question_count || 0} سؤال
            {t.subject_name ? ` · ${t.subject_name}` : ""}
          </small>
        </div>
        {done ? (
          <span className="btn done">✓ تم</span>
        ) : (
          <>
            {missed ? <span className="pill p-red">لم يُنجز</span> : null}
            <Link className="btn" to={href}>
              ابدأ ←
            </Link>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="cols">
      <div className="col">
        <h3>
          <span className="ic">☑️</span>الواجبات
        </h3>
        {hw.map(row)}
        {!hw.length && <p className="mut">لا واجبات</p>}
      </div>
      <div className="col">
        <h3>
          <span className="ic">▦</span>التجميعات
        </h3>
        {col.map(row)}
        {!col.length && <p className="mut">لا تجميعات</p>}
      </div>
    </div>
  );
}

export default function DailyTasks() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [openPast, setOpenPast] = useState(null);
  const [pastOffset, setPastOffset] = useState(0);
  const [pastExtra, setPastExtra] = useState([]);

  function load(offset = 0, append = false) {
    return client
      .get(`/daily-tasks/?past_limit=7&past_offset=${offset}`)
      .then((res) => {
        setData(res.data);
        setErr("");
        if (!selectedDate) setSelectedDate(res.data.today);
        if (append) {
          setPastExtra((prev) => [...prev, ...(res.data.past || [])]);
        } else {
          setPastExtra([]);
          setPastOffset(0);
        }
      })
      .catch((e) => {
        setErr(e.response?.data?.detail || "تعذّر تحميل المهام اليومية");
        setData(null);
      });
  }

  useEffect(() => {
    load(0, false);
  }, []);

  const selectedDay = useMemo(() => {
    if (!data) return null;
    if (selectedDate === data.today) {
      return {
        date: data.today,
        tasks: data.today_tasks || [],
        subject_names: data.subject_today ? [data.subject_today] : [],
        done: data.today_done,
        total: data.today_total,
        status: "today",
        is_today: true,
      };
    }
    const fromWeek = (data.week || []).find((d) => d.date === selectedDate);
    if (fromWeek) return fromWeek;
    const fromPast = [...(data.past || []), ...pastExtra].find((d) => d.date === selectedDate);
    return fromPast || null;
  }, [data, selectedDate, pastExtra]);

  if (err) {
    return (
      <div className="dailyt">
        <div className="banner">{err}</div>
        <Link to="/">العودة للرئيسية</Link>
      </div>
    );
  }

  if (!data) return <div className="spinner">جاري التحميل…</div>;

  const pct = data.today_total
    ? Math.round((100 * data.today_done) / data.today_total)
    : 0;
  const viewTasks = selectedDay?.tasks || [];
  const viewDone = viewTasks.filter((t) => t.is_done).length;
  const viewTotal = viewTasks.length;
  const viewPct = viewTotal ? Math.round((100 * viewDone) / viewTotal) : 0;
  const primarySubject =
    (selectedDay?.subject_names && selectedDay.subject_names[0]) ||
    data.subject_today ||
    "";

  const allPast = [...(data.past || [])];
  // when we appended via "more", pastExtra may duplicate — unique by date
  const pastMap = new Map();
  [...allPast, ...pastExtra].forEach((p) => pastMap.set(p.date, p));
  const pastRows = [...pastMap.values()].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className={`dailyt ${subjectCls(primarySubject)}`}>
      <div className="crumb">
        <Link to="/">الرئيسية</Link> › <b>المهام اليومية</b>
      </div>

      <div className="top">
        <div className="dt-hero">
          <div className="ring lg" style={{ "--p": pct }}>
            <div>
              <b>
                {data.today_done}/{data.today_total || 0}
              </b>
              <small>مهام اليوم</small>
            </div>
          </div>
          <div>
            <div className="date">{data.today_label}</div>
            <h1>المهام اليومية</h1>
            <div style={{ color: "#dbe8ff" }}>{data.message}</div>
          </div>
        </div>
        <div className="card streak">
          <div className="big">
            <span style={{ fontSize: 40 }}>🔥</span>
            <div>
              <b>{data.streak} أيام</b>
              <div className="mut">سلسلة إنجاز متتالية</div>
            </div>
          </div>
          <div className="boxes">
            <div className="box">
              <b>{data.week_pct}%</b>
              <span className="mut sm">نسبة الإنجاز</span>
            </div>
            <div className="box">
              <b>
                {data.week_done} من {data.week_total}
              </b>
              <span className="mut sm">مهام هذا الأسبوع</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 22 }}>
        <div className="card-h">
          <h2>هذا الأسبوع</h2>
          <span className="mut">اضغط على أي يوم لعرض مهامه</span>
        </div>
        <div className="week">
          {(data.week || []).map((d) => {
            const names = d.subject_names || [];
            const cls = names[0] ? subjectCls(names[0]) : "";
            const st = d.status === "empty" && !d.total ? "empty" : d.status;
            return (
              <button
                type="button"
                key={d.date}
                className={`day ${cls}${d.is_today ? " today" : ""}${selectedDate === d.date ? " on" : ""}`}
                onClick={() => setSelectedDate(d.date)}
              >
                <small>{d.weekday}</small>
                <div className="d">{d.day}</div>
                {d.total ? (
                  <div
                    className="ring"
                    style={{ "--p": d.pct, "--rc": ringColor(st) }}
                  >
                    <span>
                      {d.done}/{d.total}
                    </span>
                  </div>
                ) : (
                  <div className="mut" style={{ fontSize: 12, margin: "18px 0" }}>
                    لا مهام
                  </div>
                )}
                {names.map((n) => (
                  <span key={n} className={`pill p-subj ${subjectCls(n)}`} style={{ marginTop: 4 }}>
                    {n}
                  </span>
                ))}
              </button>
            );
          })}
        </div>
        <div className="legend">
          <span>
            <i style={{ background: "var(--green)" }} />
            مكتمل
          </span>
          <span>
            <i style={{ background: "var(--orange)" }} />
            جزئي
          </span>
          <span>
            <i style={{ background: "var(--red)" }} />
            متأخر
          </span>
          <span>
            <i style={{ background: "var(--brand)" }} />
            اليوم
          </span>
        </div>
      </div>

      <div className="card" style={{ marginTop: 22 }}>
        <div className="card-h">
          <div className="row">
            <h2>{selectedDay?.is_today || selectedDate === data.today ? "مهام اليوم" : "مهام اليوم المختار"}</h2>
            {primarySubject ? (
              <span className="pill p-subj" style={{ fontSize: 14, padding: "7px 14px" }}>
                مادة: {primarySubject}
              </span>
            ) : null}
          </div>
          <div className="prog">
            <span>
              {viewDone} من {viewTotal}
            </span>
            <div className="bar">
              <i style={{ width: `${viewPct}%`, background: "var(--brand)" }} />
            </div>
          </div>
        </div>
        <TaskList
          tasks={viewTasks}
          past={selectedDate !== data.today && selectedDate < data.today}
        />
      </div>

      <div className="card" style={{ marginTop: 22 }}>
        <div className="card-h">
          <h2>الأيام السابقة</h2>
          <span className="mut">آخر أيام فيها حصص</span>
        </div>
        {!pastRows.length && (
          <p className="mut">ما فيش أيام سابقة بعد — ابدأ بعد أول حصة تخلص.</p>
        )}
        {pastRows.map((p) => {
          const open = openPast === p.date;
          const [pillCls, pillLabel] = statusPill(p.status);
          const names = p.subject_names || [];
          return (
            <div key={p.date} className={`acc ${open ? "open" : ""} ${names[0] ? subjectCls(names[0]) : ""}`}>
              <button type="button" className="acc-h" onClick={() => setOpenPast(open ? null : p.date)}>
                <div className="when">
                  <b>{p.weekday}</b>
                  <small>{p.label?.split("·")[1]?.trim() || p.date}</small>
                </div>
                <span className="pill p-subj" style={{ justifySelf: "start" }}>
                  {names.join(" · ") || "—"}
                </span>
                <div className="row barcell">
                  <div className="bar">
                    <i
                      style={{
                        width: `${p.pct}%`,
                        background:
                          p.status === "complete"
                            ? "var(--green)"
                            : p.status === "partial"
                              ? "var(--orange)"
                              : "var(--red)",
                      }}
                    />
                  </div>
                  <span className="mut">
                    {p.done} من {p.total} مهام
                  </span>
                </div>
                <span className={`pill ${pillCls}`}>{pillLabel}</span>
                <span className="mut">{open ? "⌃" : "⌄"}</span>
              </button>
              {open && (
                <div className="acc-b">
                  <TaskList tasks={p.tasks || []} past />
                </div>
              )}
            </div>
          );
        })}
        {data.past_has_more || pastOffset + 7 < (data.past || []).length + pastExtra.length ? (
          <button
            type="button"
            className="more"
            onClick={() => {
              const next = pastOffset + 7;
              setPastOffset(next);
              client
                .get(`/daily-tasks/?past_limit=7&past_offset=${next}`)
                .then((res) => {
                  setPastExtra((prev) => [...prev, ...(res.data.past || [])]);
                  setData((d) => ({ ...d, past_has_more: res.data.past_has_more }));
                });
            }}
          >
            عرض أيام أقدم ⌄
          </button>
        ) : null}
      </div>
    </div>
  );
}
