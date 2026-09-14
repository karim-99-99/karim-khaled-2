import { useRef, useState } from "react";
import MathText from "./MathText";
import VisualMathField from "./VisualMathField";
import { parseTextDirection } from "../utils/textDirection";

/**
 * Equation editor: Arabic text + rendered roots/exponents (LTR chips = same as preview).
 */
const GROUPS = [
  {
    title: "عمليات",
    items: ["+", "−", "×", "÷", "=", "≠", "±", "∓", "·"],
  },
  {
    title: "مقارنات",
    items: ["<", ">", "≤", "≥", "≈", "≡", "∝"],
  },
  {
    title: "كسور سريعة",
    items: ["½", "⅓", "¼", "¾"],
  },
  {
    title: "رموز",
    items: ["π", "θ", "α", "β", "Δ", "°", "∞", "∑", "∏", "∫", "∂", "∇", "→", "←", "∴", "∵"],
  },
];

function escapeLatexText(s) {
  return String(s ?? "").replace(/[{}]/g, "\\$&");
}

function toMathBody(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  if (/[\\{}^_]/.test(t) || /^[0-9a-zA-Z+\-*/().=<>\s]+$/.test(t)) {
    return t.replace(/\s+/g, " ");
  }
  return `\\text{${escapeLatexText(t)}}`;
}

export default function EquationEditor({ value, onChange, placeholder, rows = 3 }) {
  const fieldApi = useRef(null);
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState(null);
  const [base, setBase] = useState("");
  const [exponent, setExponent] = useState("");
  const [radicand, setRadicand] = useState("");
  const [rootIndex, setRootIndex] = useState("2");
  const [msg, setMsg] = useState("");
  const { body } = parseTextDirection(value);

  function insert(sym) {
    fieldApi.current?.insertText(sym);
    fieldApi.current?.focus();
  }

  function openPowerPanel() {
    const selected = fieldApi.current?.getSelectedText?.() || "";
    setBase(selected || "");
    setExponent("");
    setPanel("power");
    setOpen(true);
    setMsg("");
  }

  function openRootPanel() {
    const selected = fieldApi.current?.getSelectedText?.() || "";
    setRadicand(selected || "");
    setRootIndex("2");
    setPanel("root");
    setOpen(true);
    setMsg("");
  }

  function applyPower() {
    const b = base.trim();
    const e = exponent.trim();
    if (!b || !e) return;
    const tex = `${toMathBody(b)}^{${toMathBody(e)}}`;
    fieldApi.current?.insertMath(tex);
    fieldApi.current?.focus();
    setPanel(null);
    setBase("");
    setExponent("");
    setMsg("");
  }

  function applyRoot() {
    const inside = radicand.trim();
    if (!inside) return;
    const idx = String(rootIndex || "2").trim();
    const inner = toMathBody(inside);
    const tex =
      !idx || idx === "2"
        ? `\\sqrt{${inner}}`
        : `\\sqrt[${toMathBody(idx)}]{${inner}}`;
    fieldApi.current?.insertMath(tex);
    fieldApi.current?.focus();
    setPanel(null);
    setRadicand("");
    setRootIndex("2");
    setMsg("");
  }

  function toggleExponentSide() {
    const res = fieldApi.current?.toggleExponentSide?.();
    if (!res?.ok) {
      if (res?.reason === "not-power") {
        setMsg("حدّد معادلة أس (اضغط عليها داخل النص) ثم جرّب مرة أخرى");
      } else {
        setMsg("أدرج أس أولاً، أو اضغط على الأس داخل النص لتحديده");
      }
      return;
    }
    setMsg("تم تحريك جهة الأس");
    setTimeout(() => setMsg(""), 1500);
  }

  const powerPreview =
    base.trim() && exponent.trim()
      ? `$${toMathBody(base.trim())}^{${toMathBody(exponent.trim())}}$`
      : "";
  const rootPreview = (() => {
    if (!radicand.trim()) return "";
    const inner = toMathBody(radicand.trim());
    const idx = String(rootIndex || "2").trim();
    const tex =
      !idx || idx === "2" ? `\\sqrt{${inner}}` : `\\sqrt[${toMathBody(idx)}]{${inner}}`;
    return `$${tex}$`;
  })();

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 8,
          alignItems: "center",
        }}
      >
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "إخفاء الرموز الرياضية ▴" : "الرموز الرياضية ▾"}
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={openPowerPanel}>
          أس ⁿ
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={openRootPanel}>
          جذر √
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={toggleExponentSide}
          title="انقل الأس يميناً أو يساراً بالنسبة للأساس"
        >
          جهة الأس ⇄
        </button>
      </div>
      {msg && (
        <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "0 0 8px" }}>{msg}</p>
      )}

      {open && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 8,
            padding: 10,
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--bg-muted, #f8fafc)",
          }}
        >
          {GROUPS.map((g) => (
            <div key={g.title} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 72 }}>
                {g.title}
              </span>
              {g.items.map((sym) => (
                <button
                  type="button"
                  key={sym}
                  className="toolbar-btn"
                  onClick={() => insert(sym)}
                >
                  {sym}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {panel === "power" && (
        <div
          className="card"
          style={{ padding: 12, marginBottom: 8, border: "1px solid var(--border)" }}
        >
          <div className="section-title" style={{ marginTop: 0, fontSize: 15 }}>
            إضافة أس (أي قيمة)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>الأساس</label>
              <input
                className="form-control"
                value={base}
                onChange={(e) => setBase(e.target.value)}
                placeholder="مثال: x أو 2 أو (a+b)"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>الأس</label>
              <input
                className="form-control"
                value={exponent}
                onChange={(e) => setExponent(e.target.value)}
                placeholder="مثال: 2 أو n أو -1 أو 1/2"
              />
            </div>
          </div>
          {powerPreview && (
            <div style={{ marginTop: 10, fontSize: 22 }} dir="ltr">
              معاينة: <MathText>{powerPreview}</MathText>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={applyPower}
              disabled={!base.trim() || !exponent.trim()}
            >
              إدراج الأس في النص
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPanel(null)}>
              إلغاء
            </button>
          </div>
        </div>
      )}

      {panel === "root" && (
        <div
          className="card"
          style={{ padding: 12, marginBottom: 8, border: "1px solid var(--border)" }}
        >
          <div className="section-title" style={{ marginTop: 0, fontSize: 15 }}>
            إضافة جذر (الأرقام داخل الجذر)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 10 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>دليل الجذر</label>
              <input
                className="form-control"
                value={rootIndex}
                onChange={(e) => setRootIndex(e.target.value)}
                placeholder="2"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>ما تحت الجذر</label>
              <input
                className="form-control"
                value={radicand}
                onChange={(e) => setRadicand(e.target.value)}
                placeholder="مثال: 16 أو x+1 أو 9/4"
              />
            </div>
          </div>
          {rootPreview && (
            <div style={{ marginTop: 10, fontSize: 24 }} dir="ltr">
              معاينة: <MathText>{rootPreview}</MathText>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={applyRoot}
              disabled={!radicand.trim()}
            >
              إدراج الجذر في النص
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRootIndex("2")}>
              تربيعي
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRootIndex("3")}>
              تكعيبي
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPanel(null)}>
              إلغاء
            </button>
          </div>
        </div>
      )}

      <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
        تحرير النص — نفس شكل المعاينة. لنقل الأس: اضغط على المعادلة ثم «جهة الأس ⇄»
      </label>
      <VisualMathField
        value={body}
        onChange={onChange}
        placeholder={placeholder}
        minRows={rows}
        onReady={(api) => {
          fieldApi.current = api;
        }}
      />
    </div>
  );
}
