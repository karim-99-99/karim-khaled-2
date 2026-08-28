"""
يولّد ملف Word النموذجي لرفع أسئلة التجميعات:
frontend/public/samples/questions-template.docx

تشغيل:  python scripts/make_sample_docx.py   (من مجلد backend)
"""

import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

OUT = (
    Path(__file__).resolve().parents[2]
    / "frontend" / "public" / "samples" / "questions-template.docx"
)

CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"""

RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""


def para(text, bold=False):
    """Right-to-left paragraph with plain text."""
    rpr = '<w:rPr><w:rtl/>' + ('<w:b/><w:bCs/>' if bold else "") + "</w:rPr>"
    return (
        '<w:p><w:pPr><w:bidi/></w:pPr>'
        f'<w:r>{rpr}<w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>'
    )


def para_with_math(before, omml, after):
    """Paragraph: text + native Word equation (OMML) + text."""
    return (
        '<w:p><w:pPr><w:bidi/></w:pPr>'
        f'<w:r><w:rPr><w:rtl/></w:rPr><w:t xml:space="preserve">{escape(before)}</w:t></w:r>'
        f"{omml}"
        f'<w:r><w:rPr><w:rtl/></w:rPr><w:t xml:space="preserve">{escape(after)}</w:t></w:r>'
        "</w:p>"
    )


def frac(num, den):
    return (
        "<m:f><m:num><m:r><m:t>%s</m:t></m:r></m:num>"
        "<m:den><m:r><m:t>%s</m:t></m:r></m:den></m:f>" % (num, den)
    )


OMML_HALF_PLUS_THIRD = (
    "<m:oMath>" + frac("1", "2") + "<m:r><m:t>+</m:t></m:r>" + frac("1", "3") + "</m:oMath>"
)

LINES = [
    ("نموذج رفع أسئلة التجميعات — منصة كريم خالد", True),
    ("اكتب كل سؤال أسفل الآخر بنفس الشكل الظاهر، واترك سطراً فارغاً واحداً بين كل سؤال والذي يليه.", False),
    ("النجمة * بعد الخيار تعني أنه الإجابة الصحيحة — أو اكتب سطراً منفصلاً: الإجابة: ب", False),
    ("السطور «السنة / الصعوبة / الشرح / فيديو» اختيارية. لو نقص شيء يستورد السؤال بعلامة «بحاجة لمراجعة».", False),
    ("المعادلات تُكتب بين علامتي دولار مثل $\\frac{3}{4}$ أو بمحرر معادلات Word مباشرة.", False),
    ("النظام يتجاهل أي نص قبل أول «س:» — يمكنك ترك هذه التعليمات أو حذفها.", False),
    ("", False),
    ("س: ما ناتج حل المعادلة $2x + 3 = 7$؟", False),
    ("أ) $x = 1$", False),
    ("ب) $x = 2$ *", False),
    ("ج) $x = 3$", False),
    ("د) $x = 4$", False),
    ("السنة: 1446", False),
    ("الصعوبة: سهل", False),
    ("الشرح: ننقل 3 إلى الطرف الآخر ثم نقسم الطرفين على 2", False),
    ("", False),
    ("س: ما قيمة $\\sqrt{144}$؟", False),
    ("أ) 10", False),
    ("ب) 11", False),
    ("ج) 12", False),
    ("د) 14", False),
    ("الإجابة: ج", False),
    ("السنة: 1445", False),
    ("الصعوبة: متوسط", False),
    ("", False),
    "MATH_QUESTION",
    ("أ) $\\frac{5}{6}$ *", False),
    ("ب) $\\frac{2}{5}$", False),
    ("ج) $\\frac{1}{6}$", False),
    ("د) $\\frac{3}{5}$", False),
    ("الصعوبة: متوسط", False),
    ("الشرح: نوحّد المقامين إلى 6 ثم نجمع البسطين", False),
    ("", False),
    ("س: إذا كان $f(x) = x^2 - 4x + 3$ فما قيمة $f(2)$؟", False),
    ("أ) $-1$ *", False),
    ("ب) $1$", False),
    ("ج) $3$", False),
    ("د) $-3$", False),
    ("السنة: 1444", False),
    ("الصعوبة: صعب", False),
    ("", False),
    ("س: أي مما يلي عدد أولي؟", False),
    ("أ) 21", False),
    ("ب) 29 *", False),
    ("ج) 33", False),
    ("د) 39", False),
    ("الصعوبة: سهل", False),
    ("", False),
    ("س: ما مساحة مربع طول ضلعه 5 سم؟", False),
    ("أ) 20 سم مربع", False),
    ("ب) 25 سم مربع *", False),
    ("ج) 30 سم مربع", False),
    ("د) 10 سم مربع", False),
    ("السنة: 1446", False),
    ("", False),
    ("س: ما محيط دائرة نصف قطرها 7 سم؟ (اعتبر $\\pi = \\frac{22}{7}$)", False),
    ("أ) 44 سم *", False),
    ("ب) 22 سم", False),
    ("ج) 154 سم", False),
    ("د) 14 سم", False),
    ("الصعوبة: متوسط", False),
    ("الشرح: المحيط $= 2 \\times \\frac{22}{7} \\times 7 = 44$", False),
    ("فيديو: https://www.youtube.com/watch?v=EXAMPLE", False),
]


def build():
    body = []
    for item in LINES:
        if item == "MATH_QUESTION":
            body.append(para_with_math("س: ما ناتج ", OMML_HALF_PLUS_THIRD, " ؟"))
        else:
            text, bold = item
            body.append(para(text, bold=bold))

    document = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document '
        'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
        'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">'
        "<w:body>" + "".join(body) + "</w:body></w:document>"
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", CONTENT_TYPES)
        zf.writestr("_rels/.rels", RELS)
        zf.writestr("word/document.xml", document)
    print(f"written: {OUT}")


if __name__ == "__main__":
    build()
