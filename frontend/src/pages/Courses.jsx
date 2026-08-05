import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import client from "../api/client";
import { filterSubjectsForUser } from "../auth/teacherScope";
import { resolveSubjectKey } from "../theme/subjects";

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
          // Cache full list for Layout theming; Courses filters per role.
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
    // Re-filter when user role/scope changes; network refresh stays cheap via cache paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, user?.taught_subject, JSON.stringify(user?.teachable_subject_ids || [])]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        <h1 style={{ fontSize: 32, margin: 0 }}>دورات</h1>
        {refreshing && (
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>جاري التحديث…</span>
        )}
      </div>
      <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>
        {user?.role === "teacher"
          ? "موادك المخصصة فقط — يمكنك إضافة وتعديل الدروس والأسئلة داخلها"
          : "اختر المادة — يتغيّر الشعار والألوان تلقائياً داخل المادة"}
      </p>
      {user?.role === "teacher" && user?.taught_subject_name && (
        <div className="banner" style={{ marginBottom: 20 }}>
          مادتك: <strong>{user.taught_subject_name}</strong> — أسئلتك تظهر لطلاب
          المجموعات التي تُدرّس فيها هذه المادة فقط.
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
      <div className="grid grid-2" style={{ maxWidth: 720 }}>
        {subjects.map((s) => {
          const key = resolveSubjectKey(s.name) || "math";
          return (
            <button
              key={s.id}
              type="button"
              className={`btn subject-tile ${key}`}
              style={{ minHeight: 100, fontSize: 22 }}
              onClick={() => navigate(`/courses/${s.id}`)}
            >
              {s.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
