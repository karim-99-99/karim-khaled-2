import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

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
    <form className="card form-card" onSubmit={submit}>
      <h2 style={{ textAlign: "center", marginBottom: 24 }}>تسجيل الدخول</h2>
      <div className="form-group">
        <label>البريد الإلكتروني</label>
        <input className="form-control" type="email" value={email}
          onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="form-group">
        <label>كلمة المرور</label>
        <input className="form-control" type="password" value={password}
          onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error && <div className="error-text">{error}</div>}
      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? "…" : "تسجيل الدخول"}
      </button>
      <p style={{ textAlign: "center", marginTop: 16, color: "var(--text-muted)", fontSize: 14 }}>
        ليس لديك حساب؟ <Link to="/register" style={{ color: "var(--primary)", fontWeight: 600 }}>إنشاء حساب</Link>
      </p>
    </form>
  );
}
