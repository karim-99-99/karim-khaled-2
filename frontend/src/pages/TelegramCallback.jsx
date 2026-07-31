import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";

/**
 * Return URL for Telegram OAuth redirect (mobile + fallback).
 * Telegram appends id, first_name, username, auth_date, hash, ...
 */
export default function TelegramCallback() {
  const { acceptTokens } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    const params = Object.fromEntries(new URLSearchParams(window.location.search));
    if (!params.id || !params.hash) {
      setError("لم تكتمل بيانات تيليجرام. حاول مرة أخرى.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await client.post("/auth/telegram/", params);
        if (cancelled) return;
        await acceptTokens(data);
        navigate("/", { replace: true });
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.detail || "فشل تسجيل تيليجرام");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [acceptTokens, navigate]);

  if (error) {
    return (
      <div className="card form-card" style={{ textAlign: "center" }}>
        <h2 style={{ marginBottom: 12 }}>تعذّر الدخول عبر تيليجرام</h2>
        <div className="error-text" style={{ marginBottom: 16 }}>{error}</div>
        <Link to="/login" className="btn btn-primary">
          العودة لتسجيل الدخول
        </Link>
      </div>
    );
  }

  return (
    <div className="card form-card" style={{ textAlign: "center" }}>
      <div className="spinner">جاري تأكيد تسجيل تيليجرام…</div>
    </div>
  );
}
