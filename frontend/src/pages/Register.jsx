import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const METHODS = [
  { id: "telegram", label: "تيليجرام" },
  { id: "whatsapp", label: "واتساب" },
  { id: "email", label: "البريد" },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [method, setMethod] = useState("telegram");
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
      const payload = {
        full_name: form.full_name,
        phone: form.phone,
        gender: form.gender,
        password: form.password,
        contact_channel: method,
      };
      if (method === "email") {
        payload.email = form.email;
      }
      await register(payload);
      navigate("/");
    } catch (err) {
      if (err?.message === "ACCOUNT_CREATED_LOGIN_FAILED") {
        setErrors({
          detail:
            "تم إنشاء الحساب. الرجاء تسجيل الدخول الآن (قد يحتاج السيرفر دقيقة للاستيقاظ).",
        });
      } else if (!err.response) {
        setErrors({
          detail:
            "تعذّر الاتصال بالسيرفر. انتظر 30–60 ثانية ثم أعد المحاولة.",
        });
      } else {
        const data = err.response.data || {};
        const flat = {};
        for (const [k, v] of Object.entries(data)) {
          flat[k] = Array.isArray(v) ? v.join(" ") : String(v);
        }
        if (!flat.detail && !flat.email && !flat.phone && !flat.password) {
          flat.detail = "تعذّر إنشاء الحساب";
        }
        setErrors(flat);
      }
    } finally {
      setBusy(false);
    }
  }

  const phoneLabel =
    method === "telegram"
      ? "رقم تيليجرام *"
      : method === "whatsapp"
        ? "رقم واتساب *"
        : "رقم التليفون *";

  return (
    <form className="card form-card" onSubmit={submit}>
      <h2 style={{ textAlign: "center", marginBottom: 16 }}>إنشاء حساب جديد</h2>

      <div className="filter-row" style={{ justifyContent: "center" }}>
        {METHODS.map((m) => (
          <span
            key={m.id}
            className={`chip ${method === m.id ? "active" : ""}`}
            onClick={() => {
              setMethod(m.id);
              setErrors({});
            }}
          >
            {m.label}
          </span>
        ))}
      </div>

      {method !== "email" && (
        <p
          style={{
            color: "var(--text-muted)",
            fontSize: 13,
            marginBottom: 16,
            textAlign: "center",
            lineHeight: 1.7,
          }}
        >
          سجّل برقم{" "}
          {method === "telegram" ? "تيليجرام" : "واتساب"} — يتم حفظ وسيلة
          التواصل تلقائياً دون الحاجة لبريد إلكتروني.
        </p>
      )}

      <div className="form-group">
        <label>الاسم *</label>
        <input
          className="form-control"
          value={form.full_name}
          onChange={(e) => set("full_name", e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label>{phoneLabel}</label>
        <input
          className="form-control"
          type="tel"
          inputMode="tel"
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          placeholder="01xxxxxxxxx"
          required
        />
        {errors.phone && <div className="error-text">{errors.phone}</div>}
      </div>

      <div className="form-group">
        <label>الجنس *</label>
        <div style={{ display: "flex", gap: 16 }}>
          <label style={{ fontWeight: 400 }}>
            <input
              type="radio"
              checked={form.gender === "male"}
              onChange={() => set("gender", "male")}
            />{" "}
            ذكر
          </label>
          <label style={{ fontWeight: 400 }}>
            <input
              type="radio"
              checked={form.gender === "female"}
              onChange={() => set("gender", "female")}
            />{" "}
            أنثى
          </label>
        </div>
      </div>

      {method === "email" && (
        <div className="form-group">
          <label>البريد الإلكتروني *</label>
          <input
            className="form-control"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            required
          />
          {errors.email && <div className="error-text">{errors.email}</div>}
        </div>
      )}

      <div className="form-group">
        <label>كلمة المرور *</label>
        <input
          className="form-control"
          type="password"
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
          required
          minLength={6}
        />
        {errors.password && <div className="error-text">{errors.password}</div>}
      </div>

      {errors.detail && <div className="error-text">{errors.detail}</div>}
      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? "…" : "إنشاء الحساب"}
      </button>
      <p style={{ textAlign: "center", marginTop: 16, color: "var(--text-muted)", fontSize: 14 }}>
        لديك حساب؟{" "}
        <Link to="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>
          تسجيل الدخول
        </Link>
      </p>
    </form>
  );
}
