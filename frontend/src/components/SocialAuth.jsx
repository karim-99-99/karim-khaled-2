import { useEffect, useState } from "react";
import client from "../api/client";

// Works even if Render is cold / /auth/providers fails.
const FALLBACK_BOT_ID = import.meta.env.VITE_TELEGRAM_BOT_ID || "8880815898";

function buildTelegramOAuthUrl(botId) {
  const origin = window.location.origin;
  const returnTo = `${origin}/auth/telegram/callback`;
  const url = new URL("https://oauth.telegram.org/auth");
  url.searchParams.set("bot_id", String(botId));
  url.searchParams.set("origin", origin);
  url.searchParams.set("return_to", returnTo);
  url.searchParams.set("request_access", "write");
  return url.toString();
}

/**
 * Full-page Telegram OAuth (Open Telegram → confirm → callback).
 * Does not wait for backend to start the flow (avoids Render cold-start block).
 */
export default function SocialAuth({ mode = "login" }) {
  const [botId, setBotId] = useState(FALLBACK_BOT_ID);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    client
      .get("/auth/providers/")
      .then((res) => {
        const id = res.data?.telegram?.bot_id;
        if (id) setBotId(String(id));
      })
      .catch(() => {
        /* keep fallback bot id */
      });
  }, []);

  function startTelegram(e) {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setError("");

    if (!botId) {
      setError("بوت تيليجرام غير مضبوط");
      return;
    }

    const origin = window.location.origin;
    if (
      !origin.includes("karim-khaled-2.vercel.app") &&
      !origin.includes("localhost") &&
      !origin.includes("127.0.0.1")
    ) {
      setError("افتح الموقع من: https://karim-khaled-2.vercel.app");
      return;
    }

    setBusy(true);
    sessionStorage.setItem("tg_auth_from", mode);
    // Same-window redirect — required so Telegram can return_to the site.
    window.location.href = buildTelegramOAuthUrl(botId);
  }

  const title =
    mode === "register"
      ? "إنشاء حساب عبر تيليجرام"
      : "تسجيل الدخول عبر تيليجرام";

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
        <br />
        <span style={{ fontSize: 12 }}>
          اضغط الزر → Open Telegram → Log in داخل التطبيق (بدون كتابة رقم)
        </span>
      </p>

      <button
        type="button"
        className="btn btn-block"
        onClick={startTelegram}
        disabled={busy}
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
