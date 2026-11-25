import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { teachableSubjectIds } from "../auth/teacherScope";
import client from "../api/client";
import { joinLiveSession } from "../utils/joinLiveSession";
import { toArabicDigits } from "../utils/sessionDate";
import {
  DEFAULT_LOGO,
  getSubjectTheme,
  resolveSubjectKey,
  subjectClass,
} from "../theme/subjects";
import "../styles/teacher-home.css";

function formatCountdown(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function barClass(color) {
  if (color === "green") return "bar-green";
  if (color === "orange") return "bar-orange";
  return "bar-red";
}

function textClass(color) {
  if (color === "green") return "c-green";
  if (color === "orange") return "c-orange";
  return "c-red";
}

function statusPillClass(key) {
  if (key === "ok") return "st-ok";
  if (key === "late1") return "st-1";
  return "st-n";
}

export default function TeacherPanel() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [joiningId, setJoiningId] = useState(null);
  const [remindMsg, setRemindMsg] = useState("");
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    client
      .get("/teacher/home/")
      .then((res) => setData(res.data))
      .catch((e) => {
        setError(e.response?.data?.detail || "تعذّر تحميل رئيسية المدرس");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Soft refresh every 30s so live/join state stays current
  useEffect(() => {
    const id = window.setInterval(load, 30000);
    return () => window.clearInterval(id);
  }, [load]);

  const themeKey = useMemo(() => {
    if (data?.subject) return resolveSubjectKey(data.subject);
    const ids = teachableSubjectIds(user);
    if (user?.taught_subject_name) return resolveSubjectKey(user.taught_subject_name);
    if (Array.isArray(ids) && ids.length) return null;
    return null;
  }, [data, user]);

  const theme = getSubjectTheme(themeKey);
  const skin = subjectClass(themeKey);
  const logoSrc = theme?.logo || DEFAULT_LOGO;

  const next = data?.next_class;
  const remainingSec = useMemo(() => {
    void tick;
    if (!next?.start_time) return 0;
    const start = new Date(next.start_time).getTime();
    if (Number.isNaN(start)) return next.remaining_seconds || 0;
    return Math.max(0, Math.floor((start - Date.now()) / 1000));
  }, [next, tick]);

  const started = next && remainingSec <= 0;

  async function handleJoin(sessionId) {
    if (!sessionId || joiningId) return;
    setJoiningId(sessionId);
    setError("");
    try {
      await joinLiveSession(sessionId);
      load();
    } catch (e) {
      setError(e.response?.data?.detail || "تعذّر دخول الحصة");
    } finally {
      setJoiningId(null);
    }
  }

  async function handleRemind(studentId) {
    setRemindMsg("");
    try {
      const res = await client.post(`/teacher/students/${studentId}/remind/`, {
        subject_id: data?.subject?.id,
      });
      setRemindMsg(res.data?.detail || "تم إرسال التذكير");
      setData((d) => {
        if (!d) return d;
        return {
          ...d,
          students: (d.students || []).map((s) =>
            s.id === studentId ? { ...s, reminded_recently: true } : s,
          ),
        };
      });
    } catch (e) {
      const reason = e.response?.data?.reason;
      const detail =
        e.response?.data?.detail || e.response?.data?.reason || "تعذّر التذكير";
      if (reason === "cooldown" || e.response?.status === 429) {
        setData((d) => {
          if (!d) return d;
          return {
            ...d,
            students: (d.students || []).map((s) =>
              s.id === studentId ? { ...s, reminded_recently: true } : s,
            ),
          };
        });
      }
      setRemindMsg(detail);
    }
  }

  const groups = data?.groups || [];
  const students = data?.students || [];
  const filtered = useMemo(() => {
    if (filter === "all") return students;
    if (filter === "late") return students.filter((s) => s.status?.is_late);
    const gid = Number(filter);
    return students.filter((s) => Number(s.group_id) === gid);
  }, [students, filter]);

  function classAction(row) {
    if (row.action === "rate") {
      return (
        <Link className="btn red" to={`/teacher/sessions/${row.id}/rate`}>
          ⭐ قيّم الحصة
        </Link>
      );
    }
    if (row.action === "rated") {
      return <span className="btn done">✓ تم التقييم</span>;
    }
    if (row.action === "join") {
      return (
        <button
          type="button"
          className="btn"
          disabled={joiningId === row.id}
          onClick={() => handleJoin(row.id)}
        >
          {joiningId === row.id ? "…" : "دخول الحصة"}
        </button>
      );
    }
    return <span className="btn dis">لم تبدأ</span>;
  }

  if (loading && !data) {
    return (
      <div className={`thome ${skin}`}>
        <div className="spinner">جاري تحميل الرئيسية…</div>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const myClasses = data?.my_classes || [];

  return (
    <div className={`thome ${skin}`}>
      {error && <div className="banner-err">{error}</div>}
      {remindMsg && (
        <div className="banner-err" style={{ color: "var(--th-brand-dark)", borderColor: "var(--th-line)", background: "#fff" }}>
          {remindMsg}
        </div>
      )}

      <div className="th">
        <div className="who">
          <div className="lg">
            <img src={logoSrc} alt={data?.subject?.name || "المادة"} />
          </div>
          <div>
            <div className="role">{data?.subject?.role_label || "مدرس"}</div>
            <h1>{data?.teacher?.greeting || "أهلاً 👋"}</h1>
            <p>{data?.summary?.text || ""}</p>
          </div>
        </div>

        {next ? (
          <div className="next">
            <div className="cd">
              <b>{toArabicDigits(formatCountdown(remainingSec))}</b>
              <small className="mut">{started ? "بدأت" : "تبدأ بعد"}</small>
            </div>
            <div className="t">
              <b>{next.title}</b>
              <small>
                {next.group_name}
                {next.time_label ? ` · ${next.time_label}` : ""}
              </small>
            </div>
            {next.can_join || started ? (
              <button
                type="button"
                className="btn"
                disabled={joiningId === next.id}
                onClick={() => handleJoin(next.id)}
              >
                {joiningId === next.id ? "…" : "دخول الحصة"}
              </button>
            ) : (
              <span className="btn dis">دخول الحصة</span>
            )}
          </div>
        ) : (
          <div className="next next-empty">لا حصص قادمة في جدولك حالياً</div>
        )}
      </div>

      <div className="kpis">
        <div className="kpi">
          <span className="ic">📅</span>
          <div>
            <b>{toArabicDigits(kpis.classes_today ?? 0)}</b>
            <small>حصص اليوم</small>
          </div>
        </div>
        <div className="kpi">
          <span className="ic">👥</span>
          <div>
            <b>{toArabicDigits(kpis.students ?? 0)}</b>
            <small>
              طالب في {toArabicDigits(kpis.groups ?? 0)} مجموعات
            </small>
          </div>
        </div>
        <div className="kpi">
          <span className="ic">✅</span>
          <div>
            <b>{toArabicDigits(`${kpis.completion_pct ?? 0}%`)}</b>
            <small>إنجاز الواجبات والتجميعات</small>
          </div>
        </div>
        <div className="kpi">
          <span className="ic">⭐</span>
          <div>
            <b className="kpi-red">{toArabicDigits(kpis.needs_rating ?? 0)}</b>
            <small>حصة تحتاج تقييم</small>
          </div>
        </div>
      </div>

      <div className="two">
        <div className="card">
          <div className="card-h">
            <h2>حصصي</h2>
            <Link className="link" to="/teacher/schedule">
              جدول الحصص كامل ←
            </Link>
          </div>
          {myClasses.length === 0 && (
            <p className="empty">لا حصص اليوم أو أمس — راجع الجدول الكامل.</p>
          )}
          {myClasses.map((row) => (
            <div
              key={row.id}
              className={`cl${row.tone === "rate" ? " rate" : ""}${
                row.tone === "now" ? " now" : ""
              }`}
            >
              <div className="tm">
                <b>{row.time_label}</b>
                <small>{row.day_label}</small>
              </div>
              <div className="t">
                <b>{row.title}</b>
                <small>
                  {row.group_name}
                  {row.student_count != null
                    ? ` · ${toArabicDigits(row.student_count)} طالب`
                    : ""}
                </small>
              </div>
              {classAction(row)}
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-h">
            <h2>إنجاز المهام اليوم</h2>
            <Link className="link" to="/teacher/tasks">
              كل المهام ←
            </Link>
          </div>
          {groups.length === 0 && (
            <p className="empty">لا مجموعات مرتبطة بحسابك بعد.</p>
          )}
          {groups.map((g) => (
            <div key={g.id} className="grp">
              <div className="gh">
                <b>{g.name}</b>
                <span className="mut">
                  متأخرين{" "}
                  <b className="c-red">{toArabicDigits(g.late_count)}</b>
                </span>
              </div>
              <div className="ln">
                <span>واجبات</span>
                <div className="bar">
                  <i
                    className={barClass(g.homework?.color)}
                    style={{ width: `${g.homework?.pct || 0}%` }}
                  />
                </div>
                <em className={textClass(g.homework?.color)}>
                  {toArabicDigits(`${g.homework?.done || 0}/${g.homework?.total || 0}`)}
                </em>
              </div>
              <div className="ln">
                <span>تجميعات</span>
                <div className="bar">
                  <i
                    className={barClass(g.collections?.color)}
                    style={{ width: `${g.collections?.pct || 0}%` }}
                  />
                </div>
                <em className={textClass(g.collections?.color)}>
                  {toArabicDigits(
                    `${g.collections?.done || 0}/${g.collections?.total || 0}`,
                  )}
                </em>
              </div>
            </div>
          ))}
          <p className="mut sm">
            أخضر ≥80% · برتقالي <bdi dir="ltr">50–79</bdi>% · أحمر &lt;50%
          </p>
        </div>
      </div>

      <div className="card follow">
        <div className="card-h">
          <h2>متابعة الطلاب</h2>
          <div className="chips">
            <button
              type="button"
              className={`chip${filter === "all" ? " on" : ""}`}
              onClick={() => setFilter("all")}
            >
              الكل
            </button>
            <button
              type="button"
              className={`chip${filter === "late" ? " on" : ""}`}
              onClick={() => setFilter("late")}
            >
              المتأخرين
            </button>
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                className={`chip${filter === String(g.id) || filter === g.id ? " on" : ""}`}
                onClick={() => setFilter(g.id)}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>الطالب</th>
                <th>واجبات اليوم</th>
                <th>تجميعات اليوم</th>
                <th>آخر نشاط</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={`${s.id}-${s.group_id}`}>
                  <td>
                    <div className="row">
                      <span className="avatar">{s.initial || "?"}</span>
                      <div>
                        {s.full_name}
                        <br />
                        <small className="mut">{s.group_name}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {toArabicDigits(`${s.homework_done}/${s.homework_total}`)}
                  </td>
                  <td>
                    {toArabicDigits(
                      `${s.collection_done}/${s.collection_total}`,
                    )}
                  </td>
                  <td>{s.last_activity || "—"}</td>
                  <td>
                    <span className={`pill ${statusPillClass(s.status?.key)}`}>
                      {s.status?.label || "—"}
                    </span>
                  </td>
                  <td>
                    {s.status?.is_late ? (
                      s.reminded_recently ? (
                        <span className="pill p-green">اتبعت ✓</span>
                      ) : (
                        <button
                          type="button"
                          className="btn soft"
                          onClick={() => handleRemind(s.id)}
                        >
                          تذكير
                        </button>
                      )
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filter === "late" && filtered.length === 0 && (
          <p className="empty">مفيش متأخرين 👏</p>
        )}
        {filter !== "late" && filtered.length === 0 && (
          <p className="empty">لا طلاب في هذا الفلتر.</p>
        )}
        <p className="mut sm" style={{ marginTop: 14 }}>
          &quot;تذكير&quot; = رسالة تليجرام لولي الأمر بالمهام المتأخرة (مهمة 33).
        </p>
      </div>
    </div>
  );
}
