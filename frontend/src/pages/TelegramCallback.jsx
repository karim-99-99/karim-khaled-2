import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";

/**
 * Telegram OIDC return page.
 * Prefer posting code/state to the opener popup parent (hadafak).
 * If opener is missing (Telegram Desktop / same-tab redirect), finish login here.
 */
export default function TelegramCallback() {
  const { acceptTokens } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState("جاري إكمال تسجيل تيليجرام…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function finishLocally(code, state) {
      try {
        const { data: tokens } = await client.post("/auth/telegram/complete/", {
          code,
          state,
        });
        if (cancelled) return;
        await acceptTokens({
          access: tokens.access || tokens.access_token,
          refresh: tokens.refresh,
          user: tokens.user,
        });
        setMessage("تم تسجيل الدخول بنجاح");
        navigate("/", { replace: true });
      } catch (err) {
        if (cancelled) return;
        setFailed(true);
        setMessage(
          err.response?.data?.detail ||
            err.response?.data?.error ||
            "فشل إكمال تسجيل تيليجرام"
        );
      }
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error_description") || params.get("error");

    if (window.opener && !window.opener.closed) {
      if (code && state) {
        window.opener.postMessage(
          { type: "TELEGRAM_LOGIN_SUCCESS", payload: { code, state } },
          window.location.origin
        );
        setMessage("تم التأكيد — يمكنك إغلاق هذه النافذة");
        setTimeout(() => window.close(), 400);
      } else {
        window.opener.postMessage(
          {
            type: "TELEGRAM_LOGIN_ERROR",
            error: error || "تم إلغاء تسجيل تيليجرام",
          },
          window.location.origin
        );
        setFailed(true);
        setMessage(error || "تعذّر إكمال تسجيل تيليجرام");
        setTimeout(() => window.close(), 400);
      }
      return () => {
        cancelled = true;
      };
    }

    if (code && state) {
      finishLocally(code, state);
    } else {
      setFailed(true);
      setMessage(error || "لا توجد بيانات تيليجرام");
    }

    return () => {
      cancelled = true;
    };
  }, [acceptTokens, navigate]);

  return (
    <div className="card form-card" style={{ textAlign: "center" }}>
      <div className="spinner" style={{ marginBottom: 12 }}>
        {message}
      </div>
      {failed && (
        <Link to="/login" className="btn btn-secondary btn-sm">
          العودة لتسجيل الدخول
        </Link>
      )}
    </div>
  );
}
