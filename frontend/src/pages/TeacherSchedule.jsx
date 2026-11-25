import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import client from "../api/client";
import { joinLiveSession } from "../utils/joinLiveSession";
import { toArabicDigits } from "../utils/sessionDate";
import { resolveSubjectKey, subjectClass } from "../theme/subjects";
import "../styles/teacher-classes.css";

function pillClass(tone) {
  if (tone === "red") return "p-red";
  if (tone === "green") return "p-green";
  if (tone === "orange") return "p-orange";
  if (tone === "blue") return "p-blue";
  return "p-grey";
}

function ClassRow({
  row,
  joiningId,
  onJoin,
  detailsId,
  onToggleDetails,
  attendance,
  attendanceBusy,
  onSetStatus,
  onSaveAttendance,
}) {
  const open = detailsId === row.id;

  function actions() {
    if (row.action === "rate") {
      return (
        <Link className="btn red" to={`/teacher/sessions/${row.id}/rate`}>
          ⭐ قيّم الحصة
        </Link>
      );
    }
    if (row.action === "rated") {
      return (
        <Link className="btn done" to={`/teacher/sessions/${row.id}/rate`}>
          ✓ عرض التقييم
        </Link>
      );
    }
    if (row.action === "join") {
      return (
        <button
          type="button"
          className="btn"
          disabled={joiningId === row.id}
          onClick={() => onJoin(row.id)}
        >
          {joiningId === row.id ? "…" : "دخول الحصة"}
        </button>
      );
    }
    return (
      <button
        type="button"
        className="btn ghost"
        onClick={() => onToggleDetails(row.id)}
      >
        {open ? "إغلاق" : "تفاصيل"}
      </button>
    );
  }

  return (
    <div>
      <div
        className={`cl${row.tone === "rate" ? " rate" : ""}${
          row.tone === "soon" ? " soon" : ""
        }${row.tone === "extra" || row.is_extra ? " extra" : ""}`}
      >
        <div className="tm">
          <b>{row.time_label}</b>
          <small>{row.duration_label}</small>
        </div>
        <div className="t">
          <b>
            {row.title}
            {(row.pills || []).map((p) => (
              <span key={p.key} className={`pill ${pillClass(p.tone)}`}>
                {p.label}
              </span>
            ))}
          </b>
          <small>{row.meta}</small>
        </div>
        {actions()}
      </div>
      {open && (
        <div className="details">
          {attendanceBusy && !attendance ? (
            <p className="mut">جاري تحميل الطلاب…</p>
          ) : attendance ? (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <button type="button" className="btn ghost" onClick={() => onSetStatus(null, "present")}>
                  الكل حاضر
                </button>
                <button type="button" className="btn ghost" onClick={() => onSetStatus(null, "absent")}>
                  الكل غائب
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={attendanceBusy}
                  onClick={onSaveAttendance}
                >
                  حفظ الحضور
                </button>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>الطالب</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {(attendance.records || []).map((r) => (
                    <tr key={r.student_id}>
                      <td>{r.full_name}</td>
                      <td>
                        <select
                          value={r.status || ""}
                          onChange={(e) =>
                            onSetStatus(r.student_id, e.target.value || null)
                          }
                        >
                          <option value="">—</option>
                          <option value="present">حاضر</option>
                          <option value="absent">غائب</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="mut">لا بيانات حضور.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function TeacherSchedule() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "schedule";
  const groupParam = searchParams.get("group") || "";
  const dateParam = searchParams.get("date") || "";
  const monthParam = searchParams.get("month") || "";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [joiningId, setJoiningId] = useState(null);
  const [detailsId, setDetailsId] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [attendanceBusy, setAttendanceBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    const params = {};
    if (groupParam) params.group = groupParam;
    if (dateParam) params.date = dateParam;
    if (monthParam) params.month = monthParam;
    client
      .get("/teacher/classes/", { params })
      .then((res) => setData(res.data))
      .catch((e) => {
        setError(e.response?.data?.detail || "تعذّر تحميل الحصص");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [groupParam, dateParam, monthParam]);

  useEffect(() => {
    load();
  }, [load]);

  const skin = subjectClass(resolveSubjectKey(data?.subject));

  function setParam(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value == null || value === "") next.delete(key);
    else next.set(key, String(value));
    setSearchParams(next);
  }

  async function handleJoin(sessionId) {
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

  async function toggleDetails(sessionId) {
    if (detailsId === sessionId) {
      setDetailsId(null);
      setAttendance(null);
      return;
    }
    setDetailsId(sessionId);
    setAttendance(null);
    setAttendanceBusy(true);
    try {
      const res = await client.get(`/sessions/${sessionId}/attendance/`);
      setAttendance(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || "تعذّر تحميل الحضور");
      setDetailsId(null);
    } finally {
      setAttendanceBusy(false);
    }
  }

  function setStudentStatus(studentId, status) {
    setAttendance((prev) => {
      if (!prev) return prev;
      if (studentId == null) {
        return {
          ...prev,
          records: prev.records.map((r) => ({ ...r, status })),
        };
      }
      return {
        ...prev,
        records: prev.records.map((r) =>
          r.student_id === studentId ? { ...r, status } : r,
        ),
      };
    });
  }

  async function saveAttendance() {
    if (!detailsId || !attendance) return;
    setAttendanceBusy(true);
    try {
      const res = await client.put(`/sessions/${detailsId}/attendance/`, {
        records: attendance.records.map((r) => ({
          student_id: r.student_id,
          status: r.status || null,
          note: r.note || "",
        })),
      });
      setAttendance(res.data);
      load();
    } catch (e) {
      setError(e.response?.data?.detail || "تعذّر حفظ الحضور");
    } finally {
      setAttendanceBusy(false);
    }
  }

  const groups = data?.groups || [];
  const week = data?.week || [];
  const needs = data?.needs_rating || {};

  const rowProps = useMemo(
    () => ({
      joiningId,
      onJoin: handleJoin,
      detailsId,
      onToggleDetails: toggleDetails,
      attendance: detailsId ? attendance : null,
      attendanceBusy,
      onSetStatus: setStudentStatus,
      onSaveAttendance: saveAttendance,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [joiningId, detailsId, attendance, attendanceBusy],
  );

  if (loading && !data) {
    return (
      <div className={`tcls ${skin}`}>
        <div className="spinner">جاري تحميل الحصص…</div>
      </div>
    );
  }

  return (
    <div className={`tcls ${skin}`}>
      {error && <div className="banner-err">{error}</div>}

      <div className="ph">
        <div>
          <h1>حصصي</h1>
          <span className="mut">{data?.header?.subtitle || ""}</span>
        </div>
        <div className="chips">
          <button
            type="button"
            className={`chip${!groupParam ? " on" : ""}`}
            onClick={() => setParam("group", "")}
          >
            الكل
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`chip${String(groupParam) === String(g.id) ? " on" : ""}`}
              onClick={() => setParam("group", g.id)}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={tab === "schedule" ? "on" : ""}
          onClick={() => setParam("tab", "schedule")}
        >
          جدول الحصص
        </button>
        <Link to="/teacher/availability">مواعيدي المتاحة</Link>
        <button
          type="button"
          className={tab === "past" ? "on" : ""}
          onClick={() => setParam("tab", "past")}
        >
          الحصص السابقة
        </button>
      </div>

      {tab !== "past" && (
        <>
          {needs.count > 0 && (
            <div className="alert">
              <span>{needs.text}</span>
              <Link
                className="btn red"
                to={`/teacher/sessions/${needs.oldest_id}/rate`}
              >
                قيّم الآن ←
              </Link>
            </div>
          )}

          <div className="card">
            <div className="week">
              {week.map((d) => (
                <button
                  key={d.date}
                  type="button"
                  className={`wd${d.is_selected ? " on" : ""}`}
                  onClick={() => setParam("date", d.date)}
                >
                  <small>{d.weekday}</small>
                  <b>{toArabicDigits(d.day)}</b>
                  <span>{d.count_label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>{data?.selected_heading}</h2>
            </div>
            {(data?.selected_sessions || []).length === 0 && (
              <p className="empty">لا حصص في هذا اليوم.</p>
            )}
            {(data?.selected_sessions || []).map((row) => (
              <ClassRow key={row.id} row={row} {...rowProps} />
            ))}
          </div>

          <div className="two">
            <div className="card" style={{ marginTop: 0 }}>
              <div className="card-h">
                <h2>{data?.tomorrow?.heading}</h2>
              </div>
              {(data?.tomorrow?.sessions || []).length === 0 && (
                <p className="empty">لا حصص غداً.</p>
              )}
              {(data?.tomorrow?.sessions || []).map((row) => (
                <ClassRow key={row.id} row={row} {...rowProps} />
              ))}
            </div>
            <div className="card" style={{ marginTop: 0 }}>
              <div className="card-h">
                <h2>حصص سابقة</h2>
                <button
                  type="button"
                  className="link"
                  onClick={() => setParam("tab", "past")}
                >
                  عرض الكل ←
                </button>
              </div>
              {(data?.recent_past || []).length === 0 && (
                <p className="empty">لا حصص سابقة قريبة.</p>
              )}
              {(data?.recent_past || []).map((row) => (
                <ClassRow key={row.id} row={row} {...rowProps} />
              ))}
            </div>
          </div>
        </>
      )}

      {tab === "past" && (
        <div className="card" style={{ marginTop: 0 }}>
          <div className="card-h">
            <h2>الحصص السابقة</h2>
            <div className="row" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div className="chips">
                <button
                  type="button"
                  className={`chip${!groupParam ? " on" : ""}`}
                  onClick={() => setParam("group", "")}
                >
                  الكل
                </button>
                {groups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={`chip${String(groupParam) === String(g.id) ? " on" : ""}`}
                    onClick={() => setParam("group", g.id)}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
              <select
                className="month-select"
                value={monthParam || data?.past?.month || ""}
                onChange={(e) => setParam("month", e.target.value)}
              >
                {(data?.past?.months || []).map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>الحصة</th>
                  <th>المجموعة</th>
                  <th>الحضور</th>
                  <th>الحالة</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(data?.past?.sessions || []).map((row) => {
                  const rated = row.action === "rated";
                  return (
                    <tr key={row.id}>
                      <td>{row.date_label}</td>
                      <td>{row.title}</td>
                      <td>{row.group_name}</td>
                      <td>
                        {toArabicDigits(
                          `${row.attendance?.present || 0}/${row.attendance?.total || 0}`,
                        )}
                      </td>
                      <td>
                        <span className={`pill ${rated ? "p-green" : "p-red"}`}>
                          {rated ? "تم التقييم" : "لم تُقيّم"}
                        </span>
                      </td>
                      <td>
                        {rated ? (
                          <Link
                            className="btn done"
                            to={`/teacher/sessions/${row.id}/rate`}
                          >
                            عرض التقييم
                          </Link>
                        ) : (
                          <Link
                            className="btn red"
                            to={`/teacher/sessions/${row.id}/rate`}
                          >
                            ⭐ قيّم
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {(data?.past?.sessions || []).length === 0 && (
            <p className="empty">لا حصص في هذا الفلتر.</p>
          )}
        </div>
      )}
    </div>
  );
}
