import { useCallback, useEffect, useState } from "react";
import client from "../api/client";
import { resolveSubjectKey } from "../theme/subjects";
import { joinLiveSession } from "../utils/joinLiveSession";
import {
  effectiveSessionStatus,
  formatSessionWhen,
  sessionDisplayTitle,
} from "../utils/sessionDate";

export default function Schedule() {
  const [sessions, setSessions] = useState([]);
  const [view, setView] = useState("upcoming"); // upcoming | past
  const [loading, setLoading] = useState(true);
  const [joinMsg, setJoinMsg] = useState("");
  const [joiningId, setJoiningId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    client
      .get("/sessions/", { params: { when: view } })
      .then((res) => setSessions(res.data.results || res.data || []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [view]);

  useEffect(() => {
    load();
  }, [load]);

  const isPast = view === "past";

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 32, margin: 0 }}>
          {isPast ? "الحصص السابقة" : "جدول الحصص"}
        </h1>
        <button
          type="button"
          className={`btn ${isPast ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setView(isPast ? "upcoming" : "past")}
        >
          {isPast ? "العودة للجدول" : "الحصص السابقة"}
        </button>
      </div>

      {joinMsg && <div className="banner" style={{ marginBottom: 12 }}>{joinMsg}</div>}

      {loading && <p style={{ color: "var(--text-muted)" }}>جاري التحميل…</p>}

      {!loading && sessions.length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>
          {isPast ? "لا توجد حصص سابقة." : "لا توجد حصص مجدولة قادمة."}
        </p>
      )}

      {!loading &&
        sessions.map((s) => {
          const when = formatSessionWhen(s.start_time);
          const subjectKey = resolveSubjectKey(s.subject_name) || "math";
          const status = effectiveSessionStatus(s);
          const lessonTitle = sessionDisplayTitle(s);
          return (
            <div
              key={s.id}
              className="card session-card session-skin"
              data-subject={subjectKey}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                padding: 20,
                marginBottom: 12,
              }}
            >
              <div className="session-number" aria-label={`الحصة رقم ${s.session_number}`}>
                {s.session_number ?? "—"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="session-date session-date--stack">
                  <div className="session-date__dayline">
                    <span className="session-date__weekday">{when.weekday}</span>
                    {when.time ? (
                      <span className="session-date__time">{when.time}</span>
                    ) : null}
                    {status === "live" && (
                      <span className="badge badge-live">مباشر الآن</span>
                    )}
                    {status === "done" && <span className="badge">منتهية</span>}
                  </div>
                  {when.hijri ? (
                    <div className="session-date__hijri">{when.hijri}</div>
                  ) : null}
                  <div className="session-date__gregorian">{when.gregorian}</div>
                  <div className="session-date__names">
                    <span className="session-date__subject">{s.subject_name}</span>
                    {lessonTitle && lessonTitle !== s.subject_name ? (
                      <>
                        <span className="session-date__sep">·</span>
                        <span className="session-card__title session-date__lesson">
                          {lessonTitle}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
                {s.teacher_joined_zoom ? (
                  <div style={{ marginTop: 8 }}>
                    <span className="badge badge-present">المدرس داخل الحصة ✓</span>
                  </div>
                ) : (
                  <div style={{ marginTop: 8 }}>
                    <span className="badge" style={{ opacity: 0.75 }}>
                      المدرس لم يدخل الحصة بعد
                    </span>
                  </div>
                )}
                {isPast && (
                  <div style={{ marginTop: 8 }}>
                    {s.my_attendance === "present" && (
                      <span className="badge badge-present">حاضر</span>
                    )}
                    {s.my_attendance === "absent" && (
                      <span className="badge badge-absent">غائب</span>
                    )}
                    {s.my_attendance == null && (
                      <span className="badge" style={{ opacity: 0.75 }}>
                        لم يُسجَّل الحضور بعد
                      </span>
                    )}
                  </div>
                )}
              </div>
              {!isPast && (s.join_mode === "bbb" || s.join_mode === "zoom" || s.zoom_link) ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={joiningId === s.id}
                  onClick={async () => {
                    setJoinMsg("");
                    setJoiningId(s.id);
                    try {
                      if (s.join_mode === "zoom" && s.zoom_link) {
                        window.open(s.zoom_link, "_blank", "noopener,noreferrer");
                      } else {
                        await joinLiveSession(s.id);
                      }
                    } catch (e) {
                      setJoinMsg(e.response?.data?.detail || "تعذّر فتح الحصة");
                    } finally {
                      setJoiningId(null);
                    }
                  }}
                >
                  {joiningId === s.id ? "…" : "ادخل الحصة"}
                </button>
              ) : !isPast ? (
                <button type="button" className="btn btn-secondary btn-sm" disabled>
                  بانتظار تفعيل اللايف
                </button>
              ) : null}
            </div>
          );
        })}
    </div>
  );
}
