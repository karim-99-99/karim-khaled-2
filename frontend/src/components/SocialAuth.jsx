import { useEffect, useState } from "react";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";

function loadTelegramWidget() {
  return new Promise((resolve, reject) => {
    if (window.Telegram?.Login?.auth) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[data-telegram-widget="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.dataset.telegramWidget = "1";
    script.onload = () => resolve();
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

function isMobile() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/**
 * Official Telegram OAuth (same flow as oauth.telegram.org screenshots):
 * custom button → Telegram confirm → name/username/photo returned.
 */
export default function SocialAuth({ onSuccess, mode = "login" }) {
  const { acceptTokens } = useAuth();
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
    // Prefetch widget script
    loadTelegramWidget().catch(() => {});
  }, []);

  async function completeWithUser(user) {
    const { data } = await client.post("/auth/telegram/", user);
    await acceptTokens(data);
    onSuccess?.(data.user);
  }

  function redirectToTelegramOAuth(botId) {
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

  async function startTelegram(e) {
    e?.preventDefault?.();
    setError("");
    if (!providers?.telegram?.enabled || !providers.telegram.bot_id) {
      setError("تسجيل تيليجرام غير مفعّل على السيرفر بعد");
      return;
    }

    const botId = providers.telegram.bot_id;
    setBusy(true);

    // Mobile browsers block popups — use full redirect (opens Telegram app).
    if (isMobile()) {
      redirectToTelegramOAuth(botId);
      return;
    }

    try {
      await loadTelegramWidget();
      if (window.Telegram?.Login?.auth) {
        window.Telegram.Login.auth(
          { bot_id: Number(botId) || botId, request_access: "write" },
          async (user) => {
            if (!user) {
              setBusy(false);
              return;
            }
            try {
              await completeWithUser(user);
            } catch (err) {
              setError(err.response?.data?.detail || "فشل تسجيل تيليجرام");
              setBusy(false);
            }
          }
        );
        // Popup opened; keep busy until callback or user cancels (no cancel event).
        setTimeout(() => setBusy(false), 1500);
        return;
      }
    } catch {
      /* fall through to redirect */
    }

    redirectToTelegramOAuth(botId);
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
            d="M98 170c-4 0-3-1-5-5l-13-42 103-65"
            opacity=".2"
          />
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
