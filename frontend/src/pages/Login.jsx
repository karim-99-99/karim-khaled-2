import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const METHODS = [
  { id: "telegram", label: "تيليجرام" },
  { id: "whatsapp", label: "واتساب" },
  { id: "email", label: "البريد" },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [method, setMethod] = useState("telegram");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (method === "email") {
        await login({ method, email, password });
      } else {
        await login({ method, phone, password });
      }
      navigate("/");
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : method === "email"
            ? "البريد الإلكتروني أو كلمة المرور غير صحيحة"
            : "رقم التليفون أو كلمة المرور غير صحيحة"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form-card" onSubmit={submit}>
      <h2 style={{ textAlign: "center", marginBottom: 16 }}>تسجيل الدخول</h2>

      <div className="filter-row" style={{ justifyContent: "center" }}>
        {METHODS.map((m) => (
          <span
            key={m.id}
            className={`chip ${method === m.id ? "active" : ""}`}
            onClick={() => {
              setMethod(m.id);
              setError("");
            }}
          >
            {m.label}
          </span>
        ))}
      </div>

      {method === "email" ? (
        <div className="form-group">
          <label>البريد الإلكتروني</label>
          <input
            className="form-control"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
      ) : (
        <div className="form-group">
          <label>
            {method === "telegram" ? "رقم تيليجرام" : "رقم واتساب"}
          </label>
          <input
            className="form-control"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01xxxxxxxxx"
            required
          />
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
            استخدم نفس الرقم المسجّل على حسابك
          </p>
        </div>
      )}

      <div className="form-group">
        <label>كلمة المرور</label>
        <input
          className="form-control"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error && <div className="error-text">{error}</div>}
      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? "…" : "تسجيل الدخول"}
      </button>
      <p style={{ textAlign: "center", marginTop: 16, color: "var(--text-muted)", fontSize: 14 }}>
        ليس لديك حساب؟{" "}
        <Link to="/register" style={{ color: "var(--primary)", fontWeight: 600 }}>
          إنشاء حساب
        </Link>
      </p>
    </form>
  );
}
