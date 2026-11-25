import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import client from "../api/client";
import { resolveSubjectKey, subjectClass } from "../theme/subjects";
import "../styles/teacher-rate.css";

function Stars({ value, disabled, onChange }) {
  return (
    <div className={`stars${disabled ? " dis" : ""}`} role="group">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n === value ? 0 : n)}
          style={{ background: "none", border: 0, padding: 0, cursor: disabled ? "default" : "pointer", font: "inherit", color: "inherit" }}
          aria-label={`${n} نجوم`}
        >
          <span className={n <= value ? "" : "o"}>★</span>
        </button>
      ))}
    </div>
  );
}

export default function RateClass() {
  const { sessionId } = useParams();
  const [data, setData] = useState(null);
  const [rows, setRows] = useState([]);
  const [generalNote, setGeneralNote] = useState("");
  const [filter, setFilter] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [delivery, setDelivery] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setErr("");
    client
      .get(`/sessions/${sessionId}/rate/`)
      .then((res) => {
        setData(res.data);
        setRows(
          (res.data.students || []).map((s) => ({
            ...s,
            tags: [...(s.tags || [])],
          })),
        );
        setGeneralNote(res.data.rating?.general_note || "");
      })
      .catch((e) => setErr(e.response?.data?.detail || "تعذّر التحميل"))
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const skin = subjectClass(resolveSubjectKey(data?.session));

  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let sum = 0;
    let n = 0;
    for (const r of rows) {
      if (r.attendance_status === "present") {
        present += 1;
        if (r.stars) {
          sum += r.stars;
          n += 1;
        }
      } else absent += 1;
    }
    return {
      present,
      absent,
      avg: n ? Math.round((sum / n) * 10) / 10 : 0,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    if (filter === "present") return rows.filter((r) => r.attendance_status === "present");
    if (filter === "absent") return rows.filter((r) => r.attendance_status === "absent");
    if (filter === "unrated") {
      return rows.filter(
        (r) => r.attendance_status === "present" && !r.stars,
      );
    }
    return rows;
  }, [rows, filter]);

  const visible = showAll ? filtered : filtered.slice(0, 5);
  const hidden = Math.max(0, filtered.length - 5);

  function patchRow(studentId, patch) {
    setRows((prev) =>
      prev.map((r) => (r.student_id === studentId ? { ...r, ...patch } : r)),
    );
  }

  function toggleTag(studentId, tag) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.student_id !== studentId) return r;
        const has = (r.tags || []).includes(tag);
        return {
          ...r,
          tags: has ? r.tags.filter((t) => t !== tag) : [...(r.tags || []), tag],
        };
      }),
    );
  }

  function body() {
    return {
      general_note: generalNote,
      students: rows.map((r) => ({
        student_id: r.student_id,
        attendance_status: r.attendance_status,
        stars: r.attendance_status === "absent" ? 0 : r.stars || 0,
        tags: r.attendance_status === "absent" ? [] : r.tags || [],
        note: r.note || "",
      })),
    };
  }

  async function saveDraft() {
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      const res = await client.put(`/sessions/${sessionId}/rate/`, body());
      setData(res.data);
      setMsg("تم حفظ المسودة");
      setDelivery(null);
    } catch (e) {
      setErr(e.response?.data?.detail || "تعذّر حفظ المسودة");
    } finally {
      setBusy(false);
    }
  }

  async function saveFinal(resend = false) {
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      const res = await client.post(`/sessions/${sessionId}/rate/`, {
        ...body(),
        resend_reports: resend,
      });
      setData(res.data);
      setDelivery(res.data.delivery || null);
      setMsg("تم حفظ التقييم");
    } catch (e) {
      setErr(e.response?.data?.detail || "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    try {
      const res = await client.post(`/sessions/${sessionId}/rate/`, {
        resend_only: true,
      });
      setDelivery(res.data.delivery || null);
      setMsg("أُعيد إرسال التقارير");
    } catch (e) {
      setErr(e.response?.data?.detail || "تعذّر إعادة الإرسال");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) {
    return <div className="spinner">جاري التحميل…</div>;
  }

  const tags = data?.tag_options || [];

  return (
    <div className={`trate ${skin}`}>
      <div className="crumb">
        <Link to="/teacher/schedule">حصصي</Link> › <b>تقييم الحصة</b>
      </div>
      {err && <div className="note" style={{ borderColor: "#f6c9c9", background: "#fff7f7", color: "#b91c1c" }}>{err}</div>}
      {msg && !delivery && <div className="note" style={{ borderColor: "#9fe0b6", background: "#e8f7ee" }}>{msg}</div>}

      <div className="rh">
        <div>
          <div className="meta">{data?.session?.meta}</div>
          <h1>تقييم حصة: {data?.session?.title}</h1>
        </div>
        <div className="stats">
          <div className="hstat">
            <b>{stats.present}</b>
            <small>حاضر</small>
          </div>
          <div className="hstat">
            <b style={{ color: "#ffd0d0" }}>{stats.absent}</b>
            <small>غائب</small>
          </div>
          <div className="hstat">
            <b>{stats.avg || "—"}</b>
            <small>متوسط التقييم</small>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>الطلاب ({rows.length})</h2>
          <div className="chips">
            {[
              ["all", "الكل"],
              ["present", "الحاضرين"],
              ["absent", "الغائبين"],
              ["unrated", "لم يُقيَّموا"],
            ].map(([k, t]) => (
              <button
                key={k}
                type="button"
                className={`chip${filter === k ? " on" : ""}`}
                onClick={() => setFilter(k)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="note">
          💡 يُسجَّل الحضور تلقائياً عند دخول الطالب للحصة. إذا دخل الطالب وقتاً قصيراً ثم خرج، يمكنك تغييره إلى{" "}
          <b style={{ color: "var(--red)" }}>غائب</b>.
        </div>
        <div className="thd">
          <span>الطالب</span>
          <span>الحضور</span>
          <span>التقييم</span>
          <span>ملحوظة</span>
        </div>

        {visible.map((r) => {
          const abs = r.attendance_status === "absent";
          return (
            <div key={r.student_id} className={`st${abs ? " abs" : ""}`}>
              <div className="who">
                <span className="avatar">{r.initial}</span>
                <div>
                  <b>
                    {r.full_name}{" "}
                    {!r.has_parent && <span className="nop">ولي الأمر غير مربوط</span>}
                  </b>
                  <small>{r.join_line}</small>
                  {r.short_warn && (
                    <>
                      <br />
                      <span className="warn">⚠ حضر {r.duration_min} دقائق فقط</span>
                    </>
                  )}
                </div>
              </div>
              <div className="tog">
                <button
                  type="button"
                  className={`p${r.attendance_status === "present" ? " on" : ""}`}
                  onClick={() =>
                    patchRow(r.student_id, { attendance_status: "present" })
                  }
                >
                  حاضر
                </button>
                <button
                  type="button"
                  className={`a${abs ? " on" : ""}`}
                  onClick={() =>
                    patchRow(r.student_id, {
                      attendance_status: "absent",
                      stars: 0,
                      tags: [],
                    })
                  }
                >
                  غائب
                </button>
              </div>
              <div>
                <Stars
                  value={abs ? 0 : r.stars || 0}
                  disabled={abs}
                  onChange={(n) => patchRow(r.student_id, { stars: n })}
                />
                {!abs && (
                  <div className="tags">
                    {tags.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={(r.tags || []).includes(t) ? "on" : ""}
                        onClick={() => toggleTag(r.student_id, t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <textarea
                className="inp"
                placeholder="✎ اكتب ملحوظة…"
                value={r.note || ""}
                onChange={(e) => patchRow(r.student_id, { note: e.target.value })}
              />
            </div>
          );
        })}
        {!showAll && hidden > 0 && (
          <button type="button" className="more" onClick={() => setShowAll(true)}>
            عرض {hidden} طلاب آخرين ⌄
          </button>
        )}
      </div>

      <div className="card">
        <div className="card-h">
          <h2>ملحوظة عامة على الحصة</h2>
          <span className="mut">اختياري</span>
        </div>
        <textarea
          className="inp"
          style={{ minHeight: 90 }}
          value={generalNote}
          onChange={(e) => setGeneralNote(e.target.value)}
        />
      </div>

      <div className="card foot">
        <span className="mut">
          يظهر التقييم والملحوظات في تقرير الطالب لولي الأمر (رسالة تليجرام)
        </span>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="btn ghost" disabled={busy} onClick={saveDraft}>
            حفظ كمسودة
          </button>
          <button type="button" className="btn brand" disabled={busy} onClick={() => saveFinal(false)}>
            حفظ التقييم ✓
          </button>
        </div>
      </div>

      {delivery && (
        <div className="okbar">
          <span style={{ fontSize: 26 }}>✅</span>
          <div>
            <b>تم حفظ التقييم</b>
            <div className="mut">
              اتبعت تقرير لـ {delivery.sent || 0} أولياء أمور على تليجرام
              {delivery.no_parent ? ` · ${delivery.no_parent} طالب ولي أمره مش مربوط` : ""}
              {delivery.failed ? ` · فشل ${delivery.failed}` : ""}
            </div>
          </div>
          <button type="button" className="btn ghost" style={{ marginRight: "auto" }} disabled={busy} onClick={resend}>
            إعادة إرسال للأولياء
          </button>
        </div>
      )}
    </div>
  );
}
