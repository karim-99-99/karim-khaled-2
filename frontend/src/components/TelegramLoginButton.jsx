import { useEffect, useRef, useState } from "react";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";

function prefersFullPageOAuth() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const mobileUA =
    /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
  const narrow = window.matchMedia?.("(max-width: 900px)")?.matches;
  return mobileUA || Boolean(coarse && narrow);
}

/**
 * Desktop: Hadafak-style popup + postMessage.
 * Mobile: full-page redirect (popups are blocked / lose opener).
 */
export default function TelegramLoginButton({ onSuccess, label = "تسجيل عبر تيليجرام" }) {
  const { acceptTokens } = useAuth();
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const popupRef = useRef(null);

  useEffect(() => {
    client
      .get("/auth/telegram/status/")
      .then((res) => setEnabled(Boolean(res.data?.enabled)))
      .catch(() => setEnabled(true));
  }, []);

  useEffect(() => {
    function onMessage(event) {
      if (event.origin !== window.location.origin) return;
      const data = event.data || {};
      if (data.type === "TELEGRAM_LOGIN_SUCCESS") {
        const { code, state } = data.payload || {};
        if (!code || !state) {
          setError("بيانات تيليجرام غير مكتملة");
          setBusy(false);
          return;
        }
        (async () => {
          try {
            const { data: tokens } = await client.post("/auth/telegram/complete/", {
              code,
              state,
            });
            await acceptTokens({
              access: tokens.access || tokens.access_token,
              refresh: tokens.refresh,
              user: tokens.user,
            });
            onSuccess?.(tokens.user);
          } catch (err) {
            setError(err.response?.data?.detail || "فشل تسجيل تيليجرام");
          } finally {
            setBusy(false);
          }
        })();
      } else if (data.type === "TELEGRAM_LOGIN_ERROR") {
        setError(data.error || "تم إلغاء تسجيل تيليجرام");
        setBusy(false);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [acceptTokens, onSuccess]);

  async function start() {
    setError("");
    setBusy(true);
    try {
      const redirectUri = `${window.location.origin}/auth/telegram/callback`;
      const { data } = await client.post("/auth/telegram/start/", {
        redirect_uri: redirectUri,
      });
      if (!data?.success || !data?.url) {
        setError(data?.error || "تعذّر بدء تسجيل تيليجرام");
        setBusy(false);
        return;
      }

      const oauthUrl = String(data.url).replace("&embed=1", "");

      // Mobile / tablet: navigate in the same tab (popup + opener break on phones).
      if (prefersFullPageOAuth()) {
        window.location.assign(oauthUrl);
        return;
      }

      const w = 600;
      const h = 700;
      const left = window.screen.width / 2 - w / 2;
      const top = window.screen.height / 2 - h / 2;
      const popup = window.open(
        oauthUrl,
        "TelegramOAuth",
        `width=${w},height=${h},top=${top},left=${left},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      );
      popupRef.current = popup;

      // Popup blocked → same-tab fallback (also common on some desktop browsers).
      if (!popup || popup.closed) {
        window.location.assign(oauthUrl);
        return;
      }

      const timer = setInterval(() => {
        const p = popupRef.current;
        if (!p || p.closed) {
          clearInterval(timer);
          setBusy(false);
        }
      }, 500);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || "تعذّر فتح تيليجرام");
      setBusy(false);
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        type="button"
        className="btn btn-block"
        onClick={start}
        disabled={busy || !enabled}
        style={{
          background: "#4aa4ff",
          color: "#fff",
          border: "none",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          opacity: !enabled ? 0.55 : 1,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.892-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
        {busy ? "جاري فتح تيليجرام…" : label}
      </button>
      {!enabled && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", marginTop: 8 }}>
          أضف مفاتيح تيليجرام في Render (TELEGRAM_BOT_TOKEN / CLIENT_SECRET)
        </p>
      )}
      {error && <div className="error-text" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}
