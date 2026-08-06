import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, matchPath, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import client from "../api/client";
import {
  DEFAULT_LOGO,
  SUBJECT_THEME_EVENT,
  applySubjectTheme,
  clearSubjectTheme,
  getSubjectTheme,
  peekLockedTheme,
  resolveSubjectKey,
  unlockSubjectTheme,
} from "../theme/subjects";

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

function writeCachedSubjects(list) {
  try {
    sessionStorage.setItem(SUBJECTS_CACHE_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota */
  }
}

function readSubjectId(pathname) {
  const patterns = [
    "/courses/:subjectId/*",
    "/courses/:subjectId",
    "/tests/simulator/:subjectId",
    "/tests/teacher/:subjectId",
  ];
  for (const pattern of patterns) {
    const m = matchPath({ path: pattern, end: true }, pathname);
    if (m?.params?.subjectId) return m.params.subjectId;
  }
  return null;
}

function isExamSurface(pathname) {
  return Boolean(
    matchPath({ path: "/exam/:examId", end: true }, pathname) ||
      matchPath({ path: "/results/:examId", end: true }, pathname)
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [subjects, setSubjects] = useState(readCachedSubjects);
  const [lockedThemeKey, setLockedThemeKey] = useState(() =>
    isExamSurface(location.pathname) ? peekLockedTheme() : null
  );

  const initial = user?.full_name?.trim()?.[0] || "؟";
  const subjectId = useMemo(() => readSubjectId(location.pathname), [location.pathname]);
  const examSurface = useMemo(() => isExamSurface(location.pathname), [location.pathname]);

  // Theme only for subject routes — avoid extra lesson/exam API calls on every visit.
  useEffect(() => {
    if (!subjectId) return undefined;
    if (subjects.some((s) => String(s.id) === String(subjectId))) return undefined;

    let cancelled = false;
    client
      .get("/subjects/")
      .then((res) => {
        if (cancelled) return;
        const list = res.data.results || res.data || [];
        setSubjects(list);
        writeCachedSubjects(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [subjectId]); // intentionally not depending on subjects identity

  const subjectFromRoute = subjects.find((s) => String(s.id) === String(subjectId));
  const routeThemeKey = resolveSubjectKey(subjectFromRoute?.name) || null;
  const themeKey = (examSurface && lockedThemeKey) || routeThemeKey;
  const theme = getSubjectTheme(themeKey);
  const logoSrc = theme?.logo || DEFAULT_LOGO;
  const logoAlt = theme ? `زاد ${theme.label}` : "زاد التحصيلي";

  useEffect(() => {
    if (examSurface) {
      const locked = peekLockedTheme();
      if (locked) {
        setLockedThemeKey(locked);
        applySubjectTheme(locked);
      }
      return undefined;
    }
    setLockedThemeKey(null);
    unlockSubjectTheme();
    applySubjectTheme(routeThemeKey);
    return () => clearSubjectTheme();
  }, [routeThemeKey, examSurface, location.pathname]);

  useEffect(() => {
    if (!examSurface) return undefined;
    const onTheme = (e) => {
      const key = e.detail?.key || peekLockedTheme();
      setLockedThemeKey(key);
      if (key) applySubjectTheme(key);
    };
    window.addEventListener(SUBJECT_THEME_EVENT, onTheme);
    return () => window.removeEventListener(SUBJECT_THEME_EVENT, onTheme);
  }, [examSurface]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <>
      <header className="app-header">
        <NavLink to="/" className="logo" onClick={() => clearSubjectTheme()}>
          <img
            className="logo-img"
            src={logoSrc}
            alt={logoAlt}
            width={170}
            height={48}
            decoding="async"
            fetchPriority="high"
          />
        </NavLink>
        <nav className="nav">
          <NavLink to="/" end>
            الرئيسية
          </NavLink>
          <NavLink to="/courses">دورات</NavLink>
          <NavLink to="/results">نتائج</NavLink>
          <NavLink to="/schedule">جدول الحصص</NavLink>
          {user?.role === "student" && <NavLink to="/subscription">اشتراكي</NavLink>}
          {user?.role === "teacher" && <NavLink to="/teacher">لوحة المدرس</NavLink>}
          {user?.role === "admin" && <NavLink to="/admin">لوحة المدير</NavLink>}
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <Link to="/profile" className="btn btn-ghost btn-sm" title="الملف الشخصي">
                حسابي
              </Link>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                خروج
              </button>
              <Link to="/profile" className="avatar" title={user.full_name}>
                {initial}
              </Link>
            </>
          ) : (
            <NavLink to="/login" className="btn btn-secondary btn-sm">
              تسجيل الدخول / إنشاء حساب
            </NavLink>
          )}
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
