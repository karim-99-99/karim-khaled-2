"""
استيراد أسئلة التجميعات من ملف Word (.docx) أو ملف نصي (.txt).

صيغة الملف (كل سؤال أسفل الآخر، سطر فارغ بين كل سؤال والذي يليه):

    س: نص السؤال — يدعم العربية والمعادلات بين $...$
    أ) الخيار الأول
    ب) الخيار الثاني *        ← النجمة تحدد الإجابة الصحيحة
    ج) الخيار الثالث
    د) الخيار الرابع
    الإجابة: ب                ← بديل عن النجمة (اختياري)
    السنة: 1446               ← اختياري
    الصعوبة: سهل              ← اختياري (سهل / متوسط / صعب)
    الشرح: تعليل الإجابة       ← اختياري
    فيديو: https://...        ← اختياري

قواعد النواقص (تُطبّق افتراضات ويُعلَّم السؤال «بحاجة لمراجعة»):
  - لا إجابة صحيحة → افتراضي «أ» + مراجعة
  - صعوبة مفقودة → «متوسط» (بدون مراجعة) — قيمة غير مفهومة → «متوسط» + مراجعة
  - سنة مفقودة → تُترك فارغة
  - أقل من خيارين أو نص سؤال فارغ → يُرفض السطر ويظهر في تقرير الأخطاء

معادلات Word: المعادلات المكتوبة بمحرر معادلات Word (OMML) تُحوَّل تلقائياً
إلى LaTeX داخل $...$ حتى تُعرض بـ KaTeX في الموقع.
"""

import re
import zipfile
import xml.etree.ElementTree as ET

MAX_QUESTIONS = 500
OPTION_KEYS = ["أ", "ب", "ج", "د", "هـ", "و"]

W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
M_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/math}"


# ---------------------------------------------------------------------------
# OMML (Word equations) → LaTeX
# ---------------------------------------------------------------------------

_NARY_MAP = {
    "∑": r"\sum",
    "∏": r"\prod",
    "∫": r"\int",
    "∬": r"\iint",
    "∭": r"\iiint",
    "∮": r"\oint",
    "⋃": r"\bigcup",
    "⋂": r"\bigcap",
}

_CHAR_MAP = {
    "π": r"\pi ",
    "θ": r"\theta ",
    "α": r"\alpha ",
    "β": r"\beta ",
    "γ": r"\gamma ",
    "δ": r"\delta ",
    "λ": r"\lambda ",
    "μ": r"\mu ",
    "σ": r"\sigma ",
    "ω": r"\omega ",
    "Δ": r"\Delta ",
    "Ω": r"\Omega ",
    "∞": r"\infty ",
    "≤": r"\le ",
    "≥": r"\ge ",
    "≠": r"\ne ",
    "±": r"\pm ",
    "×": r"\times ",
    "÷": r"\div ",
    "√": r"\sqrt{}",
    "→": r"\rightarrow ",
    "∈": r"\in ",
    "≈": r"\approx ",
}


def _m(tag):
    return f"{M_NS}{tag}"


def _omml_children_latex(element):
    return "".join(_omml_to_latex(child) for child in element)


def _omml_first(element, tag):
    for child in element:
        if child.tag == _m(tag):
            return child
    return None


def _omml_to_latex(el):  # noqa: C901 — one dispatch table, kept flat on purpose
    """Recursively convert an OMML element to a LaTeX string (best effort)."""
    tag = el.tag
    if tag == _m("t"):
        text = el.text or ""
        return "".join(_CHAR_MAP.get(ch, ch) for ch in text)
    if tag == _m("r"):
        return _omml_children_latex(el)
    if tag == _m("f"):  # fraction
        num = _omml_first(el, "num")
        den = _omml_first(el, "den")
        return (
            "\\frac{" + (_omml_children_latex(num) if num is not None else "") + "}{"
            + (_omml_children_latex(den) if den is not None else "") + "}"
        )
    if tag == _m("sSup"):
        base = _omml_first(el, "e")
        sup = _omml_first(el, "sup")
        return (
            "{" + (_omml_children_latex(base) if base is not None else "") + "}^{"
            + (_omml_children_latex(sup) if sup is not None else "") + "}"
        )
    if tag == _m("sSub"):
        base = _omml_first(el, "e")
        sub = _omml_first(el, "sub")
        return (
            "{" + (_omml_children_latex(base) if base is not None else "") + "}_{"
            + (_omml_children_latex(sub) if sub is not None else "") + "}"
        )
    if tag == _m("sSubSup"):
        base = _omml_first(el, "e")
        sub = _omml_first(el, "sub")
        sup = _omml_first(el, "sup")
        return (
            "{" + (_omml_children_latex(base) if base is not None else "") + "}_{"
            + (_omml_children_latex(sub) if sub is not None else "") + "}^{"
            + (_omml_children_latex(sup) if sup is not None else "") + "}"
        )
    if tag == _m("rad"):  # radical
        deg = _omml_first(el, "deg")
        base = _omml_first(el, "e")
        deg_tex = _omml_children_latex(deg) if deg is not None else ""
        base_tex = _omml_children_latex(base) if base is not None else ""
        if deg_tex.strip():
            return "\\sqrt[" + deg_tex + "]{" + base_tex + "}"
        return "\\sqrt{" + base_tex + "}"
    if tag == _m("nary"):  # sum / integral / product ...
        pr = _omml_first(el, "naryPr")
        chr_val = ""
        if pr is not None:
            chr_el = _omml_first(pr, "chr")
            if chr_el is not None:
                chr_val = chr_el.get(f"{M_NS}val", "")
        op = _NARY_MAP.get(chr_val, r"\int" if not chr_val else chr_val)
        sub = _omml_first(el, "sub")
        sup = _omml_first(el, "sup")
        base = _omml_first(el, "e")
        out = op
        if sub is not None and len(sub):
            out += "_{" + _omml_children_latex(sub) + "}"
        if sup is not None and len(sup):
            out += "^{" + _omml_children_latex(sup) + "}"
        out += " " + (_omml_children_latex(base) if base is not None else "")
        return out
    if tag == _m("d"):  # delimiters (parentheses)
        pr = _omml_first(el, "dPr")
        open_ch, close_ch = "(", ")"
        if pr is not None:
            beg = _omml_first(pr, "begChr")
            end = _omml_first(pr, "endChr")
            if beg is not None:
                open_ch = beg.get(f"{M_NS}val", "(")
            if end is not None:
                close_ch = end.get(f"{M_NS}val", ")")
        inner = "".join(
            _omml_children_latex(child) for child in el if child.tag == _m("e")
        )
        return f"\\left{open_ch or '('}{inner}\\right{close_ch or ')'}"
    if tag == _m("func"):
        name = _omml_first(el, "fName")
        base = _omml_first(el, "e")
        return (
            (_omml_children_latex(name) if name is not None else "")
            + (_omml_children_latex(base) if base is not None else "")
        )
    if tag in (_m("limLow"), _m("limUpp")):
        base = _omml_first(el, "e")
        lim = _omml_first(el, "lim")
        joiner = "_" if tag == _m("limLow") else "^"
        return (
            (_omml_children_latex(base) if base is not None else "")
            + joiner + "{" + (_omml_children_latex(lim) if lim is not None else "") + "}"
        )
    if tag == _m("bar"):
        base = _omml_first(el, "e")
        return "\\overline{" + (_omml_children_latex(base) if base is not None else "") + "}"
    # Property containers carry no visible content.
    if tag.endswith("Pr"):
        return ""
    return _omml_children_latex(el)


# ---------------------------------------------------------------------------
# DOCX → plain text lines (math becomes $latex$)
# ---------------------------------------------------------------------------


def extract_docx_lines(file_obj):
    """
    Read a .docx and return its paragraphs as a list of text lines,
    with Word equations converted inline to $LaTeX$.
    """
    try:
        with zipfile.ZipFile(file_obj) as zf:
            xml_bytes = zf.read("word/document.xml")
    except (zipfile.BadZipFile, KeyError) as exc:
        raise ValueError("الملف ليس ملف Word صالحاً (.docx)") from exc

    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as exc:
        raise ValueError("تعذّر قراءة محتوى ملف Word") from exc

    lines = []
    for para in root.iter(f"{W_NS}p"):
        lines.append(_paragraph_text_with_math(para).strip())
    return lines


def _paragraph_text_with_math(para):
    """Walk direct children in order; math nodes render as $latex$."""
    parts = []

    def walk(node):
        if node.tag == _m("oMath") or node.tag == _m("oMathPara"):
            latex = _omml_to_latex(node).strip()
            if latex:
                parts.append(f" ${latex}$ ")
            return
        if node.tag == f"{W_NS}t":
            parts.append(node.text or "")
        if node.tag == f"{W_NS}tab":
            parts.append(" ")
        for child in node:
            walk(child)

    for child in para:
        walk(child)
    return "".join(parts)


def decode_txt(data: bytes):
    """Decode an uploaded .txt strictly as UTF-8 (with or without BOM)."""
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError(
            "ترميز الملف النصي غير مدعوم — احفظ الملف بترميز UTF-8"
        ) from exc


# ---------------------------------------------------------------------------
# Structured Arabic question format parser
# ---------------------------------------------------------------------------

_Q_START = re.compile(r"^\s*س(?:ؤال)?\s*\d*\s*[:：.\-\)]\s*(.*)$")
_OPTION = re.compile(r"^\s*([أاإبجدهـو]|[a-hA-H]|[١٢٣٤٥٦]|[1-6])\s*[\)\-.:\/؍]\s+?(.*)$")
_META = re.compile(
    r"^\s*(الإجابة الصحيحة|الاجابة الصحيحة|الإجابة|الاجابة|جواب|الجواب|"
    r"السنة|سنة|التاريخ|العام|الصعوبة|المستوى|المستوي|"
    r"الترشيح|ترشيح|ترشيح المدرس|ترشيحات المدرسين|"
    r"الشرح|شرح|التعليل|فيديو|الفيديو)\s*[:：]\s*(.*)$"
)

_DIFFICULTY_MAP = {
    "سهل": "easy",
    "سهلة": "easy",
    "easy": "easy",
    "متوسط": "medium",
    "متوسطة": "medium",
    "medium": "medium",
    "صعب": "hard",
    "صعبة": "hard",
    "hard": "hard",
}

_TIER_MAP = {
    "ذهبي": "gold",
    "gold": "gold",
    "فضي": "silver",
    "silver": "silver",
    "برونزي": "bronze",
    "bronze": "bronze",
}

_ANSWER_ALIASES = {
    "أ": 0, "ا": 0, "إ": 0, "a": 0, "1": 0, "١": 0,
    "ب": 1, "b": 1, "2": 1, "٢": 1,
    "ج": 2, "c": 2, "3": 2, "٣": 2,
    "د": 3, "d": 3, "4": 3, "٤": 3,
    "هـ": 4, "ه": 4, "e": 4, "5": 4, "٥": 4,
    "و": 5, "f": 5, "6": 5, "٦": 5,
}

_META_CANON = {
    "الإجابة الصحيحة": "answer",
    "الاجابة الصحيحة": "answer",
    "الإجابة": "answer",
    "الاجابة": "answer",
    "جواب": "answer",
    "الجواب": "answer",
    "السنة": "year",
    "سنة": "year",
    "التاريخ": "year",
    "العام": "year",
    "الصعوبة": "difficulty",
    "المستوى": "difficulty",
    "المستوي": "difficulty",
    "الشرح": "explanation",
    "شرح": "explanation",
    "التعليل": "explanation",
    "فيديو": "video",
    "الفيديو": "video",
    "الترشيح": "tier",
    "ترشيح": "tier",
    "ترشيح المدرس": "tier",
    "ترشيحات المدرسين": "tier",
}


def _answer_index(raw):
    val = str(raw or "").strip().strip("()").strip().lower()
    if not val:
        return None
    return _ANSWER_ALIASES.get(val)


def _new_block(line_no):
    return {
        "line": line_no,
        "text": "",
        "options": [],  # list of {"text": str, "starred": bool}
        "answer_raw": "",
        "year": "",
        "tier_raw": "",
        "difficulty_raw": "",
        "explanation": "",
        "video": "",
        "_last": "text",  # continuation target: text | option | explanation
    }


def parse_question_blocks(lines):
    """
    Parse text lines into question dicts + a rejected-rows error report.
    Returns (questions, errors) where each question is ready for model create.
    """
    blocks = []
    current = None

    for idx, raw in enumerate(lines, start=1):
        line = (raw or "").strip()
        if not line:
            if current is not None:
                blocks.append(current)
                current = None
            continue

        q_match = _Q_START.match(line)
        if q_match:
            if current is not None:
                blocks.append(current)
            current = _new_block(idx)
            current["text"] = q_match.group(1).strip()
            current["_last"] = "text"
            continue

        if current is None:
            # Anything before the first "س:" (instructions, headings) is skipped.
            continue

        meta = _META.match(line)
        if meta:
            key = _META_CANON.get(meta.group(1))
            value = meta.group(2).strip()
            if key == "answer":
                current["answer_raw"] = value
                current["_last"] = None
            elif key == "year":
                current["year"] = value[:20]
                current["_last"] = None
            elif key == "tier":
                current["tier_raw"] = value
                current["_last"] = None
            elif key == "difficulty":
                current["difficulty_raw"] = value
                current["_last"] = None
            elif key == "explanation":
                current["explanation"] = value
                current["_last"] = "explanation"
            elif key == "video":
                current["video"] = value[:500]
                current["_last"] = None
            continue

        opt = _OPTION.match(line)
        if opt:
            text = opt.group(2).strip()
            starred = "*" in text
            if starred:
                text = text.replace("*", "").strip()
            current["options"].append({"text": text, "starred": starred})
            current["_last"] = "option"
            continue

        # Continuation line — append to whatever field we were filling.
        target = current.get("_last")
        if target == "option" and current["options"]:
            starred = "*" in line
            extra = line.replace("*", "").strip() if starred else line
            current["options"][-1]["text"] = (
                current["options"][-1]["text"] + " " + extra
            ).strip()
            if starred:
                current["options"][-1]["starred"] = True
        elif target == "explanation":
            current["explanation"] = (current["explanation"] + " " + line).strip()
        elif target == "text":
            current["text"] = (current["text"] + " " + line).strip()
        # else: stray line after a one-line meta field — ignore.

    if current is not None:
        blocks.append(current)

    questions = []
    errors = []
    for block in blocks:
        result = _finalize_block(block)
        if result.get("rejected"):
            errors.append({"line": block["line"], "reason": result["reason"],
                           "text": (block.get("text") or "")[:120]})
        else:
            questions.append(result["question"])

    return questions, errors


def _finalize_block(block):
    reasons = []
    text = (block["text"] or "").strip()
    options = [o for o in block["options"] if o["text"].strip()]

    if not text:
        return {"rejected": True, "reason": "نص السؤال فارغ"}
    if len(options) < 2:
        return {
            "rejected": True,
            "reason": f"عدد الخيارات غير كافٍ ({len(options)}) — المطلوب خياران على الأقل",
        }
    if len(options) > len(OPTION_KEYS):
        options = options[: len(OPTION_KEYS)]
        reasons.append("تم اقتصاص الخيارات الزائدة (الحد الأقصى 6)")

    keyed_options = [
        {"key": OPTION_KEYS[i], "text": o["text"].strip()}
        for i, o in enumerate(options)
    ]

    # Correct answer: star wins, then الإجابة: line, else default أ + review.
    starred = [i for i, o in enumerate(options) if o["starred"]]
    correct_idx = None
    if len(starred) == 1:
        correct_idx = starred[0]
    elif len(starred) > 1:
        correct_idx = starred[0]
        reasons.append("أكثر من خيار عليه نجمة — اعتُمد الأول")
    elif block["answer_raw"]:
        idx = _answer_index(block["answer_raw"])
        if idx is not None and idx < len(keyed_options):
            correct_idx = idx
        else:
            reasons.append(f"الإجابة «{block['answer_raw']}» غير مفهومة — اعتُمد «أ» مؤقتاً")
            correct_idx = 0
    else:
        reasons.append("لا توجد إجابة صحيحة محددة — اعتُمد «أ» مؤقتاً")
        correct_idx = 0

    # Difficulty: missing → medium silently; unrecognized → medium + review.
    diff_raw = (block["difficulty_raw"] or "").strip().lower()
    if not diff_raw:
        difficulty = "medium"
    else:
        difficulty = _DIFFICULTY_MAP.get(diff_raw)
        if difficulty is None:
            difficulty = "medium"
            reasons.append(f"الصعوبة «{block['difficulty_raw']}» غير مفهومة — اعتُمد «متوسط»")

    # Unbalanced math delimiters — flag for review, keep text as-is.
    if text.count("$") % 2 == 1 or any(
        o["text"].count("$") % 2 == 1 for o in keyed_options
    ):
        reasons.append("علامات $ للمعادلات غير متوازنة — راجع المعادلات")

    tier_raw = (block.get("tier_raw") or "").strip().lower()
    teacher_tier = _TIER_MAP.get(tier_raw, "")
    if tier_raw and not teacher_tier:
        reasons.append(f"الترشيح «{block['tier_raw']}» غير مفهوم — اختر ذهبي/فضي/برونزي")

    return {
        "rejected": False,
        "question": {
            "line": block["line"],
            "text": text,
            "options": keyed_options,
            "correct_answer": keyed_options[correct_idx]["key"],
            "difficulty": difficulty,
            "question_year": (block["year"] or "").strip()[:20],
            "teacher_tier": teacher_tier,
            "explanation": (block["explanation"] or "").strip(),
            "video_bunny_id": (block["video"] or "").strip()[:500],
            "needs_review": bool(reasons),
            "review_notes": " · ".join(reasons),
        },
    }


def parse_upload(uploaded_file):
    """
    Entry point: accepts a Django UploadedFile (.docx or .txt).
    Returns (questions, errors). Raises ValueError for unusable files.
    """
    name = (uploaded_file.name or "").lower()
    if name.endswith(".docx"):
        lines = extract_docx_lines(uploaded_file)
    elif name.endswith(".txt"):
        lines = decode_txt(uploaded_file.read()).splitlines()
    else:
        raise ValueError("صيغة الملف غير مدعومة — ارفع ملف Word (.docx) أو ملف نصي (.txt)")

    questions, errors = parse_question_blocks(lines)
    if len(questions) > MAX_QUESTIONS:
        raise ValueError(f"الملف يحتوي أكثر من {MAX_QUESTIONS} سؤال — قسّمه على أكثر من ملف")
    return questions, errors
