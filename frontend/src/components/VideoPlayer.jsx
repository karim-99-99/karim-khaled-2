import { useEffect, useState } from "react";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { resolveVideoSource } from "../utils/videoSource";

/**
 * Plays a lesson/question video from:
 * - Bunny Stream GUID (signed embed via API), or
 * - Any http(s) link: YouTube, Google Drive, direct mp4, other cloud.
 */
export default function VideoPlayer({ bunnyId, src }) {
  const { user } = useAuth();
  const raw = bunnyId || src || "";
  const resolved = resolveVideoSource(raw);

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [pos, setPos] = useState({ top: "10%", left: "10%" });

  useEffect(() => {
    if (resolved.kind !== "bunny") {
      setData(null);
      setError("");
      return;
    }
    setError("");
    setData(null);
    client
      .get(`/videos/${encodeURIComponent(resolved.src)}/token/`)
      .then((res) => setData(res.data))
      .catch((e) =>
        setError(e.response?.data?.detail || "تعذّر تحميل الفيديو"),
      );
  }, [resolved.kind, resolved.src]);

  useEffect(() => {
    const id = setInterval(() => {
      setPos({
        top: `${10 + Math.random() * 70}%`,
        left: `${10 + Math.random() * 60}%`,
      });
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const watermark = user ? `${user.full_name} · ${user.phone || "طالب"}` : "";

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

  if (resolved.kind === "empty") {
    return (
      <div style={frame}>
        <div style={{ textAlign: "center", opacity: 0.8 }}>لا يوجد فيديو</div>
      </div>
    );
  }

  if (error) return <div style={frame}>{error}</div>;

  if (resolved.kind === "file") {
    return (
      <div style={frame}>
        <video
          src={resolved.src}
          controls
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
        {watermark && <div style={overlay}>{watermark}</div>}
      </div>
    );
  }

  if (resolved.kind === "youtube" || resolved.kind === "drive" || resolved.kind === "link") {
    return (
      <div style={frame}>
        <iframe
          title="lesson-video"
          src={resolved.src}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          style={{ width: "100%", height: "100%", border: 0 }}
        />
        {resolved.kind === "link" && resolved.openUrl ? (
          <a
            href={resolved.openUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              position: "absolute",
              bottom: 10,
              left: 10,
              zIndex: 6,
              background: "rgba(15,23,42,0.85)",
              color: "#fff",
              padding: "6px 10px",
              borderRadius: 8,
              fontSize: 12,
              textDecoration: "none",
            }}
          >
            فتح الرابط ↗
          </a>
        ) : null}
        {watermark && <div style={overlay}>{watermark}</div>}
      </div>
    );
  }

  // Bunny Stream
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
            فيديو محمي عبر Bunny Stream (أضف مفاتيح Bunny لتشغيله)
          </div>
        </div>
      )}
      {watermark && <div style={overlay}>{watermark}</div>}
    </div>
  );
}
