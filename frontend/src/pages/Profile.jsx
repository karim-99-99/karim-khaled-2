import { useEffect, useState } from "react";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";

const ROLE_LABEL = {
  student: "طالب",
  teacher: "مدرس",
  admin: "مدير",
};

const GENDER_LABEL = {
  male: "ذكر",
  female: "أنثى",
};

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    gender: "male",
  });
  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);

  const [passwords, setPasswords] = useState({
    old_password: "",
    new_password: "",
    new_password_confirm: "",
  });
  const [passMsg, setPassMsg] = useState("");
  const [passErr, setPassErr] = useState("");
  const [passBusy, setPassBusy] = useState(false);

  const [subscription, setSubscription] = useState(null);
  const [parentLink, setParentLink] = useState(null);

  useEffect(() => {
    if (!user) return;
    setForm({
      full_name: user.full_name || "",
      phone: user.phone || "",
      gender: user.gender || "male",
    });
  }, [user]);

  useEffect(() => {
    if (user?.role === "student") {
      client
        .get("/subscription/")
        .then((res) => setSubscription(res.data))
        .catch(() => setSubscription(null));
      client
        .get("/auth/parent-link/")
        .then((res) => setParentLink(res.data))
        .catch(() => setParentLink(null));
    }
  }, [user]);

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function saveProfile(e) {
    e.preventDefault();
    setProfileMsg("");
    setProfileErr("");
    setProfileBusy(true);
    try {
      await client.patch("/auth/me/", {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        gender: form.gender,
      });
      await refreshUser();
      setProfileMsg("تم حفظ بيانات الملف الشخصي");
    } catch (err) {
      const data = err.response?.data || {};
      const parts = [];
      for (const [k, v] of Object.entries(data)) {
        parts.push(Array.isArray(v) ? v.join(" ") : String(v));
      }
      setProfileErr(parts.join(" ") || "تعذّر حفظ البيانات");
    } finally {
      setProfileBusy(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    setPassMsg("");
    setPassErr("");
    setPassBusy(true);
    try {
      await client.post("/auth/change-password/", passwords);
      setPassMsg("تم تغيير كلمة المرور بنجاح");
      setPasswords({
        old_password: "",
        new_password: "",
        new_password_confirm: "",
      });
    } catch (err) {
      const data = err.response?.data || {};
      const parts = [];
      for (const [k, v] of Object.entries(data)) {
        parts.push(Array.isArray(v) ? v.join(" ") : String(v));
      }
      setPassErr(parts.join(" ") || "تعذّر تغيير كلمة المرور");
    } finally {
      setPassBusy(false);
    }
  }

  if (!user) return <div className="spinner">جاري التحميل…</div>;

  const sub = subscription?.subscription;
  const subActive = subscription?.status === "active" || user.has_active_subscription;

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>الملف الشخصي</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>
        عرض بيانات حسابك وتغيير كلمة المرور
      </p>

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>بيانات الحساب</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14,
            marginBottom: 8,
          }}
        >
          <Info label="الاسم" value={user.full_name} />
          <Info label="البريد" value={user.email} />
          <Info label="التليفون" value={user.phone || "—"} />
          <Info label="الجنس" value={GENDER_LABEL[user.gender] || "—"} />
          <Info label="الدور" value={ROLE_LABEL[user.role] || user.role} />
          {user.role === "teacher" && (
            <Info label="المادة" value={user.taught_subject_name || "—"} />
          )}
          <Info
            label="تاريخ التسجيل"
            value={
              user.created_at
                ? new Date(user.created_at).toLocaleString("ar-EG", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "—"
            }
          />
          {user.role === "student" && (
            <Info
              label="الاشتراك"
              value={
                subActive
                  ? `نشط${sub?.end_date ? ` — ينتهي ${sub.end_date}` : ""}`
                  : "غير مشترك"
              }
            />
          )}
        </div>
      </div>

      {user.role === "student" && parentLink && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>ربط ولي الأمر بتليجرام</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: 12, fontSize: 14 }}>
            افتح الرابط من هاتف ولي الأمر أو أرسل له الكود ليربط حسابه ببوت مرام ويستلم تقارير الحصص.
          </p>
          <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
            <Info label="كود الربط" value={parentLink.code} />
            <div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>رابط البوت</div>
              {String(parentLink.url || "").startsWith("http") ? (
                <a href={parentLink.url} target="_blank" rel="noreferrer" style={{ fontWeight: 700, wordBreak: "break-all" }}>
                  {parentLink.url}
                </a>
              ) : (
                <code style={{ fontWeight: 700 }}>{parentLink.url}</code>
              )}
            </div>
            <Info
              label="الحالة"
              value={
                parentLink.linked_count > 0
                  ? `مربوط (${parentLink.linked_count})`
                  : "غير مربوط بعد"
              }
            />
          </div>
          {(parentLink.parents || []).length > 0 && (
            <ul style={{ margin: 0, paddingInlineStart: 18 }}>
              {parentLink.parents.map((p) => (
                <li key={p.id}>{p.display_name || p.username || `#${p.id}`}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <form className="card" style={{ padding: 20, marginBottom: 20 }} onSubmit={saveProfile}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>تعديل البيانات</h2>
        <div className="form-group">
          <label>الاسم الكامل</label>
          <input
            className="form-control"
            value={form.full_name}
            onChange={(e) => setField("full_name", e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>رقم التليفون</label>
          <input
            className="form-control"
            value={form.phone}
            onChange={(e) => setField("phone", e.target.value)}
            placeholder="01xxxxxxxxx"
          />
        </div>
        <div className="form-group">
          <label>الجنس</label>
          <div style={{ display: "flex", gap: 16 }}>
            <label style={{ fontWeight: 400 }}>
              <input
                type="radio"
                checked={form.gender === "male"}
                onChange={() => setField("gender", "male")}
              />{" "}
              ذكر
            </label>
            <label style={{ fontWeight: 400 }}>
              <input
                type="radio"
                checked={form.gender === "female"}
                onChange={() => setField("gender", "female")}
              />{" "}
              أنثى
            </label>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
          البريد الإلكتروني: <strong>{user.email}</strong> (لا يمكن تغييره من هنا)
        </p>
        {profileErr && <div className="error-text">{profileErr}</div>}
        {profileMsg && (
          <div style={{ color: "var(--success, #059669)", marginBottom: 12, fontSize: 14 }}>
            {profileMsg}
          </div>
        )}
        <button className="btn btn-primary" disabled={profileBusy}>
          {profileBusy ? "…" : "حفظ التعديلات"}
        </button>
      </form>

      <form className="card" style={{ padding: 20 }} onSubmit={changePassword}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>تغيير كلمة المرور</h2>
        <div className="form-group">
          <label>كلمة المرور الحالية *</label>
          <input
            className="form-control"
            type="password"
            value={passwords.old_password}
            onChange={(e) =>
              setPasswords((p) => ({ ...p, old_password: e.target.value }))
            }
            required
            autoComplete="current-password"
          />
        </div>
        <div className="form-group">
          <label>كلمة المرور الجديدة *</label>
          <input
            className="form-control"
            type="password"
            value={passwords.new_password}
            onChange={(e) =>
              setPasswords((p) => ({ ...p, new_password: e.target.value }))
            }
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <div className="form-group">
          <label>تأكيد كلمة المرور الجديدة *</label>
          <input
            className="form-control"
            type="password"
            value={passwords.new_password_confirm}
            onChange={(e) =>
              setPasswords((p) => ({
                ...p,
                new_password_confirm: e.target.value,
              }))
            }
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        {passErr && <div className="error-text">{passErr}</div>}
        {passMsg && (
          <div style={{ color: "var(--success, #059669)", marginBottom: 12, fontSize: 14 }}>
            {passMsg}
          </div>
        )}
        <button className="btn btn-primary" disabled={passBusy}>
          {passBusy ? "…" : "تغيير كلمة المرور"}
        </button>
      </form>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}
