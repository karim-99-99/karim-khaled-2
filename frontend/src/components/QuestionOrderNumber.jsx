import { useEffect, useState } from "react";

/**
 * Editable 1-based position for a question (ترقيم بدل أسهم).
 * Enter / blur commits the new position.
 */
export default function QuestionOrderNumber({
  value,
  max,
  disabled = false,
  onCommit,
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit() {
    const n = Number.parseInt(String(draft).trim(), 10);
    if (!Number.isFinite(n) || n < 1 || n > max) {
      setDraft(String(value));
      return;
    }
    if (n === value) return;
    onCommit?.(n);
  }

  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 13,
        color: "var(--text-muted)",
      }}
      title="غيّر الرقم ثم Enter لإعادة الترتيب"
    >
      #
      <input
        className="form-control"
        type="number"
        min={1}
        max={max}
        disabled={disabled}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        style={{ width: 56, padding: "4px 6px", textAlign: "center" }}
        aria-label="ترتيب السؤال"
      />
      / {max}
    </label>
  );
}
