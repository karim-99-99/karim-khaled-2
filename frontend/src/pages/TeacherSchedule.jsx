import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { resolveSubjectKey } from "../theme/subjects";
import { formatSessionWhen, sessionDisplayTitle, effectiveSessionStatus } from "../utils/sessionDate";

/**
 * Teacher view: Zoom link + session status + attendance per group session.
 */
export default function TeacherSchedule() {
  const [sessions, setSessions] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [msg, setMsg] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [view, setView] = useState("all"); // all | upcoming | past
  const [attendanceSessionId, setAttendanceSessionId] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [attendanceBusy, setAttendanceBusy] = useState(false);

  function loadSessions() {
    const params = view === "all" ? {} : { when: view };
    client.get("/sessions/", { params }).then((res) => {
      const rows = res.data.results || res.data;
      setSessions(rows);
      const next = {};
      rows.forEach((s) => {
        next[s.id] = { zoom_link: s.zoom_link || "", status: s.status };
      });
      setDrafts(next);
    });
  }

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  function setDraft(id, key, value) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], [key]: value } }));
  }

  async function saveZoom(session) {
    setMsg("");
    setBusyId(session.id);
    const draft = drafts[session.id] || {};
    try {
      await client.patch(`/sessions/${session.id}/`, {
        zoom_link: draft.zoom_link || "",
        status: draft.status || session.status,
      });
      setMsg("تم حفظ رابط Zoom");
      loadSessions();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر حفظ الرابط");
    } finally {
      setBusyId(null);
    }
  }

  async function openAttendance(session) {
    setMsg("");
    setAttendanceSessionId(session.id);
    setAttendance(null);
    setAttendanceBusy(true);
    try {
      const res = await client.get(`/sessions/${session.id}/attendance/`);
      setAttendance(res.data);
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر تحميل قائمة الطلاب");
      setAttendanceSessionId(null);
    } finally {
      setAttendanceBusy(false);
    }
  }

  function setStudentStatus(studentId, status) {
    setAttendance((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        records: prev.records.map((r) =>
          r.student_id === studentId ? { ...r, status } : r
        ),
      };
    });
  }

  function markAll(status) {
    setAttendance((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        records: prev.records.map((r) => ({ ...r, status })),
      };
    });
  }

  async function saveAttendance() {
    if (!attendanceSessionId || !attendance) return;
    setAttendanceBusy(true);
    setMsg("");
    try {
      const res = await client.put(`/sessions/${attendanceSessionId}/attendance/`, {
        records: attendance.records.map((r) => ({
          student_id: r.student_id,
          status: r.status || null,
          note: r.note || "",
        })),
      });
      setAttendance(res.data);
      setMsg("تم حفظ الحضور والغياب");
      loadSessions();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر حفظ الحضور");
    } finally {
      setAttendanceBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 28 }}>جدول الحصص</h1>
        <Link to="/teacher" className="btn btn-ghost">رجوع للوحة المدرس</Link>
      </div>

      <div className="banner" style={{ marginBottom: 16 }}>
        أضف <strong>رابط Zoom</strong>، وبعد الحصة افتح المجموعة لتسجيل{" "}
        <strong>الحضور والغياب</strong>. يمكنك مراجعة الحصص السابقة في أي وقت.
      </div>

      <div className="filter-row" style={{ marginBottom: 16 }}>
        {[
          ["all", "كل الحصص"],
          ["upcoming", "القادمة"],
          ["past", "السابقة"],
        ].map(([v, t]) => (
          <span
            key={v}
            className={`chip ${view === v ? "active" : ""}`}
            onClick={() => {
              setView(v);
              setAttendanceSessionId(null);
              setAttendance(null);
            }}
          >
            {t}
          </span>
        ))}
      </div>

      {msg && <div className="banner" style={{ marginBottom: 12 }}>{msg}</div>}

      {sessions.length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>لا توجد حصص مجدولة لك بعد. انتظر وضع الجدول من المدير.</p>
      )}

      {sessions.map((s) => {
        const draft = drafts[s.id] || { zoom_link: "", status: s.status };
        const when = formatSessionWhen(s.start_time);
        const subjectKey = resolveSubjectKey(s.subject_name) || "math";
        const summary = s.attendance_summary;
        const open = attendanceSessionId === s.id;
        return (
          <div
            key={s.id}
            className="card session-card session-skin"
            data-subject={subjectKey}
            style={{ padding: 16, marginBottom: 12 }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
              <div className="session-number" aria-label={`الحصة رقم ${s.session_number}`}>
                {s.session_number ?? "—"}
              </div>
              <div style={{ minWidth: 140 }}>
                <div className="session-date">
                  <div className="session-card__time session-date__time">{when.time}</div>
                  {when.hijri ? (
                    <div className="session-date__hijri">{when.hijri}</div>
                  ) : null}
                  <div className="session-date__gregorian">{when.gregorian}</div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <strong className="session-card__title">{sessionDisplayTitle(s)}</strong>
                {effectiveSessionStatus(s) === "live" && (
                  <span className="badge badge-live" style={{ marginInlineStart: 8 }}>مباشر</span>
                )}
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {s.subject_name}
                  {s.session_number != null ? ` · الحصة ${s.session_number}` : ""}
                  {" · "}{s.group_name || "مجموعة"} · {s.duration_minutes} دقيقة
                </div>
                {summary?.recorded && (
                  <div style={{ fontSize: 13, marginTop: 4, fontWeight: 600 }}>
                    حضور: {summary.present} · غياب: {summary.absent}
                  </div>
                )}
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 12, marginBottom: 8 }}>
              <label>رابط Zoom Meeting</label>
              <input
                className="form-control"
                value={draft.zoom_link}
                placeholder="https://zoom.us/j/..."
                onChange={(e) => setDraft(s.id, "zoom_link", e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>الحالة</label>
              <div className="filter-row">
                {[["scheduled", "مجدولة"], ["live", "مباشر الآن"], ["done", "منتهية"]].map(([v, t]) => (
                  <span
                    key={v}
                    className={`chip ${draft.status === v ? "active" : ""}`}
                    onClick={() => setDraft(s.id, "status", v)}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="btn btn-primary btn-sm"
                disabled={busyId === s.id}
                onClick={() => saveZoom(s)}
              >
                {busyId === s.id ? "…" : "حفظ الرابط"}
              </button>
              {draft.zoom_link && (
                <a className="btn btn-secondary btn-sm" href={draft.zoom_link} target="_blank" rel="noreferrer">
                  فتح Zoom ↗
                </a>
              )}
              {s.group ? (
                <button
                  type="button"
                  className={`btn btn-sm ${open ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => {
                    if (open) {
                      setAttendanceSessionId(null);
                      setAttendance(null);
                    } else {
                      openAttendance(s);
                    }
                  }}
                >
                  {open
                    ? "إغلاق الحضور"
                    : summary?.recorded
                      ? "عرض / تعديل الحضور"
                      : "تسجيل حضور المجموعة"}
                </button>
              ) : null}
            </div>

            {open && (
              <div className="attendance-panel" style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
                  <strong>
                    حضور مجموعة {attendance?.group_name || s.group_name || ""}
                  </strong>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => markAll("present")} disabled={attendanceBusy}>
                      الكل حاضر
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => markAll("absent")} disabled={attendanceBusy}>
                      الكل غائب
                    </button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={saveAttendance} disabled={attendanceBusy || !attendance}>
                      {attendanceBusy ? "…" : "حفظ الحضور"}
                    </button>
                  </div>
                </div>

                {attendanceBusy && !attendance && (
                  <p style={{ color: "var(--text-muted)" }}>جاري تحميل الطلاب…</p>
                )}

                {attendance?.records?.length === 0 && (
                  <p style={{ color: "var(--text-muted)" }}>لا يوجد طلاب في هذه المجموعة.</p>
                )}

                {attendance?.records?.map((r) => (
                  <div
                    key={r.student_id}
                    className="attendance-row"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "10px 0",
                      borderBottom: "1px solid color-mix(in srgb, var(--border) 70%, transparent)",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{r.full_name}</span>
                    <div className="filter-row" style={{ margin: 0 }}>
                      <span
                        className={`chip ${r.status === "present" ? "active attendance-present" : ""}`}
                        onClick={() => setStudentStatus(r.student_id, "present")}
                      >
                        حاضر
                      </span>
                      <span
                        className={`chip ${r.status === "absent" ? "active attendance-absent" : ""}`}
                        onClick={() => setStudentStatus(r.student_id, "absent")}
                      >
                        غائب
                      </span>
                    </div>
                  </div>
                ))}

                {attendance?.summary && (
                  <div style={{ marginTop: 12, fontSize: 13, color: "var(--text-muted)" }}>
                    حاضر {attendance.summary.present} · غائب {attendance.summary.absent}
                    {attendance.summary.unmarked ? ` · بلا تسجيل ${attendance.summary.unmarked}` : ""}
                    {" · "}المجموع {attendance.summary.total}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
