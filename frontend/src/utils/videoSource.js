/**
 * Resolve teacher-entered video values: Bunny GUID or any http(s) link
 * (YouTube, Google Drive, direct mp4, other cloud).
 */

export function isExternalVideoUrl(value) {
  const s = String(value || "").trim();
  return /^https?:\/\//i.test(s);
}

function youtubeId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return u.pathname.split("/").filter(Boolean)[0] || null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname.startsWith("/embed/")) {
        return u.pathname.split("/")[2] || null;
      }
      if (u.pathname.startsWith("/shorts/")) {
        return u.pathname.split("/")[2] || null;
      }
      if (u.pathname.startsWith("/live/")) {
        return u.pathname.split("/")[2] || null;
      }
      return u.searchParams.get("v");
    }
  } catch {
    /* ignore */
  }
  return null;
}

function driveFileId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (!host.includes("drive.google.com") && !host.includes("docs.google.com")) {
      return null;
    }
    const m = u.pathname.match(/\/file\/d\/([^/]+)/);
    if (m) return m[1];
    return u.searchParams.get("id");
  } catch {
    return null;
  }
}

function isDirectVideoFile(url) {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(path);
  } catch {
    return false;
  }
}

/**
 * @returns {{ kind: 'empty'|'bunny'|'youtube'|'drive'|'file'|'link', src?: string, openUrl?: string }}
 */
export function resolveVideoSource(raw) {
  const value = String(raw || "").trim();
  if (!value) return { kind: "empty" };

  if (!isExternalVideoUrl(value)) {
    return { kind: "bunny", src: value };
  }

  const yt = youtubeId(value);
  if (yt) {
    return {
      kind: "youtube",
      src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt)}?rel=0`,
      openUrl: value,
    };
  }

  const drive = driveFileId(value);
  if (drive) {
    return {
      kind: "drive",
      src: `https://drive.google.com/file/d/${encodeURIComponent(drive)}/preview`,
      openUrl: value,
    };
  }

  if (isDirectVideoFile(value)) {
    return { kind: "file", src: value, openUrl: value };
  }

  // Any other cloud / page URL — try iframe embed + open link fallback.
  return { kind: "link", src: value, openUrl: value };
}
