import { useEffect, useState } from "react";
import client from "../api/client";

/**
 * Official Telegram OAuth — always full redirect (works on mobile + desktop).
 * Opens oauth.telegram.org → Telegram confirm → /auth/telegram/callback
 */
export default function SocialAuth({ mode = "login" }) {
  const [providers, setProviders] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

  function startTelegram(e) {
    e?.preventDefault?.();
    setError("");
    const botId = providers?.telegram?.bot_id;
    if (!providers?.telegram?.enabled || !botId) {
      setError("تسجيل تيليجرام غير مفعّل على السيرفر بعد");
      return;
    }

    setBusy(true);
    const origin = window.location.origin;
    const returnTo = `${origin}/auth/telegram/callback`;
    const url = new URL("https://oauth.telegram.org/auth");
    url.searchParams.set("bot_id", String(botId));
    url.searchParams.set("origin", origin);
    url.searchParams.set("request_access", "write");
    url.searchParams.set("return_to", returnTo);
    url.searchParams.set("lang", "ar");
    window.location.href = url.toString();
  }

  const title =
    mode === "register"
      ? "إنشاء حساب عبر تيليجرام تلقائياً"
      : "دخول عبر تيليجرام بدون ملء بيانات";

  const enabled = Boolean(providers?.telegram?.enabled && providers?.telegram?.bot_id);

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

      <button
        type="button"
        className="btn btn-block"
        onClick={startTelegram}
        disabled={!enabled || busy}
        style={{
          marginBottom: 10,
          background: "#fff",
          color: "#229ED9",
          border: "1.5px solid #229ED9",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          opacity: !enabled ? 0.55 : 1,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 240 240" aria-hidden="true">
          <circle cx="120" cy="120" r="120" fill="#229ED9" />
          <path
            fill="#fff"
            d="M98 170c3 0 4-1 6-3l16-16 34 25c6 3 11 1 12-6l23-107c2-9-3-13-9-10L51 108c-8 3-8 8-1 10l42 13 98-62c5-3 9-1 5 2"
          />
        </svg>
        {busy ? "جاري فتح تيليجرام…" : "تسجيل عبر تيليجرام"}
      </button>

      {error && <div className="error-text" style={{ marginTop: 8 }}>{error}</div>}

      {!enabled && providers && (
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
