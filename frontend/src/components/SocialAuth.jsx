import { useEffect, useRef, useState } from "react";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";

/**
 * Automatic Telegram Login Widget.
 * Opens Telegram, returns name/username/id, creates/logs in the account.
 */
export default function SocialAuth({ onSuccess, mode = "login" }) {
  const { acceptTokens } = useAuth();
  const [providers, setProviders] = useState(null);
  const [error, setError] = useState("");
  const tgRef = useRef(null);

  useEffect(() => {
    client
      .get("/auth/providers/")
      .then((res) => setProviders(res.data))
      .catch(() =>
        setProviders({
          telegram: { enabled: false },
          email: { enabled: true },
        })
      );
  }, []);

  useEffect(() => {
    if (!providers?.telegram?.enabled || !tgRef.current) return;
    const bot = providers.telegram.bot_username;
    tgRef.current.innerHTML = "";

    window.onTelegramAuth = async (user) => {
      setError("");
      try {
        const { data } = await client.post("/auth/telegram/", user);
        await acceptTokens(data);
        onSuccess?.(data.user);
      } catch (err) {
        setError(err.response?.data?.detail || "فشل تسجيل تيليجرام");
      }
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", bot);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-lang", "ar");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    tgRef.current.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
    };
  }, [providers, acceptTokens, onSuccess]);

  const title =
    mode === "register"
      ? "إنشاء حساب عبر تيليجرام تلقائياً"
      : "دخول عبر تيليجرام بدون ملء بيانات";

  return (
    <div style={{ marginBottom: 20 }}>
      <p
        style={{
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: 14,
          marginBottom: 12,
          lineHeight: 1.7,
        }}
      >
        {title}
      </p>

      <div
        ref={tgRef}
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: 8,
          minHeight: providers?.telegram?.enabled ? 44 : 0,
        }}
      />

      {!providers?.telegram?.enabled && (
        <button
          type="button"
          className="btn btn-block"
          disabled
          style={{
            marginBottom: 10,
            background: "#229ED9",
            color: "#fff",
            border: "none",
            opacity: 0.55,
          }}
        >
          تسجيل تيليجرام (قيد التفعيل على السيرفر)
        </button>
      )}

      {error && <div className="error-text" style={{ marginTop: 8 }}>{error}</div>}

      {providers && !providers.telegram?.enabled && (
        <p
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            textAlign: "center",
            marginTop: 8,
            lineHeight: 1.6,
          }}
        >
          أضف TELEGRAM_BOT_TOKEN و TELEGRAM_BOT_USERNAME في إعدادات Render.
        </p>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          margin: "18px 0 8px",
          color: "var(--text-muted)",
          fontSize: 13,
        }}
      >
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        أو بالبريد وكلمة المرور
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>
    </div>
  );
}
