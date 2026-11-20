import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import client from "../api/client";
import { filterSubjectsForUser } from "../auth/teacherScope";
import { getSubjectTheme, resolveSubjectKey } from "../theme/subjects";

const SUBJECTS_CACHE_KEY = "zad_subjects_cache_v1";

function readCachedSubjects() {
  try {
    const raw = sessionStorage.getItem(SUBJECTS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function Courses() {
  const { user } = useAuth();
  const cached = readCachedSubjects();
  const [subjects, setSubjects] = useState(() =>
    filterSubjectsForUser(cached, user),
  );
  const [loading, setLoading] = useState(subjects.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const hasCache = subjects.length > 0;
    if (hasCache) setRefreshing(true);
    else setLoading(true);

    client
      .get("/subjects/")
      .then((res) => {
        if (cancelled) return;
        const list = res.data.results || res.data || [];
        const filtered = filterSubjectsForUser(list, user);
        setSubjects(filtered);
        try {
          sessionStorage.setItem(SUBJECTS_CACHE_KEY, JSON.stringify(list));
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        if (!cancelled && !hasCache) setSubjects([]);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, user?.taught_subject, JSON.stringify(user?.teachable_subject_ids || [])]);

  return (
    <div className="courses-page">
      <div className="courses-page__head">
        <div>
          <h1 className="page-title" style={{ marginBottom: 6 }}>دورات</h1>
          <p style={{ color: "var(--text-muted)" }}>
            {user?.role === "teacher"
              ? "موادك المخصصة فقط — إدارة الدروس والأسئلة داخلها"
              : "اختر المادة — يتغيّر الشعار والألوان تلقائياً داخل المادة"}
          </p>
        </div>
        {refreshing && (
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>جاري التحديث…</span>
        )}
      </div>

      {user?.role === "teacher" && user?.taught_subject_name && (
        <div className="banner" style={{ marginBottom: 20 }}>
          مادتك: <strong>{user.taught_subject_name}</strong>
        </div>
      )}

      {loading && <div className="spinner">جاري التحميل…</div>}
      {!loading && !subjects.length && (
        <p style={{ color: "var(--text-muted)" }}>
          {user?.role === "teacher"
            ? "لم تُخصص لك مادة بعد — تواصل مع الإدارة."
            : "لا توجد مواد."}
        </p>
      )}

      <div className="courses-grid">
        {subjects.map((s) => {
          const key = resolveSubjectKey(s.name) || "math";
          const theme = getSubjectTheme(key);
          return (
            <button
              key={s.id}
              type="button"
              className={`courses-card courses-card--${key}`}
              onClick={() => navigate(`/courses/${s.id}`)}
            >
              {theme?.logo ? (
                <img src={theme.logo} alt="" className="courses-card__logo" />
              ) : null}
              <strong>{s.name}</strong>
              <span className="btn btn-primary btn-sm">ادخل الدورة ←</span>
            </button>
          );
        })}
      </div>

      <div className="landing-final-banner ui-card">
        <div>
          <h3>دورة المراجعة النهائية</h3>
          <p>مراجعة شاملة لكل المواد قبل اختبار التحصيلي.</p>
        </div>
        <span className="btn btn-secondary" aria-disabled="true">قريباً</span>
      </div>
    </div>
  );
}
