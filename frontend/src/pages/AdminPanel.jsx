import { useEffect, useState } from "react";
import client, { warmApi } from "../api/client";
import { resolveSubjectKey } from "../theme/subjects";
import { formatSessionWhen, sessionDisplayTitle } from "../utils/sessionDate";

function contactLabel(account) {
  return account.email || "—";
}

export default function AdminPanel() {
  const [tab, setTab] = useState("accounts");
  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>لوحة المدير</h1>
      <div className="filter-row">
        {[
          ["accounts", "كل الحسابات"],
          ["groups", "المجموعات"],
          ["schedule", "جدول الحصص"],
          ["subs", "الاشتراكات"],
          ["payments", "المدفوعات"],
        ].map(([v, t]) => (
          <span key={v} className={`chip ${tab === v ? "active" : ""}`} onClick={() => setTab(v)}>{t}</span>
        ))}
      </div>
      {tab === "accounts" && <AccountsTab />}
      {tab === "groups" && <GroupsTab />}
      {tab === "schedule" && <ScheduleTab />}
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    setError("");
    warmApi();
    Promise.all([
      client.get("/admin/accounts/"),
      client.get("/subjects/"),
    ])
      .then(([accountsRes, subjectsRes]) => {
        setData(accountsRes.data);
        setSubjects(subjectsRes.data.results || subjectsRes.data || []);
      })
      .catch((e) => {
        setError(
          e.response?.data?.detail ||
            e.message ||
            "تعذّر تحميل الحسابات — تحقق من اتصال الخادم",
        );
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(userId, current) {
    await client.patch(`/admin/users/${userId}/set-active/`, { is_active: !current });
    load();
  }

  async function grantSubscription(userId) {
    const daysRaw = window.prompt(
      "مدة تفعيل الاشتراك بالأيام (مثال: 30 أو 90 أو 180 أو 365):",
      "30"
    );
    if (daysRaw === null) return;
    const days = Number(daysRaw);
    if (!Number.isFinite(days) || days <= 0) {
      window.alert("أدخل عدداً صحيحاً من الأيام أكبر من صفر");
      return;
    }
    try {
      await client.post(`/admin/users/${userId}/grant-subscription/`, { days });
      load();
    } catch (e) {
      window.alert(e.response?.data?.detail || "تعذّر منح الاشتراك");
    }
  }

  async function deleteAccount(user) {
    const label = user.full_name || user.email || `#${user.id}`;
    const ok = window.confirm(
      `هل تريد حذف حساب «${label}» نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`
    );
    if (!ok) return;
    try {
      await client.delete(`/admin/users/${user.id}/delete/`);
      load();
    } catch (e) {
      window.alert(e.response?.data?.detail || "تعذّر حذف الحساب");
    }
  }

  async function resetPassword(user) {
    const password = window.prompt(
      `عيّن كلمة مرور جديدة لـ ${user.full_name || user.email} (6 أحرف على الأقل):`,
      ""
    );
    if (password === null) return;
    if (password.trim().length < 6) {
      window.alert("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    try {
      await client.post(`/admin/users/${user.id}/set-password/`, {
        password: password.trim(),
      });
      window.alert("تم تعيين كلمة المرور. احفظها وأرسلها للطالب الآن — لن تظهر مرة أخرى من قاعدة البيانات.");
      load();
    } catch (e) {
      window.alert(e.response?.data?.detail || "تعذّر تعيين كلمة المرور");
    }
  }

  async function changeTeacherSubject(teacherId, subjectId) {
    if (!subjectId) return;
    try {
      await client.patch(`/admin/users/${teacherId}/set-subject/`, {
        taught_subject: Number(subjectId),
      });
      load();
    } catch (e) {
      window.alert(e.response?.data?.detail || "تعذّر تغيير المادة");
    }
  }

  if (loading && !data) {
    return (
      <div className="card" style={{ padding: 24, textAlign: "center" }}>
        <div className="spinner">جاري تحميل الحسابات…</div>
        <p style={{ color: "var(--text-muted)", marginTop: 12, fontSize: 13 }}>
          إذا استغرق الأمر طويلاً، قد يكون الخادم في وضع الإسبات — انتظر قليلاً أو حدّث الصفحة.
        </p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="card" style={{ padding: 24, textAlign: "center" }}>
        <div className="banner" style={{ marginBottom: 16 }}>{error}</div>
        <button type="button" className="btn btn-primary" onClick={load}>
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (!data) return null;

  const term = q.trim().toLowerCase();
  const filterFn = (p) =>
    !term ||
    (p.full_name || "").toLowerCase().includes(term) ||
    (p.phone || "").toLowerCase().includes(term) ||
    (p.email || "").toLowerCase().includes(term);
  const students = data.students.filter(filterFn);
  const teachers = data.teachers.filter(filterFn);
  // "Pending activation": student accounts that have not been activated yet
  // (no active subscription). Admin either grants a subscription or converts
  // them to a teacher. Newest signups first so admins can spot them quickly.
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
        <input className="form-control" style={{ maxWidth: 280 }} placeholder="بحث بالاسم أو الإيميل أو التليفون"
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
                  <th>التواصل</th>
                  <th>التليفون</th>
                  <th>تاريخ التسجيل</th>
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
                <th>التواصل</th>
                <th>التليفون</th>
                <th>الاشتراك</th>
                <th>مدة الاشتراك</th>
                <th>ينتهي في</th>
                <th>المجموعات</th>
                <th>كلمة المرور</th>
                <th>الحساب</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.full_name || "—"}</strong>{" "}
                    <span style={{ color: "var(--text-muted)", fontSize: 11 }}>#{s.id}</span>
                  </td>
                  <td>{contactLabel(s)}</td>
                  <td>{s.phone || "—"}</td>
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
                  <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>
                    {s.has_usable_password ? (
                      <span className="badge badge-active">معيّنة</span>
                    ) : (
                      <span className="badge badge-expired">بدون كلمة مرور</span>
                    )}{" "}
                    <button className="btn btn-sm btn-secondary" onClick={() => resetPassword(s)}>
                      تعيين كلمة مرور
                    </button>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className={`btn btn-sm ${s.is_active ? "btn-ghost" : "btn-primary"}`}
                      onClick={() => toggleActive(s.id, s.is_active)}>
                      {s.is_active ? "مُفعّل (إيقاف)" : "موقوف (تفعيل)"}
                    </button>{" "}
                    <button className="btn btn-sm btn-secondary" onClick={() => grantSubscription(s.id)}>
                      مدة التفعيل
                    </button>{" "}
                    <button className="btn btn-sm btn-ghost" style={{ color: "var(--error)" }}
                      onClick={() => deleteAccount(s)}>
                      حذف
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
                <th>التواصل</th>
                <th>التليفون</th>
                <th>المادة</th>
                <th>عدد المجموعات</th>
                <th>المجموعات</th>
                <th>كلمة المرور</th>
                <th>الحساب</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.full_name || "—"}</strong>{" "}
                    <span style={{ color: "var(--text-muted)", fontSize: 11 }}>#{t.id}</span>
                  </td>
                  <td>{contactLabel(t)}</td>
                  <td>{t.phone || "—"}</td>
                  <td>
                    <select
                      className="form-control"
                      style={{ minWidth: 140 }}
                      value={t.subject_id || ""}
                      onChange={(e) => changeTeacherSubject(t.id, e.target.value)}
                    >
                      <option value="">غير محددة</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </td>
                  <td><strong>{t.groups_count}</strong></td>
                  <td>
                    {t.groups.length ? t.groups.join("، ") : <span style={{ color: "var(--text-muted)" }}>بدون مجموعة</span>}
                  </td>
                  <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>
                    {t.has_usable_password ? (
                      <span className="badge badge-active">معيّنة</span>
                    ) : (
                      <span className="badge badge-expired">بدون كلمة مرور</span>
                    )}{" "}
                    <button className="btn btn-sm btn-secondary" onClick={() => resetPassword(t)}>
                      تعيين كلمة مرور
                    </button>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className={`btn btn-sm ${t.is_active ? "btn-ghost" : "btn-primary"}`}
                      onClick={() => toggleActive(t.id, t.is_active)}>
                      {t.is_active ? "مُفعّل (إيقاف)" : "موقوف (تفعيل)"}
                    </button>{" "}
                    <button className="btn btn-sm btn-ghost" style={{ color: "var(--error)" }}
                      onClick={() => deleteAccount(t)}>
                      حذف
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
    if (role === "student" && !(Number(days) > 0)) {
      setErr("حدد مدة التفعيل بالأيام");
      return;
    }
    setBusy(true);
    try {
      await client.patch(`/admin/users/${account.id}/set-role/`, {
        role,
        taught_subject: role === "teacher" ? Number(subjectId) : null,
      });
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

  async function removeAccount() {
    const label = account.full_name || account.email || `#${account.id}`;
    if (!window.confirm(`حذف حساب «${label}» نهائياً؟`)) return;
    setBusy(true);
    setErr("");
    try {
      await client.delete(`/admin/users/${account.id}/delete/`);
      onDone();
    } catch (e) {
      setErr(e.response?.data?.detail || "تعذّر الحذف");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td>
        <strong>{account.full_name || "—"}</strong>{" "}
        <span style={{ color: "var(--text-muted)", fontSize: 11 }}>#{account.id}</span>
      </td>
      <td>{contactLabel(account)}</td>
      <td>{account.phone || "—"}</td>
      <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>
        {account.created_at
          ? new Date(account.created_at).toLocaleString("ar-EG", {
              dateStyle: "short",
              timeStyle: "short",
            })
          : "—"}
      </td>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 140 }}>
            <select
              className="form-control"
              value={["30", "90", "180", "365"].includes(String(days)) ? String(days) : "custom"}
              onChange={(e) => {
                if (e.target.value === "custom") setDays("");
                else setDays(e.target.value);
              }}
            >
              <option value="30">30 يوم</option>
              <option value="90">90 يوم</option>
              <option value="180">180 يوم</option>
              <option value="365">365 يوم</option>
              <option value="custom">مخصص…</option>
            </select>
            {!["30", "90", "180", "365"].includes(String(days)) && (
              <input
                className="form-control"
                style={{ width: 110 }}
                type="number"
                min="1"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder="عدد الأيام"
              />
            )}
          </div>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>—</span>
        )}
      </td>
      <td style={{ whiteSpace: "nowrap" }}>
        <button className="btn btn-sm btn-primary" disabled={busy} onClick={activate}>
          {busy ? "…" : "تفعيل الحساب"}
        </button>{" "}
        <button className="btn btn-sm btn-ghost" style={{ color: "var(--error)" }} disabled={busy} onClick={removeAccount}>
          حذف
        </button>
        {err && <div className="error-text" style={{ fontSize: 11 }}>{err}</div>}
      </td>
    </tr>
  );
}

function GroupsTab() {
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [pickersLoaded, setPickersLoaded] = useState(false);
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
    setGroupsLoading(true);
    client
      .get("/admin/groups/")
      .then((res) => setGroups(res.data.results || res.data || []))
      .catch(() => setGroups([]))
      .finally(() => setGroupsLoading(false));
  }
  function loadPickers(force = false) {
    if (pickersLoaded && !force) return;
    client.get("/admin/available-students/").then((res) => setAvailableStudents(res.data));
    client.get("/admin/teachers/").then((res) => setTeachers(res.data));
    setPickersLoaded(true);
  }
  useEffect(() => {
    load();
    // Subjects + pickers only when opening a group (not on every Groups tab mount).
    try {
      const raw = sessionStorage.getItem("zad_subjects_cache_v1");
      if (raw) setSubjects(JSON.parse(raw));
    } catch {
      /* ignore */
    }
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
    loadPickers();
    if (!subjects.length) {
      client.get("/subjects/").then((res) => {
        const list = res.data.results || res.data || [];
        setSubjects(list);
        try {
          sessionStorage.setItem("zad_subjects_cache_v1", JSON.stringify(list));
        } catch {
          /* ignore */
        }
      });
    }
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
      loadPickers(true);
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
    loadPickers(true);
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

      {groupsLoading && <div className="spinner">جاري تحميل المجموعات…</div>}

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

function ScheduleTab() {
  const EMPTY = {
    title: "",
    group: "",
    subject: "",
    start_time: "",
    duration_minutes: 60,
    status: "scheduled",
  };
  const [groups, setGroups] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    client.get("/admin/groups/").then((res) => setGroups(res.data.results || res.data));
    client.get("/sessions/").then((res) => setSessions(res.data.results || res.data));
  }
  useEffect(() => {
    load();
  }, []);

  const selectedGroup = groups.find((g) => String(g.id) === String(form.group));
  const subjectOptions = selectedGroup?.teachers?.length
    ? selectedGroup.teachers.map((t) => ({
        id: t.subject,
        name: t.subject_name,
        teacher_name: t.full_name,
      }))
    : [];
  // Dedupe subjects if multiple teachers somehow share names
  const uniqueSubjects = [];
  const seen = new Set();
  subjectOptions.forEach((s) => {
    if (!seen.has(s.id)) {
      seen.add(s.id);
      uniqueSubjects.push(s);
    }
  });
  const pickedSubject = uniqueSubjects.find((s) => String(s.id) === String(form.subject));

  function set(k, v) {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === "group") next.subject = "";
      return next;
    });
  }

  function resetForm() {
    setForm(EMPTY);
    setEditingId(null);
    setMsg("");
  }

  async function save() {
    setMsg("");
    if (!form.group || !form.subject || !form.start_time) {
      setMsg("اختر المجموعة والمادة وموعد الحصة");
      return;
    }
    setBusy(true);
    const payload = {
      title: (form.title || "").trim(),
      group: Number(form.group),
      subject: Number(form.subject),
      start_time: form.start_time,
      duration_minutes: Number(form.duration_minutes) || 60,
      status: form.status,
    };
    try {
      if (editingId) {
        await client.patch(`/sessions/${editingId}/`, payload);
      } else {
        await client.post("/sessions/", payload);
      }
      resetForm();
      load();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر حفظ الحصة");
    } finally {
      setBusy(false);
    }
  }

  function editSession(s) {
    setEditingId(s.id);
    setMsg("");
    setForm({
      title: s.title || "",
      group: s.group ? String(s.group) : "",
      subject: s.subject ? String(s.subject) : "",
      start_time: s.start_time ? s.start_time.slice(0, 16) : "",
      duration_minutes: s.duration_minutes,
      status: s.status,
    });
  }

  async function remove(id) {
    if (!window.confirm("حذف هذه الحصة من الجدول؟")) return;
    await client.delete(`/sessions/${id}/`);
    if (editingId === id) resetForm();
    load();
  }

  return (
    <div>
      <div className="banner" style={{ marginBottom: 16 }}>
        أنت تضع جدول الحصص لكل المجموعات (اسم الحصة / اليوم ميلادي وهجري / الوقت / المادة / المجموعة).
        المدرس يضيف فقط رابط Zoom من لوحته.
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(280px, 380px) 1fr", gap: 24 }}>
        <div className="card" style={{ padding: 24, height: "fit-content" }}>
          <h3 style={{ marginBottom: 16 }}>{editingId ? "تعديل حصة" : "إضافة حصة للجدول"}</h3>

          <div className="form-group">
            <label>اسم الحصة</label>
            <input
              className="form-control"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="مثال: مراجعة الباب الأول — أو أي اسم براحتك"
            />
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
              اختياري. لو فاضي يظهر اسم المادة.
            </div>
          </div>

          <div className="form-group">
            <label>المجموعة</label>
            <select className="form-control" value={form.group} onChange={(e) => set("group", e.target.value)}>
              <option value="">اختر…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>المادة</label>
            <select
              className="form-control"
              value={form.subject}
              onChange={(e) => set("subject", e.target.value)}
              disabled={!form.group}
            >
              <option value="">اختر…</option>
              {uniqueSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.teacher_name ? ` — ${s.teacher_name}` : ""}
                </option>
              ))}
            </select>
            {form.group && uniqueSubjects.length === 0 && (
              <div className="error-text">لا يوجد مدرس مربوط بهذه المجموعة. أضف مدرساً من تبويب المجموعات أولاً.</div>
            )}
            {pickedSubject?.teacher_name && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                المدرس المعتمد: {pickedSubject.teacher_name}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>موعد الحصة</label>
            <input
              type="datetime-local"
              className="form-control"
              value={form.start_time}
              onChange={(e) => set("start_time", e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>المدة (دقيقة)</label>
            <input
              type="number"
              className="form-control"
              style={{ width: 120 }}
              value={form.duration_minutes}
              min={15}
              step={5}
              onChange={(e) => set("duration_minutes", e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>الحالة</label>
            <div className="filter-row">
              {[["scheduled", "مجدولة"], ["live", "مباشر الآن"], ["done", "منتهية"]].map(([v, t]) => (
                <span
                  key={v}
                  className={`chip ${form.status === v ? "active" : ""}`}
                  onClick={() => set("status", v)}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {msg && <div className="banner">{msg}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy} onClick={save}>
              {busy ? "…" : editingId ? "حفظ التعديل" : "إضافة الحصة"}
            </button>
            {editingId && (
              <button className="btn btn-ghost" onClick={resetForm}>إلغاء</button>
            )}
          </div>
        </div>

        <div>
          <div className="section-title">كل الحصص ({sessions.length})</div>
          {sessions.length === 0 && (
            <p style={{ color: "var(--text-muted)" }}>لا توجد حصص بعد. أضف أول حصة من النموذج.</p>
          )}
          {sessions.map((s) => {
            const when = formatSessionWhen(s.start_time);
            const subjectKey = resolveSubjectKey(s.subject_name) || "math";
            return (
              <div
                key={s.id}
                className="card session-card session-skin"
                data-subject={subjectKey}
                style={{ padding: 16, marginBottom: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
              >
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
                <div style={{ flex: 1, minWidth: 160 }}>
                  <strong className="session-card__title">{sessionDisplayTitle(s)}</strong>{" "}
                  {s.status === "live" && <span className="badge badge-live">مباشر</span>}
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {s.subject_name}
                    {s.session_number != null ? ` · #${s.session_number}` : ""}
                    {" · "}{s.group_name || "—"} · {s.teacher_name || "بدون مدرس"} · {s.duration_minutes} د
                    {s.zoom_link ? " · Zoom ✓" : " · بانتظار رابط Zoom"}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => editSession(s)}>تعديل</button>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(s.id)}>حذف</button>
              </div>
            );
          })}
        </div>
      </div>
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
