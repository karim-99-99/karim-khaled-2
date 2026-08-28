import { useRef, useState } from "react";
import client from "../api/client";
import MathText from "./MathText";
import { tierLabel } from "../constants/teacherTiers";

/**
 * معاينة واستيراد أسئلة من ملف Word (.docx) أو نصي (.txt).
 * يُستخدم في التجميعات وواجب التأسيس.
 */
export default function QuestionImportPanel({
  importUrl,
  lessonId,
  sectionId,
  templateDownloadName = "نموذج-أسئلة.docx",
  showYearHint = false,
  onImported,
}) {
  const importInputRef = useRef(null);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  function resetImport() {
    setImportFile(null);
    setImportPreview(null);
    setImportMsg("");
    if (importInputRef.current) importInputRef.current.value = "";
  }

  async function runImport(mode) {
    if (!importFile) {
      setImportMsg("اختر ملفاً أولاً");
      return;
    }
    setImportBusy(true);
    setImportMsg("");
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      fd.append("lesson", String(lessonId));
      if (sectionId) fd.append("section", String(sectionId));
      fd.append("mode", mode);
      const { data } = await client.post(importUrl, fd);
      if (mode === "preview") {
        setImportPreview(data);
        if (!data.questions?.length) {
          setImportMsg("لم يُعثر على أي سؤال بالصيغة المطلوبة — راجع الملف النموذجي");
        }
      } else {
        onImported?.(data);
        resetImport();
      }
    } catch (e) {
      setImportMsg(e.response?.data?.detail || "تعذّر معالجة الملف");
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <div className="section-title" style={{ marginTop: 0, fontSize: 17 }}>
        رفع ملف أسئلة — Word (.docx) أو نصي (.txt)
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 8 }}>
        اكتب كل سؤال أسفل الآخر واترك سطراً فارغاً بين الأسئلة. النجمة * بعد الخيار
        تحدد الإجابة الصحيحة، والسطور «الصعوبة / الشرح / فيديو / الترشيح»
        {showYearHint ? " / السنة" : ""} اختيارية. المعادلات بين $...$ أو بمحرر
        معادلات Word. أي سؤال ناقص يُستورد بعلامة «بحاجة لمراجعة» ولا يظهر للطلاب
        حتى تعتمده.
      </p>
      <a
        href="/samples/questions-template.docx"
        download={templateDownloadName}
        className="btn btn-ghost btn-sm"
        style={{ marginBottom: 12 }}
      >
        ⬇ تحميل الملف النموذجي (Word)
      </a>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          ref={importInputRef}
          type="file"
          accept=".docx,.txt"
          className="form-control"
          style={{ flex: 1, minWidth: 220 }}
          onChange={(e) => {
            setImportFile(e.target.files?.[0] || null);
            setImportPreview(null);
            setImportMsg("");
          }}
        />
        <button
          type="button"
          className="btn btn-secondary"
          disabled={importBusy || !importFile}
          onClick={() => runImport("preview")}
        >
          {importBusy && !importPreview ? "جاري الفحص…" : "معاينة الملف"}
        </button>
      </div>
      {importMsg && (
        <div className="banner" style={{ marginTop: 10 }}>
          {importMsg}
        </div>
      )}

      {importPreview && (
        <div style={{ marginTop: 14 }}>
          <div className="filter-row" style={{ marginBottom: 10 }}>
            <span className="chip">الإجمالي: {importPreview.summary?.total || 0}</span>
            <span className="chip">جاهز: {importPreview.summary?.ready || 0}</span>
            <span className="chip">
              بحاجة لمراجعة: {importPreview.summary?.needs_review || 0}
            </span>
            <span className="chip">مرفوض: {importPreview.summary?.rejected || 0}</span>
          </div>

          {(importPreview.errors || []).map((err, i) => (
            <div
              key={`err-${i}`}
              className="card"
              style={{ padding: 10, marginBottom: 6, borderColor: "#dc2626" }}
            >
              <strong style={{ color: "#dc2626" }}>مرفوض (سطر {err.line}):</strong>{" "}
              {err.reason}
              {err.text ? (
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{err.text}</div>
              ) : null}
            </div>
          ))}

          {(importPreview.questions || []).map((q, i) => (
            <div key={`pq-${i}`} className="card" style={{ padding: 10, marginBottom: 6 }}>
              <div>
                <strong>س{i + 1}:</strong> <MathText>{q.text}</MathText>{" "}
                {q.needs_review ? (
                  <span className="chip" style={{ background: "#fef3c7", color: "#92400e" }}>
                    بحاجة لمراجعة
                  </span>
                ) : (
                  <span className="chip" style={{ background: "#dcfce7", color: "#166534" }}>
                    جاهز
                  </span>
                )}
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
                {(q.options || []).map((o) => (
                  <span key={o.key} style={{ marginInlineEnd: 10 }}>
                    {o.key}) <MathText>{o.text}</MathText>
                    {o.key === q.correct_answer ? " ✓" : ""}
                  </span>
                ))}
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>
                الصعوبة:{" "}
                {q.difficulty === "easy" ? "سهل" : q.difficulty === "hard" ? "صعب" : "متوسط"}
                {showYearHint && q.question_year ? ` · السنة: ${q.question_year}` : ""}
                {q.teacher_tier ? ` · الترشيح: ${tierLabel(q.teacher_tier)}` : ""}
                {q.review_notes ? (
                  <span style={{ color: "#b45309" }}> · {q.review_notes}</span>
                ) : null}
              </div>
            </div>
          ))}

          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={importBusy || !(importPreview.questions || []).length}
              onClick={() => runImport("commit")}
            >
              {importBusy
                ? "جاري الاستيراد…"
                : `تأكيد استيراد ${(importPreview.questions || []).length} سؤال`}
            </button>
            <button type="button" className="btn btn-ghost" onClick={resetImport}>
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
