import { useRef, useState } from "react";

/**
 * Text editor with a collapsible math-symbol toolbar.
 * Click "الرموز الرياضية" to expand; symbols insert as Unicode into the text.
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
    title: "أسس",
    items: ["²", "³", "⁴", "⁵", "ⁿ", "½", "⅓", "¼", "¾"],
  },
  {
    title: "جذور ورموز",
    items: ["√", "∛", "∜", "π", "θ", "α", "β", "Δ", "°", "∞"],
  },
  {
    title: "تفاضل وتكامل",
    items: ["∑", "∏", "∫", "∂", "∇", "→", "∴", "∵"],
  },
];

export default function EquationEditor({ value, onChange, placeholder, rows = 3 }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);

  function insert(sym) {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + sym + value.slice(end);
    onChange(next);
    setTimeout(() => {
      el?.focus();
      if (el) el.selectionStart = el.selectionEnd = start + sym.length;
    }, 0);
  }

  return (
    <div>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        style={{ marginBottom: 8 }}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "إخفاء الرموز الرياضية ▴" : "الرموز الرياضية ▾"}
      </button>

      {open && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            marginBottom: 8,
            padding: 10,
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--bg-muted, #f8fafc)",
          }}
        >
          {GROUPS.map((g) => (
            <div key={g.title} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 64 }}>
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

      <textarea
        ref={ref}
        className="form-control"
        rows={rows}
        value={value}
        placeholder={placeholder || "اكتب السؤال… واضغط «الرموز الرياضية» لإدراج الرموز"}
        onChange={(e) => onChange(e.target.value)}
        style={{ fontSize: 16 }}
      />
    </div>
  );
}
