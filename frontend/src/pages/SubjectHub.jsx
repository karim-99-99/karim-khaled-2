import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import client from "../api/client";
import { getSubjectTheme, resolveSubjectKey } from "../theme/subjects";

export default function SubjectHub() {
  const { subjectId } = useParams();
  const [subject, setSubject] = useState(null);

  useEffect(() => {
    client.get(`/subjects/`).then((res) => {
      const list = res.data.results || res.data;
      setSubject(list.find((s) => String(s.id) === subjectId));
    });
  }, [subjectId]);

  const theme = getSubjectTheme(resolveSubjectKey(subject?.name));

  return (
    <div>
      <div className="breadcrumb">
        دورات &gt; <span>{subject?.name || "…"}</span>
      </div>
      {theme && (
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img
            src={theme.logo}
            alt={`زاد ${theme.label}`}
            style={{ height: 120, width: "auto", maxWidth: "100%" }}
          />
        </div>
      )}
      <h1 style={{ fontSize: 32, marginBottom: 24, color: "var(--primary)" }}>{subject?.name}</h1>
      <div className="grid grid-3">
        <Link
          to={`/courses/${subjectId}/lessons`}
          className="card"
          style={{ padding: 24, textAlign: "center", borderTop: "6px solid var(--primary)" }}
        >
          <div style={{ fontSize: 32 }}>📚</div>
          <h3 style={{ color: "var(--primary)" }}>تأسيس</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>دروس مرقمة — فيديو، PDF، واجب</p>
        </Link>
        <Link
          to={`/courses/${subjectId}/collections`}
          className="card"
          style={{ padding: 24, textAlign: "center", borderTop: "6px solid var(--accent)" }}
        >
          <div style={{ fontSize: 32 }}>🧩</div>
          <h3 style={{ color: "var(--accent-dark)" }}>تجميع</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>الدروس نفسها — اختر المستوى سهل/متوسط/صعب</p>
        </Link>
        <Link
          to={`/courses/${subjectId}/tests`}
          className="card"
          style={{ padding: 24, textAlign: "center", borderTop: "6px solid var(--primary-dark)" }}
        >
          <div style={{ fontSize: 32 }}>📝</div>
          <h3 style={{ color: "var(--primary-dark)" }}>اختبارات</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>محاكي شخصي أو اختبار مدرس</p>
        </Link>
      </div>
    </div>
  );
}
