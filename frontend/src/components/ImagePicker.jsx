import { useEffect, useRef, useState } from "react";

const MAX_BYTES = 1.5 * 1024 * 1024;
const MAX_SIDE = 1600;
const HISTORY_LIMIT = 20;

function readAsDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Downscale big images (e.g. pasted screenshots) so they fit the size limit. */
async function fileToDataURL(file) {
  const original = await readAsDataURL(file);
  const img = await loadImage(original);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  if (file.size <= MAX_BYTES && scale === 1) return original;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  const keepPng = file.type === "image/png" && file.size <= MAX_BYTES;
  if (!keepPng) {
    // JPEG has no transparency — paint white so transparent areas don't turn black.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const out = keepPng ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.85);
  if (out.length * 0.75 > MAX_BYTES) {
    throw new Error("too-big");
  }
  return out;
}

/** Clipboard API only accepts PNG images, so re-encode whatever we stored. */
async function dataURLToPngBlob(src) {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext("2d").drawImage(img, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/**
 * Image field stored as a data-URL.
 * Upload a file, paste with Ctrl+V, drag & drop, copy with Ctrl+C, undo with Ctrl+Z.
 */
export default function ImagePicker({ value, onChange, label = "صورة", apiRef }) {
  const historyRef = useRef([]);
  const lastSetRef = useRef(value);
  const hintTimerRef = useRef(null);
  const [historySize, setHistorySize] = useState(0);
  const [hint, setHint] = useState("");
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);

  // A new question / form reset replaces the value from outside — old undo steps no longer apply.
  useEffect(() => {
    if (value !== lastSetRef.current) {
      historyRef.current = [];
      setHistorySize(0);
      lastSetRef.current = value;
    }
  }, [value]);

  function flash(text) {
    setHint(text);
    window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => setHint(""), 2500);
  }

  useEffect(() => () => window.clearTimeout(hintTimerRef.current), []);

  function commit(next) {
    if (next === value) return;
    historyRef.current = [...historyRef.current, value || ""].slice(-HISTORY_LIMIT);
    setHistorySize(historyRef.current.length);
    lastSetRef.current = next;
    onChange(next);
  }

  function undo() {
    if (!historyRef.current.length) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    setHistorySize(historyRef.current.length);
    lastSetRef.current = prev;
    onChange(prev);
    flash("تم التراجع ✓");
  }

  async function applyFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      flash("الملف ليس صورة");
      return;
    }
    try {
      commit(await fileToDataURL(file));
      flash("تمت إضافة الصورة ✓");
    } catch {
      flash("الصورة كبيرة جداً — جرّب صورة أصغر");
    }
  }

  // Lets a sibling text field paste an image here and undo it (keeps one shared history).
  useEffect(() => {
    if (!apiRef) return undefined;
    apiRef.current = { applyFile, undo, canUndo: () => historyRef.current.length > 0 };
    return () => {
      apiRef.current = null;
    };
  });

  function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    applyFile(file);
  }

  function onPaste(e) {
    const item = [...(e.clipboardData?.items || [])].find((it) => it.type.startsWith("image/"));
    if (!item) {
      flash("لا توجد صورة في الحافظة — انسخ صورة أولاً (Ctrl+C)");
      return;
    }
    e.preventDefault();
    applyFile(item.getAsFile());
  }

  async function copyImage() {
    if (!value) return;
    try {
      const blob = await dataURLToPngBlob(value);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      flash("تم نسخ الصورة ✓ — الصقها في أي خانة صورة بـ Ctrl+V");
    } catch {
      flash("المتصفح لم يسمح بنسخ الصورة");
    }
  }

  function onKeyDown(e) {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) {
      if ((e.key === "Delete" || e.key === "Backspace") && value) {
        e.preventDefault();
        commit("");
      }
      return;
    }
    const key = e.key.toLowerCase();
    if (key === "z" && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if (key === "c" && value) {
      e.preventDefault();
      copyImage();
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    applyFile(e.dataTransfer?.files?.[0]);
  }

  return (
    <div style={{ marginTop: 6, marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer", margin: 0 }}>
          {value ? `تغيير ${label}` : `إضافة ${label}`}
          <input type="file" accept="image/*" hidden onChange={onFile} />
        </label>
        {value && (
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={copyImage}>
              نسخ الصورة
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => commit("")}>
              حذف الصورة
            </button>
          </>
        )}
        {historySize > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={undo}>
            ↶ تراجع
          </button>
        )}
      </div>

      <div
        tabIndex={0}
        role="button"
        aria-label={`${label}: الصق صورة بـ Ctrl+V`}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          marginTop: 8,
          padding: value ? 6 : "10px 12px",
          border: `2px dashed ${focused || dragging ? "var(--primary, #2563eb)" : "var(--border, #d1d5db)"}`,
          borderRadius: 8,
          background: focused || dragging ? "rgba(37, 99, 235, 0.05)" : "transparent",
          color: "var(--text-muted)",
          fontSize: 13,
          cursor: "text",
          outline: "none",
          display: "inline-block",
          maxWidth: "100%",
        }}
      >
        {value ? (
          <img
            src={value}
            alt=""
            style={{ display: "block", maxWidth: "100%", maxHeight: 180, borderRadius: 6 }}
          />
        ) : (
          <span>
            {focused
              ? "اضغط Ctrl+V الآن للصق الصورة"
              : "اضغط هنا ثم Ctrl+V للصق صورة منسوخة — أو اسحبها وأفلتها هنا"}
          </span>
        )}
      </div>
      {(hint || (value && focused)) && (
        <div style={{ fontSize: 12, marginTop: 4, color: "var(--text-muted)" }}>
          {hint || "Ctrl+C نسخ · Ctrl+V استبدال · Ctrl+Z تراجع · Delete حذف"}
        </div>
      )}
    </div>
  );
}
