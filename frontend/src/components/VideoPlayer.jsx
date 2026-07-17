import { useEffect, useState } from "react";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";

/**
 * Requests a signed token from the backend, then renders the Bunny iframe.
 * A semi-transparent student-name overlay moves every few seconds to deter
 * screen-recording/sharing. When Bunny is not configured, shows a placeholder.
 */
export default function VideoPlayer({ bunnyId }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [pos, setPos] = useState({ top: "10%", left: "10%" });

  useEffect(() => {
    if (!bunnyId) return;
    setError("");
    setData(null);
    client
      .get(`/videos/${bunnyId}/token/`)
      .then((res) => setData(res.data))
      .catch((e) =>
        setError(e.response?.data?.detail || "تعذّر تحميل الفيديو"),
      );
  }, [bunnyId]);

  useEffect(() => {
    const id = setInterval(() => {
      setPos({
        top: `${10 + Math.random() * 70}%`,
        left: `${10 + Math.random() * 60}%`,
      });
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const watermark = user ? `${user.full_name} · ${user.phone}` : "";

  const frame = {
    position: "relative",
    width: "100%",
    aspectRatio: "16 / 9",
    background: "#0f172a",
    borderRadius: "var(--radius-md)",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
  };
  const overlay = {
    position: "absolute",
    top: pos.top,
    left: pos.left,
    color: "rgba(255,255,255,0.35)",
    fontSize: 14,
    fontWeight: 700,
    pointerEvents: "none",
    transition: "top 1s, left 1s",
    zIndex: 5,
  };

  if (error) return <div style={frame}>{error}</div>;

  return (
    <div style={frame}>
      {data?.configured && data?.embed_url ? (
        <iframe
          title="lesson-video"
          src={data.embed_url}
          allow="encrypted-media; fullscreen"
          style={{ width: "100%", height: "100%", border: 0 }}
        />
      ) : (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48 }}>▶</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 8 }}>
            {bunnyId
              ? "فيديو محمي عبر Bunny Stream (أضف مفاتيح Bunny لتشغيله)"
              : "لا يوجد فيديو"}
          </div>
        </div>
      )}
      {watermark && <div style={overlay}>{watermark}</div>}
    </div>
  );
}
