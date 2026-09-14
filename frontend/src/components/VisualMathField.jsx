import { useEffect, useLayoutEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { parseTextDirection, withTextDirection } from "../utils/textDirection";

/** Right-side power: base^{exp}  |  Left-side power: {}^{exp}base */
const POWER_RIGHT_RE = /^([\s\S]+)\^\{([\s\S]+)\}$/;
const POWER_LEFT_RE = /^\{\}\^\{([\s\S]+)\}([\s\S]+)$/;

export function flipPowerSide(tex) {
  const t = String(tex ?? "").trim();
  let m = t.match(POWER_LEFT_RE);
  if (m) return `${m[2]}^{${m[1]}}`;
  m = t.match(POWER_RIGHT_RE);
  if (m) return `{}^{${m[2]}}${m[1]}`;
  return null;
}

export function isPowerTex(tex) {
  const t = String(tex ?? "").trim();
  return POWER_RIGHT_RE.test(t) || POWER_LEFT_RE.test(t);
}

function renderTexHtml(tex) {
  try {
    return katex.renderToString(tex, {
      throwOnError: false,
      output: "html",
      strict: "ignore",
    });
  } catch {
    return null;
  }
}

function paintChip(chip, tex) {
  chip.dataset.tex = tex;
  chip.setAttribute("data-tex", tex);
  chip.setAttribute("dir", "ltr");
  chip.style.unicodeBidi = "isolate";
  const html = renderTexHtml(tex);
  if (html) chip.innerHTML = html;
  else chip.textContent = `$${tex}$`;
}

function createMathChip(tex) {
  const chip = document.createElement("span");
  chip.className = "eq-math-chip";
  chip.contentEditable = "false";
  paintChip(chip, tex);
  return chip;
}

function clearChipSelection(editor) {
  editor?.querySelectorAll(".eq-math-chip.is-selected").forEach((c) => {
    c.classList.remove("is-selected");
  });
}

function selectChip(editor, chip) {
  clearChipSelection(editor);
  chip?.classList.add("is-selected");
}

/** Build editor DOM from stored string (plain + $tex$). */
export function fillEditorFromValue(editor, raw) {
  const { body } = parseTextDirection(raw);
  editor.innerHTML = "";
  if (!body) return;
  const parts = String(body).split(/(\$[^$]*\$)/g);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith("$") && part.endsWith("$") && part.length > 1) {
      editor.appendChild(createMathChip(part.slice(1, -1)));
    } else {
      editor.appendChild(document.createTextNode(part));
    }
  }
}

/** Serialize editor DOM back to stored string. */
export function serializeEditor(editor) {
  let out = "";
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.nodeValue || "";
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node;
    if (el.classList?.contains("eq-math-chip")) {
      const tex = el.getAttribute("data-tex") || el.dataset.tex || "";
      out += `$${tex}$`;
      return;
    }
    if (el.tagName === "BR") {
      out += "\n";
      return;
    }
    if (el.tagName === "DIV" || el.tagName === "P") {
      if (out && !out.endsWith("\n")) out += "\n";
    }
    for (const child of el.childNodes) walk(child);
  };
  for (const child of editor.childNodes) walk(child);
  return withTextDirection(out.replace(/\u00a0/g, " ").replace(/\u200B/g, ""));
}

function placeCaretAtEnd(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function insertNodeAtCaret(editor, node) {
  editor.focus();
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !editor.contains(sel.anchorNode)) {
    editor.appendChild(node);
    const zws = document.createTextNode("\u200B");
    editor.appendChild(zws);
    placeCaretAtEnd(editor);
    return;
  }
  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(node);
  const zws = document.createTextNode("\u200B");
  node.after(zws);
  range.setStartAfter(zws);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Visual rich editor: Arabic text + KaTeX chips forced LTR (same as preview).
 */
export default function VisualMathField({
  value,
  onChange,
  placeholder,
  minRows = 3,
  onReady,
}) {
  const editorRef = useRef(null);
  const lastEmitted = useRef(null);
  const readyRef = useRef(false);

  function emit() {
    const editor = editorRef.current;
    if (!editor) return;
    const next = serializeEditor(editor);
    lastEmitted.current = next;
    onChange?.(next);
  }

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const normalized = withTextDirection(parseTextDirection(value).body);
    if (normalized === lastEmitted.current && readyRef.current) return;
    fillEditorFromValue(editor, value);
    lastEmitted.current = normalized;
    readyRef.current = true;
  }, [value]);

  useEffect(() => {
    if (!onReady) return undefined;
    const api = {
      focus: () => editorRef.current?.focus(),
      insertText: (text) => {
        const editor = editorRef.current;
        if (!editor) return;
        insertNodeAtCaret(editor, document.createTextNode(text));
        emit();
      },
      insertMath: (tex) => {
        const editor = editorRef.current;
        if (!editor) return;
        const chip = createMathChip(tex);
        insertNodeAtCaret(editor, chip);
        selectChip(editor, chip);
        emit();
      },
      getSelectedText: () => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return "";
        const editor = editorRef.current;
        if (!editor || !editor.contains(sel.anchorNode)) return "";
        return sel.toString();
      },
      /** Flip last/selected power between right and left superscript. */
      toggleExponentSide: () => {
        const editor = editorRef.current;
        if (!editor) return { ok: false, reason: "empty" };
        const selected =
          editor.querySelector(".eq-math-chip.is-selected") ||
          [...editor.querySelectorAll(".eq-math-chip")].filter((c) =>
            isPowerTex(c.dataset.tex || "")
          ).at(-1);
        if (!selected) return { ok: false, reason: "no-math" };
        const tex = selected.dataset.tex || "";
        const flipped = flipPowerSide(tex);
        if (!flipped) return { ok: false, reason: "not-power" };
        paintChip(selected, flipped);
        selectChip(editor, selected);
        emit();
        return { ok: true, tex: flipped };
      },
    };
    onReady(api);
    return () => onReady(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onInput() {
    emit();
  }

  function onPaste(e) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    insertNodeAtCaret(editorRef.current, document.createTextNode(text));
    emit();
  }

  function onKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      insertNodeAtCaret(editorRef.current, document.createElement("br"));
      emit();
    }
  }

  function onClick(e) {
    const editor = editorRef.current;
    if (!editor) return;
    const chip = e.target.closest?.(".eq-math-chip");
    if (chip && editor.contains(chip)) {
      selectChip(editor, chip);
    } else {
      clearChipSelection(editor);
    }
  }

  const minHeight = Math.max(3, minRows) * 28;

  return (
    <div
      className="eq-visual-wrap"
      data-empty={!parseTextDirection(value).body.trim() ? "1" : "0"}
    >
      <div
        ref={editorRef}
        className="eq-visual-editor form-control"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder || "تحرير السؤال"}
        data-placeholder={placeholder || "اكتب السؤال هنا… الجذر والأس يظهران بالشكل الرياضي مباشرة"}
        onInput={onInput}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        onClick={onClick}
        style={{ minHeight }}
      />
    </div>
  );
}
