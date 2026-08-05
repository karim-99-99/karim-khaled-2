import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { canEditSubject } from "../auth/teacherScope";
import BackToCourses from "../components/BackToCourses";
import { resolveSubjectKey } from "../theme/subjects";

export default function SubjectHub() {
  const { subjectId } = useParams();
  const { user } = useAuth();
  const [subject, setSubject] = useState(null);
  const canEdit = canEditSubject(user, subjectId);

  useEffect(() => {
    client.get(`/subjects/`).then((res) => {
      const list = res.data.results || res.data;
      setSubject(list.find((s) => String(s.id) === subjectId));
    });
  }, [subjectId]);

  const key = resolveSubjectKey(subject?.name);

  return (
    <div>
      <BackToCourses showSubjectHub={false} />
      <div className="breadcrumb">
        دورات &gt; <span>{subject?.name || "…"}</span>
      </div>
      <h1 className="page-title" style={{ color: "var(--primary)" }}>
        {subject?.name}
      </h1>
      {canEdit && (
        <div className="banner" style={{ marginBottom: 20 }}>
          <strong>تأسيس</strong>: واجب لمجموعاتك فقط · <strong>تجميع</strong>: أسئلة لكل طلاب المادة · ثم اختبارات.
        </div>
      )}
      <div className="grid grid-3">
        <Link
          to={`/courses/${subjectId}/lessons`}
          className={`card path-card path-primary ${key ? `tone-${key}` : ""}`}
        >
          <div className="path-icon">ت</div>
          <h3>تأسيس</h3>
          <p>{canEdit ? "دروس + فيديو + واجب لمجموعتك فقط" : "دروس — فيديو، PDF، واجب مجموعتك"}</p>
        </Link>
        <Link
          to={`/courses/${subjectId}/collections`}
          className={`card path-card path-accent ${key ? `tone-${key}` : ""}`}
        >
          <div className="path-icon">ج</div>
          <h3>تجميع</h3>
          <p>{canEdit ? "دروس + أسئلة للجميع (سهل/متوسط/صعب)" : "دروس — تدريب من بنك كل المدرسين"}</p>
        </Link>
        <Link
          to={`/courses/${subjectId}/tests`}
          className={`card path-card path-dark ${key ? `tone-${key}` : ""}`}
        >
          <div className="path-icon">خ</div>
          <h3>اختبارات</h3>
          <p>محاكي شخصي أو اختبار مدرس</p>
        </Link>
      </div>
    </div>
  );
}
