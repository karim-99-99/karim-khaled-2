import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

/**
 * Popup return page for Telegram OIDC (hadafak sequence).
 * Posts code/state to opener, then closes.
 */
export default function TelegramCallback() {
  const [message, setMessage] = useState("جاري إكمال تسجيل تيليجرام…");

  useEffect(() => {
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
      } else {
        window.opener.postMessage(
          {
            type: "TELEGRAM_LOGIN_ERROR",
            error: error || "تم إلغاء تسجيل تيليجرام",
          },
          window.location.origin
        );
        setMessage("تعذّر إكمال تسجيل تيليجرام");
      }
      setTimeout(() => window.close(), 400);
    } else if (code && state) {
      // Opened without popup (rare): send user to login with params for recovery.
      setMessage("أعد المحاولة من صفحة تسجيل الدخول");
    } else {
      setMessage("لا توجد بيانات تيليجرام");
    }
  }, []);

  return (
    <div className="card form-card" style={{ textAlign: "center" }}>
      <div className="spinner" style={{ marginBottom: 12 }}>{message}</div>
      <Link to="/login" className="btn btn-secondary btn-sm">
        العودة لتسجيل الدخول
      </Link>
    </div>
  );
}
