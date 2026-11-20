import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import TelegramLoginButton from "../components/TelegramLoginButton";
import "../styles/auth-exact.css";

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
    <div className="auth-exact">
      <div className="auth-panel card form-card">
        <h2>تسجيل الدخول</h2>

        <TelegramLoginButton
          label="المتابعة عبر تيليجرام"
          onSuccess={() => navigate("/")}
        />

        <div className="auth-or">
          <i />
          أو بالبريد
          <i />
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

        <p className="auth-foot">
          ليس لديك حساب؟{" "}
          <Link to="/register">إنشاء حساب</Link>
        </p>
      </div>
    </div>
  );
}
