import { useEffect, useState } from "react";
import client from "../api/client";

/**
 * Telegram login via full-page OAuth redirect (no popup).
 *
 * Popup Login.auth often falls back to "enter phone number" and then
 * never returns tokens (postMessage blocked) — so nothing happens.
 *
 * Redirect flow instead:
 *   site → oauth.telegram.org ("Open Telegram") → Telegram app confirm
 *   → /auth/telegram/callback → logged in
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

    const origin = window.location.origin;
    // Must match BotFather domain exactly (no trailing slash / www).
    if (!origin.includes("karim-khaled-2.vercel.app") && !origin.includes("localhost")) {
      setError("افتح الموقع من الرابط: https://karim-khaled-2.vercel.app");
      return;
    }

    setBusy(true);
    sessionStorage.setItem("tg_auth_from", mode);

    const returnTo = `${origin}/auth/telegram/callback`;
    const url = new URL("https://oauth.telegram.org/auth");
    url.searchParams.set("bot_id", String(botId));
    url.searchParams.set("origin", origin);
    url.searchParams.set("request_access", "write");
    url.searchParams.set("return_to", returnTo);
    // Full page — shows "Open Telegram to confirm", not the phone form popup.
    window.location.assign(url.toString());
  }

  const title =
    mode === "register"
      ? "إنشاء حساب عبر تيليجرام"
      : "تسجيل الدخول عبر تيليجرام";

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
        <br />
        <span style={{ fontSize: 12 }}>
          سيتم فتح تطبيق تيليجرام للتأكيد — بدون كتابة رقم التليفون
        </span>
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
