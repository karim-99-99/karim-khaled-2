import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import client from "../api/client";

export default function SubjectHub() {
  const { subjectId } = useParams();
  const [subject, setSubject] = useState(null);

  useEffect(() => {
    client.get(`/subjects/`).then((res) => {
      const list = res.data.results || res.data;
      setSubject(list.find((s) => String(s.id) === subjectId));
    });
  }, [subjectId]);

  return (
    <div>
      <div className="breadcrumb">
        دورات &gt; <span>{subject?.name || "…"}</span>
      </div>
      <h1 style={{ fontSize: 32, marginBottom: 24 }}>{subject?.name}</h1>
      <div className="grid grid-3">
        <Link to={`/courses/${subjectId}/lessons`} className="card" style={{ padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 32 }}>📚</div>
          <h3>تأسيس</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>دروس مرقمة — فيديو، PDF، واجب</p>
        </Link>
        <Link to={`/courses/${subjectId}/collections`} className="card" style={{ padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 32 }}>🧩</div>
          <h3>تجميع</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>الدروس نفسها — اختر المستوى سهل/متوسط/صعب</p>
        </Link>
        <Link to={`/courses/${subjectId}/tests`} className="card" style={{ padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 32 }}>📝</div>
          <h3>اختبارات</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>محاكي شخصي أو اختبار مدرس</p>
        </Link>
      </div>
    </div>
  );
}
