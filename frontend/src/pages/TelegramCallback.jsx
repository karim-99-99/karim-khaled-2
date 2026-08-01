import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";

/** Shared across StrictMode remounts so we don't abandon an in-flight login. */
const completedByState = new Map();
const inflightByState = new Map();

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
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let alive = true;

    async function applyTokens(tokens) {
      await acceptTokens({
        access: tokens.access || tokens.access_token,
        refresh: tokens.refresh,
        user: tokens.user,
      });
      if (!alive) return;
      setMessage("تم تسجيل الدخول بنجاح");
      navigate("/", { replace: true });
    }

    async function exchange(code, state) {
      if (completedByState.has(state)) {
        return completedByState.get(state);
      }
      if (inflightByState.has(state)) {
        return inflightByState.get(state);
      }
      const promise = client
        .post("/auth/telegram/complete/", { code, state })
        .then((res) => {
          completedByState.set(state, res.data);
          return res.data;
        })
        .finally(() => {
          // Keep completed map; drop inflight so a real retry can run after failure.
          inflightByState.delete(state);
        });
      inflightByState.set(state, promise);
      return promise;
    }

    async function finishLocally(code, state) {
      setFailed(false);
      setMessage("جاري إكمال تسجيل تيليجرام… قد يستغرق السيرفر حتى دقيقة");
      try {
        const tokens = await exchange(code, state);
        await applyTokens(tokens);
      } catch (err) {
        // Another mount may have succeeded meanwhile.
        if (localStorage.getItem("access")) {
          if (alive) navigate("/", { replace: true });
          return;
        }
        if (!alive) return;
        setFailed(true);
        setMessage(
          err.code === "ECONNABORTED"
            ? "انتهت مهلة السيرفر — أعد المحاولة"
            : err.response?.data?.detail ||
                err.response?.data?.error ||
                err.message ||
                "فشل إكمال تسجيل تيليجرام"
        );
      }
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error_description") || params.get("error");

    // Popup return: notify opener, but if opener doesn't finish, fall back locally.
    if (window.opener && !window.opener.closed && code && state) {
      window.opener.postMessage(
        { type: "TELEGRAM_LOGIN_SUCCESS", payload: { code, state } },
        window.location.origin
      );
      setMessage("تم التأكيد — جاري تسجيل الدخول…");
      // Always complete in this window too (opener may be gone / blocked).
      finishLocally(code, state).then(() => {
        try {
          window.close();
        } catch {
          /* ignore */
        }
      });
      return () => {
        alive = false;
      };
    }

    if (window.opener && !window.opener.closed && !code) {
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
      return () => {
        alive = false;
      };
    }

    if (code && state) {
      finishLocally(code, state);
    } else {
      setFailed(true);
      setMessage(error || "لا توجد بيانات تيليجرام");
    }

    return () => {
      alive = false;
    };
  }, [acceptTokens, navigate, retryKey]);

  function retry() {
    const params = new URLSearchParams(window.location.search);
    const state = params.get("state");
    if (state) {
      completedByState.delete(state);
      inflightByState.delete(state);
    }
    setRetryKey((k) => k + 1);
  }

  return (
    <div className="card form-card" style={{ textAlign: "center" }}>
      <div className="spinner" style={{ marginBottom: 12 }}>
        {message}
      </div>
      {failed && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={retry}>
            إعادة المحاولة
          </button>
          <Link to="/login" className="btn btn-secondary btn-sm">
            العودة لتسجيل الدخول
          </Link>
        </div>
      )}
    </div>
  );
}
