import { useEffect, useState } from "react";
import client from "../api/client";

export default function AdminPanel() {
  const [tab, setTab] = useState("accounts");
  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>لوحة المدير</h1>
      <div className="filter-row">
        {[["accounts", "كل الحسابات"], ["groups", "المجموعات"], ["subs", "الاشتراكات"], ["payments", "المدفوعات"]].map(([v, t]) => (
          <span key={v} className={`chip ${tab === v ? "active" : ""}`} onClick={() => setTab(v)}>{t}</span>
        ))}
      </div>
      {tab === "accounts" && <AccountsTab />}
      {tab === "groups" && <GroupsTab />}
      {tab === "subs" && <SubsTab />}
      {tab === "payments" && <PaymentsTab />}
    </div>
  );
}

function AccountsTab() {
  const [data, setData] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [view, setView] = useState("pending");
  const [q, setQ] = useState("");

  function load() {
    client.get("/admin/accounts/").then((res) => setData(res.data));
  }
  useEffect(() => {
    load();
    client.get("/subjects/").then((res) => setSubjects(res.data.results || res.data));
  }, []);

  async function toggleActive(userId, current) {
    await client.patch(`/admin/users/${userId}/set-active/`, { is_active: !current });
    load();
  }

  async function grantSubscription(userId) {
    const days = window.prompt("عدد أيام الاشتراك التي تريد تفعيلها للطالب:", "30");
    if (!days) return;
    await client.post(`/admin/users/${userId}/grant-subscription/`, { days: Number(days) });
    load();
  }

  if (!data) return <div className="spinner">جاري التحميل…</div>;

  const term = q.trim();
  const filterFn = (p) =>
    !term || p.full_name.includes(term) || (p.phone || "").includes(term);
  const students = data.students.filter(filterFn);
  const teachers = data.teachers.filter(filterFn);
  // "Pending activation": student accounts that have not been activated yet
  // (no active subscription). Admin either grants a subscription or converts
  // them to a teacher.
  const isPending = (p) =>
    p.role === "student" && p.subscription?.subscription_status !== "active";
  const pending = data.students.filter(isPending).filter(filterFn);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div className="filter-row" style={{ margin: 0 }}>
          <span className={`chip ${view === "pending" ? "active" : ""}`} onClick={() => setView("pending")}>
            قيد التفعيل ({data.students.filter(isPending).length})
          </span>
          <span className={`chip ${view === "students" ? "active" : ""}`} onClick={() => setView("students")}>
            الطلبة ({data.totals.students})
          </span>
          <span className={`chip ${view === "teachers" ? "active" : ""}`} onClick={() => setView("teachers")}>
            المدرسون ({data.totals.teachers})
          </span>
        </div>
        <input className="form-control" style={{ maxWidth: 260 }} placeholder="بحث بالاسم أو التليفون"
          value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {view === "pending" && (
        <div className="card" style={{ padding: 12, overflowX: "auto" }}>
          {pending.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
              لا توجد حسابات في انتظار التفعيل.
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>التليفون</th>
                  <th>الدور</th>
                  <th>المادة (للمدرس)</th>
                  <th>مدة اشتراك الطالب</th>
                  <th>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <PendingRow key={p.id} account={p} subjects={subjects} onDone={load} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {view === "students" && (
        <div className="card" style={{ padding: 12, overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>التليفون</th>
                <th>الاشتراك</th>
                <th>مدة الاشتراك</th>
                <th>ينتهي في</th>
                <th>المجموعات</th>
                <th>الحساب</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.full_name} <span style={{ color: "var(--text-muted)", fontSize: 11 }}>#{s.id}</span></td>
                  <td>{s.phone}</td>
                  <td>
                    <span className={`badge ${s.subscription.subscription_status === "active" ? "badge-active" : "badge-expired"}`}>
                      {s.subscription.subscription_status === "active" ? "مشترك" : "غير مشترك"}
                    </span>
                  </td>
                  <td>
                    {s.subscription.subscription_status === "active"
                      ? `${s.subscription.subscription_plan_label} (${s.subscription.subscription_days_remaining} يوم)`
                      : "—"}
                  </td>
                  <td>{s.subscription.subscription_end || "—"}</td>
                  <td>
                    {s.groups.length ? s.groups.join("، ") : <span style={{ color: "var(--text-muted)" }}>بدون مجموعة</span>}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className={`btn btn-sm ${s.is_active ? "btn-ghost" : "btn-primary"}`}
                      onClick={() => toggleActive(s.id, s.is_active)}>
                      {s.is_active ? "مُفعّل (إيقاف)" : "موقوف (تفعيل)"}
                    </button>{" "}
                    <button className="btn btn-sm btn-secondary" onClick={() => grantSubscription(s.id)}>
                      منح اشتراك
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === "teachers" && (
        <div className="card" style={{ padding: 12, overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>التليفون</th>
                <th>المادة</th>
                <th>عدد المجموعات</th>
                <th>المجموعات</th>
                <th>الحساب</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.id}>
                  <td>{t.full_name} <span style={{ color: "var(--text-muted)", fontSize: 11 }}>#{t.id}</span></td>
                  <td>{t.phone}</td>
                  <td>
                    {t.subject_name
                      ? <span className="badge" style={{ background: "#ede9fe", color: "#7c3aed" }}>{t.subject_name}</span>
                      : <span style={{ color: "var(--text-muted)" }}>غير محددة</span>}
                  </td>
                  <td><strong>{t.groups_count}</strong></td>
                  <td>
                    {t.groups.length ? t.groups.join("، ") : <span style={{ color: "var(--text-muted)" }}>بدون مجموعة</span>}
                  </td>
                  <td>
                    <button className={`btn btn-sm ${t.is_active ? "btn-ghost" : "btn-primary"}`}
                      onClick={() => toggleActive(t.id, t.is_active)}>
                      {t.is_active ? "مُفعّل (إيقاف)" : "موقوف (تفعيل)"}
                    </button>
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

function PendingRow({ account, subjects, onDone }) {
  const [role, setRole] = useState(account.role || "student");
  const [subjectId, setSubjectId] = useState(account.subject_id || "");
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function activate() {
    setErr("");
    if (role === "teacher" && !subjectId) {
      setErr("اختر المادة");
      return;
    }
    setBusy(true);
    try {
      // 1) Set the role (+ subject for teachers).
      await client.patch(`/admin/users/${account.id}/set-role/`, {
        role,
        taught_subject: role === "teacher" ? Number(subjectId) : null,
      });
      // 2) Activate. For a student with a duration, grant a subscription too.
      if (role === "student" && Number(days) > 0) {
        await client.post(`/admin/users/${account.id}/grant-subscription/`, {
          days: Number(days),
        });
      } else {
        await client.patch(`/admin/users/${account.id}/set-active/`, { is_active: true });
      }
      onDone();
    } catch (e) {
      setErr(e.response?.data?.detail || "تعذّر التفعيل");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td>
        {account.full_name} <span style={{ color: "var(--text-muted)", fontSize: 11 }}>#{account.id}</span>
      </td>
      <td>{account.phone}</td>
      <td>
        <select className="form-control" style={{ minWidth: 110 }} value={role}
          onChange={(e) => setRole(e.target.value)}>
          <option value="student">طالب</option>
          <option value="teacher">مدرس</option>
        </select>
      </td>
      <td>
        {role === "teacher" ? (
          <select className="form-control" style={{ minWidth: 130 }} value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">اختر المادة</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>—</span>
        )}
      </td>
      <td>
        {role === "student" ? (
          <input className="form-control" style={{ width: 90 }} type="number" min="0"
            value={days} onChange={(e) => setDays(e.target.value)} placeholder="أيام" />
        ) : (
          <span style={{ color: "var(--text-muted)" }}>—</span>
        )}
      </td>
      <td style={{ whiteSpace: "nowrap" }}>
        <button className="btn btn-sm btn-primary" disabled={busy} onClick={activate}>
          {busy ? "…" : "تفعيل الحساب"}
        </button>
        {err && <div className="error-text" style={{ fontSize: 11 }}>{err}</div>}
      </td>
    </tr>
  );
}

function GroupsTab() {
  const [groups, setGroups] = useState([]);
  const [name, setName] = useState("");
  const [open, setOpen] = useState(null);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [studentId, setStudentId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [msg, setMsg] = useState("");

  function load() {
    client.get("/admin/groups/").then((res) => setGroups(res.data.results || res.data));
  }
  function loadPickers() {
    client.get("/admin/available-students/").then((res) => setAvailableStudents(res.data));
    client.get("/admin/teachers/").then((res) => setTeachers(res.data));
  }
  useEffect(() => {
    load();
    loadPickers();
    client.get("/subjects/").then((res) => setSubjects(res.data.results || res.data));
  }, []);

  async function create() {
    if (!name) return;
    await client.post("/admin/groups/", { name });
    setName("");
    load();
  }

  function openGroup(g) {
    setOpen(g);
    setMsg("");
    setStudentId("");
    setTeacherId("");
    setSubjectId("");
    client.get(`/admin/groups/${g.id}/students/`).then((res) => setStudents(res.data));
  }

  async function addStudent() {
    if (!studentId) return;
    setMsg("");
    try {
      await client.post(`/admin/groups/${open.id}/students/`, { student_id: Number(studentId) });
      setStudentId("");
      openGroup(open);
      load();
      loadPickers();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر إضافة الطالب");
    }
  }

  async function addTeacher() {
    if (!teacherId || !subjectId) {
      setMsg("اختر المدرس والمادة");
      return;
    }
    setMsg("");
    try {
      await client.post(`/admin/groups/${open.id}/teachers/`, {
        teacher_id: Number(teacherId),
        subject: Number(subjectId),
      });
      setTeacherId("");
      setSubjectId("");
      load();
      setMsg("تمت إضافة المدرس");
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر إضافة المدرس");
    }
  }

  async function toggleActive(userId, current) {
    await client.patch(`/admin/users/${userId}/set-active/`, { is_active: !current });
    openGroup(open);
    loadPickers();
  }

  // Combined member rows: teachers first, then students.
  const memberRows = open
    ? [
        ...(groups.find((g) => g.id === open.id)?.teachers || []).map((t) => ({
          key: `t${t.id}`,
          userId: t.teacher_id,
          full_name: t.full_name,
          phone: t.phone,
          role: "teacher",
          subject_name: t.subject_name,
          account_active: t.account_active,
          subscription: null,
        })),
        ...students.map((s) => ({
          key: `s${s.id}`,
          userId: s.student_id,
          full_name: s.full_name,
          phone: s.phone,
          role: "student",
          subject_name: null,
          account_active: s.account_active,
          subscription: s.subscription,
        })),
      ]
    : [];

  return (
    <div>
      <div className="card" style={{ padding: 16, marginBottom: 16, display: "flex", gap: 8 }}>
        <input className="form-control" placeholder="اسم مجموعة جديدة" value={name}
          onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary" onClick={create}>إنشاء</button>
      </div>

      {groups.map((g) => (
        <div key={g.id} className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>{g.name}</strong>{" "}
              <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                ({g.student_count} طالب · {g.active_count} نشط · {g.expired_count} منتهي)
              </span>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                مدرسون: {g.teachers?.map((t) => `${t.full_name} (${t.subject_name})`).join("، ") || "لا يوجد"}
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => openGroup(g)}>إدارة</button>
          </div>

          {open?.id === g.id && (
            <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              {/* Add student — dropdown of students not in any group */}
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <select className="form-control" style={{ flex: 1, minWidth: 220 }}
                  value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                  <option value="">
                    اختر طالباً غير مضاف لأي مجموعة ({availableStudents.length})
                  </option>
                  {availableStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} — {s.phone}
                      {s.subscription.subscription_status === "active" ? " (مشترك)" : " (غير مشترك)"}
                    </option>
                  ))}
                </select>
                <button className="btn btn-secondary" onClick={addStudent}>إضافة طالب</button>
              </div>

              {/* Add teacher — dropdown of teachers + subject */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <select className="form-control" style={{ flex: 1, minWidth: 180 }}
                  value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                  <option value="">اختر مدرساً ({teachers.length})</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.full_name} — {t.phone}</option>
                  ))}
                </select>
                <select className="form-control" style={{ minWidth: 140 }}
                  value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                  <option value="">المادة</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button className="btn btn-secondary" onClick={addTeacher}>إضافة مدرس</button>
              </div>

              {msg && <div className="banner">{msg}</div>}

              <table className="table">
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th>النوع</th>
                    <th>الاشتراك</th>
                    <th>مدة الاشتراك</th>
                    <th>ينتهي في</th>
                    <th>الحساب</th>
                  </tr>
                </thead>
                <tbody>
                  {memberRows.map((m) => (
                    <tr key={m.key}>
                      <td>
                        {m.full_name}
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.phone}</div>
                      </td>
                      <td>
                        {m.role === "teacher" ? (
                          <span className="badge" style={{ background: "#ede9fe", color: "#7c3aed" }}>
                            مدرس {m.subject_name ? `· ${m.subject_name}` : ""}
                          </span>
                        ) : (
                          <span className="badge" style={{ background: "#dbeafe", color: "#2563eb" }}>طالب</span>
                        )}
                      </td>
                      <td>
                        {m.role === "student" ? (
                          <span className={`badge ${m.subscription?.subscription_status === "active" ? "badge-active" : "badge-expired"}`}>
                            {m.subscription?.subscription_status === "active" ? "مشترك" : "غير مشترك"}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>
                      <td>
                        {m.role === "student" && m.subscription?.subscription_status === "active"
                          ? `${m.subscription.subscription_plan_label} (${m.subscription.subscription_days_remaining} يوم متبقي)`
                          : "—"}
                      </td>
                      <td>
                        {m.role === "student" && m.subscription?.subscription_end
                          ? m.subscription.subscription_end
                          : "—"}
                      </td>
                      <td>
                        <button
                          className={`btn btn-sm ${m.account_active ? "btn-ghost" : "btn-primary"}`}
                          onClick={() => toggleActive(m.userId, m.account_active)}
                        >
                          {m.account_active ? "مُفعّل ✓ (إيقاف)" : "موقوف (تفعيل)"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SubsTab() {
  const [subs, setSubs] = useState([]);
  useEffect(() => {
    client.get("/admin/subscriptions/").then((res) => setSubs(res.data.results || res.data));
  }, []);
  return (
    <table className="table">
      <thead><tr><th>الطالب</th><th>الباقة</th><th>ينتهي</th><th>الحالة</th></tr></thead>
      <tbody>
        {subs.map((s) => (
          <tr key={s.id}>
            <td>{s.student_name}</td>
            <td>{s.plan}</td>
            <td>{s.end_date}</td>
            <td>
              <span className={`badge ${s.is_active ? "badge-active" : "badge-expired"}`}>
                {s.is_active ? "نشط" : "منتهي"}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PaymentsTab() {
  const [payments, setPayments] = useState([]);
  useEffect(() => {
    client.get("/admin/payments/").then((res) => setPayments(res.data.results || res.data));
  }, []);
  return (
    <table className="table">
      <thead><tr><th>الطالب</th><th>الباقة</th><th>الوسيلة</th><th>الحالة</th></tr></thead>
      <tbody>
        {payments.map((p) => (
          <tr key={p.id}>
            <td>{p.student_name}</td>
            <td>{p.plan}</td>
            <td>{p.method}</td>
            <td>{p.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
