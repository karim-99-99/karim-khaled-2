import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";

function readTelegramParams() {
  const fromQuery = Object.fromEntries(new URLSearchParams(window.location.search));
  if (fromQuery.id && fromQuery.hash) return fromQuery;

  // Some Telegram clients put data in the hash fragment.
  const hash = window.location.hash.replace(/^#/, "");
  if (hash) {
    const fromHash = Object.fromEntries(new URLSearchParams(hash));
    if (fromHash.id && fromHash.hash) return fromHash;
    if (fromHash.tgAuthResult) {
      try {
        const padded = fromHash.tgAuthResult + "=".repeat((4 - (fromHash.tgAuthResult.length % 4)) % 4);
        return JSON.parse(atob(padded));
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

/**
 * return_to target after oauth.telegram.org confirms login.
 */
export default function TelegramCallback() {
  const { acceptTokens } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    const params = readTelegramParams();
    if (!params?.id || !params?.hash) {
      setError("لم تكتمل بيانات تيليجرام. حاول مرة أخرى من صفحة تسجيل الدخول.");
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
