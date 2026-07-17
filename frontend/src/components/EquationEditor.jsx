import { useRef } from "react";

/**
 * A text editor with a math-symbol toolbar. Clicking a button inserts the REAL
 * symbol (Unicode) directly into the text — the teacher sees "×", "√", "≤",
 * "س²" as they are, never LaTeX like \times or x^{2}.
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

  function insert(sym) {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + sym + value.slice(end);
    onChange(next);
    setTimeout(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + sym.length;
    }, 0);
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
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
      <textarea
        ref={ref}
        className="form-control"
        rows={rows}
        value={value}
        placeholder={placeholder || "اكتب السؤال… واضغط الأزرار لإدراج الرموز الرياضية"}
        onChange={(e) => onChange(e.target.value)}
        style={{ fontSize: 16 }}
      />
    </div>
  );
}
