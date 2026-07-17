import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    gender: "male",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e) {
    e.preventDefault();
    setErrors({});
    setBusy(true);
    try {
      await register(form);
      navigate("/");
    } catch (err) {
      setErrors(err.response?.data || { detail: "تعذّر إنشاء الحساب" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form-card" onSubmit={submit}>
      <h2 style={{ textAlign: "center", marginBottom: 24 }}>إنشاء حساب جديد</h2>
      <div className="form-group">
        <label>الاسم *</label>
        <input className="form-control" value={form.full_name}
          onChange={(e) => set("full_name", e.target.value)} required />
      </div>
      <div className="form-group">
        <label>رقم التليفون *</label>
        <input className="form-control" value={form.phone}
          onChange={(e) => set("phone", e.target.value)} placeholder="01xxxxxxxxx" required />
        {errors.phone && <div className="error-text">{errors.phone}</div>}
      </div>
      <div className="form-group">
        <label>الجنس *</label>
        <div style={{ display: "flex", gap: 16 }}>
          <label style={{ fontWeight: 400 }}>
            <input type="radio" checked={form.gender === "male"}
              onChange={() => set("gender", "male")} /> ذكر
          </label>
          <label style={{ fontWeight: 400 }}>
            <input type="radio" checked={form.gender === "female"}
              onChange={() => set("gender", "female")} /> أنثى
          </label>
        </div>
      </div>
      <div className="form-group">
        <label>البريد الإلكتروني *</label>
        <input className="form-control" type="email" value={form.email}
          onChange={(e) => set("email", e.target.value)} required />
        {errors.email && <div className="error-text">{errors.email}</div>}
      </div>
      <div className="form-group">
        <label>كلمة المرور *</label>
        <input className="form-control" type="password" value={form.password}
          onChange={(e) => set("password", e.target.value)} required />
        {errors.password && <div className="error-text">{errors.password}</div>}
      </div>
      {errors.detail && <div className="error-text">{errors.detail}</div>}
      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? "…" : "إنشاء الحساب"}
      </button>
      <p style={{ textAlign: "center", marginTop: 16, color: "var(--text-muted)", fontSize: 14 }}>
        لديك حساب؟ <Link to="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>تسجيل الدخول</Link>
      </p>
    </form>
  );
}
