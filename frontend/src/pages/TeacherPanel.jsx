import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";

export default function TeacherPanel() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeGroup, setActiveGroup] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    client
      .get("/teacher/groups/")
      .then((res) => setGroups(res.data.results || res.data || []))
      .catch((e) => {
        setError(e.response?.data?.detail || "تعذّر تحميل المجموعات");
        setGroups([]);
      })
      .finally(() => setLoading(false));
  }, []);

  function openGroup(g) {
    setActiveGroup(g);
    setAnalytics(null);
    setStudentsLoading(true);
    client
      .get(`/teacher/groups/${g.id}/students/`)
      .then((res) => setStudents(res.data || []))
      .catch(() => setStudents([]))
      .finally(() => setStudentsLoading(false));
  }

  function openStudent(sid) {
    client.get(`/teacher/students/${sid}/analytics/`).then((res) => setAnalytics(res.data));
  }

  const shown = students.filter(
    (s) => filter === "all" || s.subscription_status === filter,
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ fontSize: 28, margin: 0 }}>لوحة المدرس</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link to="/courses" className="btn btn-primary">
            إدارة الدروس والأسئلة
          </Link>
          <Link to="/teacher/schedule" className="btn btn-secondary">
            جدول الحصص
          </Link>
          <Link to="/teacher/questions" className="btn btn-ghost">
            محرر الأسئلة القديم
          </Link>
        </div>
      </div>

      <div className="banner" style={{ marginBottom: 20 }}>
        من <strong>دورات</strong>: تأسيس = واجب لمجموعاتك فقط · تجميع = دروس وأسئلة لكل الطلاب ·
        اختبارات.
      </div>

      <div className="section-title">مجموعاتي</div>
      {loading && <div className="spinner">جاري تحميل المجموعات…</div>}
      {error && <div className="banner" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="filter-row">
        {groups.map((g) => (
          <span
            key={g.id}
            className={`chip ${activeGroup?.id === g.id ? "active" : ""}`}
            onClick={() => openGroup(g)}
            role="button"
            tabIndex={0}
          >
            {g.name} ({g.student_count})
          </span>
        ))}
        {!loading && groups.length === 0 && !error && (
          <p style={{ color: "var(--text-muted)" }}>لم تُضف إلى أي مجموعة بعد.</p>
        )}
      </div>

      {activeGroup && (
        <div className="card" style={{ padding: 20, marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <strong>طلاب {activeGroup.name}</strong>
            <div className="filter-row" style={{ margin: 0 }}>
              {[
                ["all", "الكل"],
                ["active", "نشط"],
                ["expired", "منتهي"],
              ].map(([v, t]) => (
                <span
                  key={v}
                  className={`chip ${filter === v ? "active" : ""}`}
                  onClick={() => setFilter(v)}
                  role="button"
                  tabIndex={0}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
          {studentsLoading ? (
            <div className="spinner">جاري التحميل…</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>التليفون</th>
                  <th>الحالة</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => (
                  <tr key={s.id}>
                    <td>{s.full_name}</td>
                    <td>{s.phone}</td>
                    <td>
                      <span
                        className={`badge ${
                          s.subscription_status === "active" ? "badge-active" : "badge-expired"
                        }`}
                      >
                        {s.subscription_status === "active" ? "نشط" : "منتهي"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => openStudent(s.student_id)}
                      >
                        عرض الدرجات
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {analytics && (
        <div className="card" style={{ padding: 20, marginTop: 16 }}>
          <h3 style={{ marginBottom: 8 }}>{analytics.student.full_name}</h3>
          <p style={{ color: "var(--text-muted)", marginBottom: 12 }}>
            اختبارات: {analytics.totals.exams} · صحيح: {analytics.totals.correct} · خطأ:{" "}
            {analytics.totals.wrong} · فيديوهات: {analytics.totals.videos_watched}
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>الاختبار</th>
                <th>الدرجة</th>
                <th>صحيح/خطأ</th>
              </tr>
            </thead>
            <tbody>
              {analytics.exams.map((e) => (
                <tr key={e.id}>
                  <td>{e.title}</td>
                  <td>{e.score_percent}%</td>
                  <td>
                    {e.correct} / {e.wrong}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
