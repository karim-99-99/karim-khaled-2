import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";

function readTelegramParams(search, hash) {
  const fromQuery = Object.fromEntries(new URLSearchParams(search || ""));
  if (fromQuery.id && fromQuery.hash) return fromQuery;

  const rawHash = (hash || "").replace(/^#/, "");
  if (!rawHash) return null;

  const fromHash = Object.fromEntries(new URLSearchParams(rawHash));
  if (fromHash.id && fromHash.hash) return fromHash;

  if (fromHash.tgAuthResult) {
    try {
      const padded =
        fromHash.tgAuthResult +
        "=".repeat((4 - (fromHash.tgAuthResult.length % 4)) % 4);
      return JSON.parse(atob(padded));
    } catch {
      return null;
    }
  }
  return null;
}

export default function TelegramCallback() {
  const { acceptTokens } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");
  const [status, setStatus] = useState("جاري تأكيد تسجيل تيليجرام…");

  useEffect(() => {
    let cancelled = false;
    let tries = 0;

    async function run() {
      const params = readTelegramParams(location.search, location.hash);
      if (!params?.id || !params?.hash) {
        tries += 1;
        if (tries < 8) {
          setTimeout(run, 300);
          return;
        }
        setError(
          "لم ترجع بيانات تيليجرام. ابقَ على صفحة Open Telegram حتى ينتهي التأكيد، ولا تغلق التبويب."
        );
        return;
      }

      try {
        setStatus("جاري إنشاء الجلسة…");
        const payload = {
          id: params.id,
          first_name: params.first_name,
          last_name: params.last_name,
          username: params.username,
          photo_url: params.photo_url,
          auth_date: params.auth_date,
          hash: params.hash,
        };
        const { data } = await client.post("/auth/telegram/", payload);
        if (cancelled) return;
        sessionStorage.removeItem("tg_auth_from");
        await acceptTokens(data);
        navigate("/", { replace: true });
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.detail || "فشل تسجيل تيليجرام");
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [acceptTokens, navigate, location.search, location.hash]);

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
      <div className="spinner">{status}</div>
    </div>
  );
}
