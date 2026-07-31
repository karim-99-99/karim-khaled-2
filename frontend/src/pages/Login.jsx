import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import TelegramLoginButton from "../components/TelegramLoginButton";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      navigate("/");
    } catch {
      setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card form-card">
      <h2 style={{ textAlign: "center", marginBottom: 16 }}>تسجيل الدخول</h2>

      <TelegramLoginButton
        label="المتابعة عبر تيليجرام"
        onSuccess={() => navigate("/")}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          margin: "8px 0 16px",
          color: "var(--text-muted)",
          fontSize: 13,
        }}
      >
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        أو بالبريد
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>

      <form onSubmit={submit}>
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
          {busy ? "…" : "تسجيل الدخول بالبريد"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: 16, color: "var(--text-muted)", fontSize: 14 }}>
        ليس لديك حساب؟{" "}
        <Link to="/register" style={{ color: "var(--primary)", fontWeight: 600 }}>
          إنشاء حساب
        </Link>
      </p>
    </div>
  );
}
