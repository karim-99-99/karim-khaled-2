import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import client from "../api/client";
import { filterSubjectsForUser } from "../auth/teacherScope";
import { getSubjectTheme, resolveSubjectKey } from "../theme/subjects";
import "../styles/courses-exact.css";

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

const FALLBACK = [
  { id: "math", name: "رياضيات", key: "math" },
  { id: "physics", name: "فيزياء", key: "physics" },
  { id: "chem", name: "كيمياء", key: "chem" },
  { id: "bio", name: "أحياء", key: "bio" },
];

export default function Courses() {
  const { user } = useAuth();
  const cached = readCachedSubjects();
  const [subjects, setSubjects] = useState(() =>
    filterSubjectsForUser(cached, user),
  );
  const [loading, setLoading] = useState(subjects.length === 0);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const hasCache = subjects.length > 0;
    if (!hasCache) setLoading(true);

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
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, user?.taught_subject, JSON.stringify(user?.teachable_subject_ids || [])]);

  const cards = subjects.length
    ? subjects.map((s) => {
        const key = resolveSubjectKey(s.name) || "math";
        return { ...s, key, theme: getSubjectTheme(key) };
      })
    : FALLBACK.map((s) => ({ ...s, theme: getSubjectTheme(s.key) }));

  return (
    <div className="courses-exact">
      <h1>دورات</h1>
      <p className="sub">
        {user?.role === "teacher"
          ? "موادك المخصصة فقط — إدارة الدروس والأسئلة داخلها"
          : "اختر المادة — يتغيّر الشعار والألوان تلقائياً داخل المادة"}
      </p>

      {loading && <div className="spinner">جاري التحميل…</div>}

      <div className="grid">
        {cards.map((s) => {
          const key = s.key || resolveSubjectKey(s.name) || "math";
          const cls =
            key === "physics" ? "phys" : key === "chem" ? "chem" : key === "bio" ? "bio" : "math";
          const to = user ? `/courses/${s.id}` : "/login";
          return (
            <button
              key={s.id}
              type="button"
              className={`card ${cls}`}
              onClick={() => navigate(to)}
            >
              <span className="logo-wrap">
                <img
                  src={s.theme?.logo || `/subjects/${key === "physics" ? "physics" : key}.png`}
                  alt={s.name || ""}
                  loading="lazy"
                  decoding="async"
                />
              </span>
              <div className="go">ادخل الدورة ←</div>
            </button>
          );
        })}
      </div>

      <div className="final">
        <img src="/maram-real.png" alt="" />
        <div className="txt">
          <h2>دورة المراجعة النهائية</h2>
          <p>مراجعة شاملة لكل المواد قبل اختبار التحصيلي</p>
        </div>
        <div className="soon">قريباً</div>
      </div>
      {!user ? <Link to="/login" className="sr-only">تسجيل الدخول</Link> : null}
    </div>
  );
}
