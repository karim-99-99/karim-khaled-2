import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { canEditSubject } from "../auth/teacherScope";
import BackToCourses from "../components/BackToCourses";
import { getSubjectTheme, resolveSubjectKey } from "../theme/subjects";

export default function SubjectHub() {
  const { subjectId } = useParams();
  const { user } = useAuth();
  const [subject, setSubject] = useState(null);
  const canEdit = canEditSubject(user, subjectId);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("zad_subjects_cache_v1");
      if (raw) {
        const list = JSON.parse(raw);
        const hit = (list || []).find((s) => String(s.id) === String(subjectId));
        if (hit) {
          setSubject(hit);
          return;
        }
      }
    } catch {
      /* ignore */
    }
    client.get(`/subjects/${subjectId}/`).then((res) => {
      setSubject(res.data);
    }).catch(() => {
      client.get(`/subjects/`).then((res) => {
        const list = res.data.results || res.data;
        setSubject(list.find((s) => String(s.id) === subjectId) || null);
      });
    });
  }, [subjectId]);

  const key = resolveSubjectKey(subject?.name);
  const theme = getSubjectTheme(key);

  return (
    <div className="subject-hub">
      <BackToCourses showSubjectHub={false} />
      <div className="breadcrumb">
        دورات &gt; <span>{subject?.name || "…"}</span>
      </div>

      <div className={`subject-hub__hero ui-card ${key ? `tone-${key}` : ""}`}>
        {theme?.logo ? <img src={theme.logo} alt="" className="subject-hub__logo" /> : null}
        <div>
          <h1 className="page-title" style={{ marginBottom: 4, color: "var(--primary)" }}>
            {subject?.name || "…"}
          </h1>
          <p style={{ color: "var(--text-muted)" }}>مرام — للتحصيلي بإتقان</p>
        </div>
      </div>

      {canEdit && (
        <div className="banner" style={{ marginBottom: 20 }}>
          <strong>تأسيس</strong>: درس ← عناوين فرعية ← واجب · <strong>تجميع</strong>: دروس وأسئلة · ثم اختبارات.
        </div>
      )}

      <div className="subject-hub__paths">
        <Link
          to={`/courses/${subjectId}/lessons`}
          className={`card path-card path-primary ${key ? `tone-${key}` : ""}`}
        >
          <div className="path-icon">ت</div>
          <h3>تأسيس</h3>
          <p>{canEdit ? "دروس وعناوين فرعية وفيديو وواجب" : "دروس وعناوين فرعية — فيديو وواجب"}</p>
          <span className="btn btn-primary btn-sm">ادخل</span>
        </Link>
        <Link
          to={`/courses/${subjectId}/collections`}
          className={`card path-card path-accent ${key ? `tone-${key}` : ""}`}
        >
          <div className="path-icon">ج</div>
          <h3>تجميعات</h3>
          <p>{canEdit ? "دروس فرعية + أسئلة للجميع" : "تدريب من بنك الأسئلة"}</p>
          <span className="btn btn-secondary btn-sm">ادخل</span>
        </Link>
      </div>

      <div className="subject-hub__tests ui-card">
        <div>
          <h3>اختبارات المدرسين — {subject?.name || ""}</h3>
          <p>محاكي شخصي أو اختبارات المدرس من بنك التجميعات</p>
        </div>
        <div className="subject-hub__tests-actions">
          <Link to={`/tests/simulator/${subjectId}`} className="btn btn-secondary btn-sm">
            صمم اختبارك
          </Link>
          <Link to={`/courses/${subjectId}/tests`} className="btn btn-primary btn-sm">
            عرض الاختبارات
          </Link>
        </div>
      </div>
    </div>
  );
}
