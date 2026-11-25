import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import client from "../api/client";
import {
  getSubjectTheme,
  resolveSubjectKey,
  subjectClass,
} from "../theme/subjects";
import "./Results.css";

const PERIODS = [
  { id: "today", label: "اليوم" },
  { id: "7d", label: "آخر 7 أيام" },
  { id: "30d", label: "آخر 30 يوم" },
  { id: "90d", label: "آخر 3 شهور" },
  { id: "all", label: "الكل" },
];

const TABS = [
  { id: "all", label: "الكل" },
  { id: "simulator", label: "المحاكي" },
  { id: "teacher", label: "اختبارات المدرسين" },
  { id: "collections", label: "التجميعات" },
];

const PAGE_SIZE = 10;

function ringColor(percent) {
  if (percent < 50) return { rc: "#dc2626", text: "#dc2626" };
  if (percent < 80) return { rc: "#f59e0b", text: "#c26a00" };
  return { rc: "#16a34a", text: "#16a34a" };
}

function ScoreRing({ percent }) {
  const p = Math.max(0, Math.min(100, Math.round(percent || 0)));
  const { rc, text } = ringColor(p);
  return (
    <div className="ring" style={{ "--p": p, "--rc": rc }}>
      <span style={{ color: text }}>{p}%</span>
    </div>
  );
}

function fmtScore(v) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${Math.round(v)}%`;
}

export default function Results() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const period = PERIODS.some((p) => p.id === searchParams.get("period"))
    ? searchParams.get("period")
    : "all";
  const tabParam = searchParams.get("tab") || "all";
  const isSilver = Boolean(user?.is_silver);
  const tab =
    isSilver && tabParam === "teacher"
      ? "all"
      : TABS.some((t) => t.id === tabParam)
        ? tabParam
        : "all";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    client
      .get(`/results/?period=${period}`)
      .then((res) => {
        if (!cancelled) {
          setData(res.data);
          setVisible(PAGE_SIZE);
        }
      })
      .catch(() => {
        if (!cancelled) setError("تعذّر تحميل النتائج");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  function setPeriod(id) {
    const next = new URLSearchParams(searchParams);
    if (id === "all") next.delete("period");
    else next.set("period", id);
    setSearchParams(next, { replace: true });
  }

  function setTab(id) {
    const next = new URLSearchParams(searchParams);
    if (id === "all") next.delete("tab");
    else next.set("tab", id);
    setSearchParams(next, { replace: true });
    setVisible(PAGE_SIZE);
  }

  const attempts = useMemo(() => {
    const rows = data?.attempts || [];
    if (tab === "simulator") return rows.filter((r) => r.exam_type === "simulator");
    if (tab === "teacher") return rows.filter((r) => r.exam_type === "teacher");
    return rows;
  }, [data?.attempts, tab]);

  const shown = attempts.slice(0, visible);
  const stats = data?.stats || {};
  const showTeacher = data?.show_teacher_tab !== false && !isSilver;
  const tabs = TABS.filter((t) => t.id !== "teacher" || showTeacher);

  if (loading && !data) return <div className="spinner">جاري التحميل…</div>;

  return (
    <div className="results-page">
      <div className="rh">
        <div>
          <h1>نتائجي</h1>
          <p>مستواك في كل الاختبارات والمحاكيات</p>
        </div>
        <div className="stats">
          <div className="hstat">
            <b>{stats.attempt_count ?? 0}</b>
            <small>اختبار</small>
          </div>
          <div className="hstat">
            <b>{fmtScore(stats.avg_score)}</b>
            <small>متوسط الدرجات</small>
          </div>
          <div className="hstat">
            <b>{fmtScore(stats.best_score)}</b>
            <small>أعلى درجة</small>
          </div>
          {!stats.improvement_hidden && stats.improvement != null && (
            <div className="hstat">
              <b dir="ltr">
                {stats.improvement > 0 ? "+" : ""}
                {Math.round(stats.improvement)}%
              </b>
              <small className={stats.improvement >= 0 ? "up" : "down"}>
                {stats.improvement >= 0 ? "▲" : "▼"} {stats.improvement_label}
              </small>
            </div>
          )}
        </div>
      </div>

      <div className="filter">
        <div className="row">
          <b style={{ fontSize: 17 }}>الفترة:</b>
          <div className="seg">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={period === p.id ? "on" : ""}
                onClick={() => setPeriod(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <span className="mut sm">
          الفلتر بيغيّر كل الأرقام في الصفحة · التجميعات مش داخلة في التحليل
        </span>
      </div>

      {error && <p className="empty">{error}</p>}

      <div className="card">
        <div className="card-h">
          <h2>مستواك في كل مادة</h2>
          <span className="mut">متوسط الدرجات</span>
        </div>
        <div className="subjects">
          {(data?.subjects || []).map((s) => {
            const key = resolveSubjectKey(s);
            const theme = getSubjectTheme(key);
            const pct = s.percent;
            return (
              <div key={s.id} className={`sc ${subjectClass(key)}`}>
                <div className="lg">
                  {theme?.logo ? (
                    <img src={theme.logo} alt={s.name} />
                  ) : (
                    s.name
                  )}
                </div>
                <div className="grow">
                  <div className="nm">
                    <b>{s.name}</b>
                    <span>{pct == null ? "—" : `${Math.round(pct)}%`}</span>
                  </div>
                  <div className="bar">
                    <i style={{ width: `${pct == null ? 0 : Math.round(pct)}%` }} />
                  </div>
                  <small className="mut">
                    {s.attempt_count
                      ? `${s.attempt_count} اختبارات`
                      : "لا توجد اختبارات"}
                  </small>
                </div>
              </div>
            );
          })}
          {!data?.subjects?.length && (
            <p className="empty">لا توجد مواد بعد.</p>
          )}
        </div>
      </div>

      <div className={`main${tab === "collections" ? " is-collections" : ""}`}>
        {tab !== "collections" && (
          <div className="card focus">
            <div className="card-h">
              <h2>دروس تحتاج تركيز</h2>
              <span>🎯</span>
            </div>
            {(data?.focus_lessons || []).length === 0 && (
              <p className="empty">لا توجد دروس تحتاج تركيز في الفترة دي.</p>
            )}
            {(data?.focus_lessons || []).map((row, i) => {
              const key = resolveSubjectKey(row);
              return (
                <div
                  key={row.lesson_id}
                  className={`it ${subjectClass(key)}`}
                  style={
                    i === (data.focus_lessons?.length || 0) - 1
                      ? { border: 0 }
                      : undefined
                  }
                >
                  <span className="dot" />
                  <div className="grow">
                    <b>{row.lesson_title}</b>
                    <small>
                      {row.subject_name} · نسبة الإجابة {Math.round(row.percent)}%
                    </small>
                  </div>
                  <Link
                    className="btn-soft"
                    to={`/courses/${row.subject_id}/collections/${row.lesson_id}`}
                  >
                    تدرّب ←
                  </Link>
                </div>
              );
            })}
            <p className="mut sm" style={{ marginTop: 12 }}>
              أضعف 5 دروس (≥10 أسئلة محلولة) · &quot;تدرّب&quot; يفتح تجميعات الدرس مباشرة
            </p>
          </div>
        )}

        <div className="card">
          <div className="card-h">
            <h2>كل النتائج</h2>
            <div className="seg">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={tab === t.id ? "on" : ""}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {tab === "collections" ? (
            <>
              {(data?.collections || []).length === 0 ? (
                <p className="empty">لا توجد نتائج تجميعات في الفترة دي.</p>
              ) : (
                <table className="tbl collect">
                  <thead>
                    <tr>
                      <th>الدرس</th>
                      <th>المادة</th>
                      <th>محلول</th>
                      <th>صح</th>
                      <th>غلط</th>
                      <th>النسبة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.collections.map((row) => {
                      const key = resolveSubjectKey(row);
                      return (
                        <tr key={row.lesson_id}>
                          <td>{row.lesson_title}</td>
                          <td>
                            <span className={`pill p-subj ${subjectClass(key)}`}>
                              {row.subject_name}
                            </span>
                          </td>
                          <td>
                            <bdi dir="ltr">
                              {row.solved} / {row.total_in_lesson}
                            </bdi>
                          </td>
                          <td style={{ color: "#16a34a" }}>{row.correct}</td>
                          <td style={{ color: "#dc2626" }}>{row.wrong}</td>
                          <td>
                            {row.percent == null ? "—" : `${Math.round(row.percent)}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            <>
              {shown.length === 0 && (
                <p className="empty">لا توجد نتائج في الفترة دي.</p>
              )}
              {shown.map((e) => (
                <div key={e.id} className="res">
                  <ScoreRing percent={e.percent} />
                  <div>
                    <h4>
                      {e.title}{" "}
                      <span className="pill">{e.type_badge}</span>
                    </h4>
                    <div className="meta">
                      {(e.subjects || []).map((s) => (
                        <span
                          key={s.id}
                          className={`pill p-subj ${subjectClass(resolveSubjectKey(s))}`}
                        >
                          {s.name}
                        </span>
                      ))}
                      <span>
                        {e.date_label}
                        {e.duration_minutes != null
                          ? ` · ${e.duration_minutes} دقيقة`
                          : ""}
                      </span>
                    </div>
                  </div>
                  <div className="boxes">
                    <div className="bx ok">
                      <b>{e.correct_count}</b>
                      <small>صح</small>
                    </div>
                    <div className="bx no">
                      <b>{e.wrong_count}</b>
                      <small>غلط</small>
                    </div>
                    <div className="bx sk">
                      <b>{e.unanswered_count}</b>
                      <small>لم تُجب</small>
                    </div>
                  </div>
                  <Link className="btn-brand" to={`/results/${e.id}`}>
                    مراجعة ←
                  </Link>
                </div>
              ))}
              {visible < attempts.length && (
                <button
                  type="button"
                  className="loadmore"
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                >
                  عرض نتائج أقدم ⌄
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
