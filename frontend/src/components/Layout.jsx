import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, matchPath, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { teachableSubjectIds, teacherManageSubjectPath } from "../auth/teacherScope";
import client from "../api/client";
import SiteFooter from "./SiteFooter";
import {
  DEFAULT_LOGO,
  SUBJECT_THEME_EVENT,
  applySubjectTheme,
  clearSubjectTheme,
  getSubjectTheme,
  lockSubjectTheme,
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

function isSimulatorSurface(pathname) {
  return Boolean(
    matchPath({ path: "/tests/simulator", end: true }, pathname) ||
      matchPath({ path: "/tests/simulator/:subjectId", end: true }, pathname)
  );
}

function isCourseSurface(pathname) {
  return Boolean(
    matchPath({ path: "/courses/:subjectId/*", end: true }, pathname) ||
      matchPath({ path: "/courses/:subjectId", end: true }, pathname)
  );
}

function isLessonSurface(pathname) {
  return Boolean(
    matchPath({ path: "/lessons/:lessonId", end: true }, pathname) ||
      matchPath({ path: "/sections/:sectionId", end: true }, pathname)
  );
}

/** Keep subject chrome across course → lesson video/homework → exam/results. */
function isSubjectThemeSurface(pathname) {
  return (
    isCourseSurface(pathname) ||
    isLessonSurface(pathname) ||
    isExamSurface(pathname) ||
    isSimulatorSurface(pathname)
  );
}

function isTeacherSurface(pathname) {
  return (
    pathname.startsWith("/teacher") ||
    pathname.startsWith("/courses") ||
    pathname.startsWith("/tests/teacher")
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [subjects, setSubjects] = useState(readCachedSubjects);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lockedThemeKey, setLockedThemeKey] = useState(() =>
    isSubjectThemeSurface(location.pathname) ? peekLockedTheme() : null
  );

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const initial = user?.full_name?.trim()?.[0] || "؟";
  const subjectId = useMemo(() => readSubjectId(location.pathname), [location.pathname]);
  const subjectSurface = useMemo(
    () => isSubjectThemeSurface(location.pathname),
    [location.pathname]
  );

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
  const matchedKey = resolveSubjectKey(subjectFromRoute);
  const routeThemeKey = matchedKey || (subjectFromRoute ? "multi" : null);

  // Task 26: teacher pages use their taught subject color/logo.
  const teacherSubjectId = useMemo(() => {
    if (user?.role !== "teacher") return null;
    const ids = teachableSubjectIds(user);
    if (!Array.isArray(ids) || !ids.length) return null;
    if (user.taught_subject != null && ids.map(String).includes(String(user.taught_subject))) {
      return Number(user.taught_subject);
    }
    return Number(ids[0]);
  }, [user]);

  const teacherSubject = subjects.find((s) => String(s.id) === String(teacherSubjectId));
  const teacherThemeKey = teacherSubject ? resolveSubjectKey(teacherSubject) : null;
  const onTeacherSurface = user?.role === "teacher" && isTeacherSurface(location.pathname);

  const themeKey =
    routeThemeKey ||
    lockedThemeKey ||
    (subjectSurface ? peekLockedTheme() : null) ||
    (onTeacherSurface ? teacherThemeKey : null);
  const theme = getSubjectTheme(themeKey);
  const logoSrc = theme?.logo || DEFAULT_LOGO;
  const logoAlt = theme ? `مرام ${theme.label}` : "مرام — للتحصيلي بإتقان";
  const manageSubjectPath = teacherManageSubjectPath(user);

  useEffect(() => {
    if (!subjectSurface && !onTeacherSurface) {
      setLockedThemeKey(null);
      unlockSubjectTheme();
      clearSubjectTheme();
      return undefined;
    }

    if (onTeacherSurface && teacherThemeKey && !routeThemeKey) {
      lockSubjectTheme(teacherThemeKey);
      setLockedThemeKey(teacherThemeKey);
      applySubjectTheme(teacherThemeKey);
      return undefined;
    }

    // Course URLs carry the subject — lock so lesson/homework keep the same skin.
    if (routeThemeKey) {
      lockSubjectTheme(routeThemeKey);
      setLockedThemeKey(routeThemeKey);
      return undefined;
    }

    const locked = peekLockedTheme();
    if (locked) {
      setLockedThemeKey(locked);
      applySubjectTheme(locked);
      return undefined;
    }

    setLockedThemeKey(null);
    return undefined;
  }, [routeThemeKey, subjectSurface, location.pathname]);

  useEffect(() => {
    if (!subjectSurface) return undefined;
    const onTheme = (e) => {
      const key = e.detail?.key || peekLockedTheme();
      setLockedThemeKey(key);
      if (key) applySubjectTheme(key);
    };
    window.addEventListener(SUBJECT_THEME_EVENT, onTheme);
    return () => window.removeEventListener(SUBJECT_THEME_EVENT, onTheme);
  }, [subjectSurface]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className={`app-shell${menuOpen ? " menu-open" : ""}`}>
      <header className="app-header">
        <NavLink
          to="/"
          className="logo"
          onClick={() => {
            unlockSubjectTheme();
            clearSubjectTheme();
            setLockedThemeKey(null);
          }}
        >
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
        <nav className={`nav${menuOpen ? " is-open" : ""}`}>
          {user?.role === "teacher" ? (
            <>
              <NavLink to="/teacher" end onClick={() => setMenuOpen(false)}>
                الرئيسية
              </NavLink>
              <NavLink to="/teacher/schedule" onClick={() => setMenuOpen(false)}>
                حصصي
              </NavLink>
              <NavLink to="/teacher/students" onClick={() => setMenuOpen(false)}>
                الطلاب
              </NavLink>
              <NavLink to="/teacher/tasks" onClick={() => setMenuOpen(false)}>
                المهام
              </NavLink>
              <NavLink to="/tests" onClick={() => setMenuOpen(false)}>
                الاختبارات
              </NavLink>
              <NavLink to={manageSubjectPath} onClick={() => setMenuOpen(false)}>
                إدارة المادة
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to="/" end onClick={() => setMenuOpen(false)}>
                الرئيسية
              </NavLink>
              {!(user?.role === "student" && user?.is_silver) && user?.role === "student" && (
                <NavLink to="/daily-tasks" onClick={() => setMenuOpen(false)}>
                  المهام اليومية
                </NavLink>
              )}
              <NavLink to="/courses" onClick={() => setMenuOpen(false)}>دورات</NavLink>
              <NavLink to="/tests" onClick={() => setMenuOpen(false)}>اختبارات</NavLink>
              <NavLink to="/results" onClick={() => setMenuOpen(false)}>نتائج</NavLink>
              {!(user?.role === "student" && user?.is_silver) && (
                <NavLink to="/schedule" onClick={() => setMenuOpen(false)}>جدول الحصص</NavLink>
              )}
              <NavLink to="/pricing" onClick={() => setMenuOpen(false)}>الأسعار</NavLink>
              {user?.role === "student" && (
                <NavLink to="/subscription" onClick={() => setMenuOpen(false)}>اشتراكي</NavLink>
              )}
              {user?.role === "admin" && (
                <NavLink to="/admin" onClick={() => setMenuOpen(false)}>لوحة المدير</NavLink>
              )}
            </>
          )}
        </nav>
        <button
          type="button"
          className={`nav-burger${menuOpen ? " open" : ""}`}
          aria-label={menuOpen ? "إغلاق القائمة" : "فتح القائمة"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <i />
          <i />
          <i />
        </button>
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
            <>
              <NavLink to="/login" className="btn btn-ghost btn-sm header-login">
                تسجيل الدخول
              </NavLink>
              <NavLink to="/register" className="btn btn-sm header-book">
                احجز مقعدك
              </NavLink>
            </>
          )}
        </div>
      </header>
      {menuOpen && (
        <button
          type="button"
          className="nav-scrim"
          aria-label="إغلاق القائمة"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <main
        className={
          location.pathname === "/" ||
          location.pathname === "/login" ||
          location.pathname === "/register" ||
          location.pathname.startsWith("/courses") ||
          location.pathname.startsWith("/tests") ||
          location.pathname.startsWith("/exam") ||
          location.pathname.startsWith("/lessons")
            ? "container container--bleed"
            : "container"
        }
      >
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
