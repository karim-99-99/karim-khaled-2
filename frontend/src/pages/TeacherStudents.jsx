import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { resolveSubjectKey, subjectClass } from "../theme/subjects";
import { toArabicDigits } from "../utils/sessionDate";

function pillClass(key) {
  if (key === "ok") return { background: "#e8f7ee", color: "#16a34a" };
  if (key === "late1") return { background: "#fff4e0", color: "#c26a00" };
  return { background: "#fdecec", color: "#dc2626" };
}

export default function TeacherStudents() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [remindMsg, setRemindMsg] = useState("");

  useEffect(() => {
    client
      .get("/teacher/home/")
      .then((res) => setData(res.data))
      .catch((e) => setError(e.response?.data?.detail || "تعذّر التحميل"))
      .finally(() => setLoading(false));
  }, []);

  const skin = subjectClass(resolveSubjectKey(data?.subject));
  const groups = data?.groups || [];
  const students = data?.students || [];

  const shown = useMemo(() => {
    if (filter === "all") return students;
    if (filter === "late") return students.filter((s) => s.status?.is_late);
    return students.filter((s) => String(s.group_id) === String(filter));
  }, [students, filter]);

  async function remind(studentId) {
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
      if (e.response?.status === 429 || e.response?.data?.reason === "cooldown") {
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
      setRemindMsg(e.response?.data?.detail || e.response?.data?.reason || "تعذّر التذكير");
    }
  }

  if (loading) return <div className="spinner">جاري التحميل…</div>;

  return (
    <div className={skin} style={{ maxWidth: 1200 }}>
      <h1 style={{ fontSize: 32, margin: "0 0 6px", color: "var(--brand-dark, #0d3b70)" }}>
        الطلاب
      </h1>
      <p style={{ color: "var(--mut, #6b7a90)", marginBottom: 16 }}>
        {data?.subject?.role_label || "مدرس"} · {data?.kpis?.students || 0} طالب في{" "}
        {data?.kpis?.groups || 0} مجموعات
      </p>
      {error && <div className="banner" style={{ marginBottom: 12 }}>{error}</div>}
      {remindMsg && <div className="banner" style={{ marginBottom: 12 }}>{remindMsg}</div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button
          type="button"
          className={`chip${filter === "all" ? " active" : ""}`}
          onClick={() => setFilter("all")}
        >
          الكل
        </button>
        <button
          type="button"
          className={`chip${filter === "late" ? " active" : ""}`}
          onClick={() => setFilter("late")}
        >
          المتأخرين
        </button>
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`chip${String(filter) === String(g.id) ? " active" : ""}`}
            onClick={() => setFilter(g.id)}
          >
            {g.name}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-scroll">
          <table className="table">
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
              {shown.map((s) => (
                <tr key={`${s.id}-${s.group_id}`}>
                  <td>
                    <strong>{s.full_name}</strong>
                    <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{s.group_name}</div>
                  </td>
                  <td>
                    {toArabicDigits(`${s.homework_done}/${s.homework_total}`)}
                  </td>
                  <td>
                    {toArabicDigits(`${s.collection_done}/${s.collection_total}`)}
                  </td>
                  <td>{s.last_activity}</td>
                  <td>
                    <span
                      style={{
                        ...pillClass(s.status?.key),
                        padding: "4px 11px",
                        borderRadius: 99,
                        fontWeight: 700,
                        fontSize: 12.5,
                      }}
                    >
                      {s.status?.label}
                    </span>
                  </td>
                  <td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link
                      className="btn btn-ghost btn-sm"
                      to={`/teacher/students/${s.id}/reports`}
                    >
                      التقارير
                    </Link>
                    {s.status?.is_late &&
                      (s.reminded_recently ? (
                        <span
                          style={{
                            background: "#e8f7ee",
                            color: "#16a34a",
                            padding: "4px 11px",
                            borderRadius: 99,
                            fontWeight: 700,
                            fontSize: 12.5,
                          }}
                        >
                          اتبعت ✓
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ background: "#e8f7ee", color: "#16a34a" }}
                          onClick={() => remind(s.id)}
                        >
                          تذكير
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {shown.length === 0 && (
          <p style={{ padding: 20, color: "var(--text-muted)" }}>
            {filter === "late" ? "مفيش متأخرين 👏" : "لا طلاب في هذا الفلتر."}
          </p>
        )}
      </div>
    </div>
  );
}
