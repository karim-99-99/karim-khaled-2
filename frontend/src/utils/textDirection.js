const DIR_RE = /^\[\[(ltr|rtl)\]\]\s*/i;
const LEGACY_MIRROR_RE = /\[\[m\]\]([\s\S]*?)\[\[\/m\]\]/g;

/** Strip legacy direction / mirror markers; body is always plain text. */
export function parseTextDirection(raw) {
  const text = String(raw ?? "").replace(LEGACY_MIRROR_RE, "$1");
  const m = text.match(DIR_RE);
  if (!m) return { dir: "rtl", body: text };
  return { dir: "rtl", body: text.slice(m[0].length) };
}

export function withTextDirection(body) {
  return String(body ?? "")
    .replace(DIR_RE, "")
    .replace(LEGACY_MIRROR_RE, "$1");
}
