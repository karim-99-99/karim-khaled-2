import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, matchPath, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import client from "../api/client";
import {
  DEFAULT_LOGO,
  applySubjectTheme,
  clearSubjectTheme,
  getSubjectTheme,
  resolveSubjectKey,
} from "../theme/subjects";

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

function readLessonId(pathname) {
  const m = matchPath({ path: "/lessons/:lessonId", end: true }, pathname);
  return m?.params?.lessonId || null;
}

function readExamId(pathname) {
  const patterns = ["/exam/:examId", "/results/:examId"];
  for (const pattern of patterns) {
    const m = matchPath({ path: pattern, end: true }, pathname);
    if (m?.params?.examId) return m.params.examId;
  }
  return null;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [subjects, setSubjects] = useState([]);
  const [fetchedSubjectName, setFetchedSubjectName] = useState("");

  const initial = user?.full_name?.trim()?.[0] || "؟";
  const subjectId = useMemo(() => readSubjectId(location.pathname), [location.pathname]);
  const lessonId = useMemo(() => readLessonId(location.pathname), [location.pathname]);
  const examId = useMemo(() => readExamId(location.pathname), [location.pathname]);

  useEffect(() => {
    client
      .get("/subjects/")
      .then((res) => setSubjects(res.data.results || res.data || []))
      .catch(() => setSubjects([]));
  }, []);

  useEffect(() => {
    setFetchedSubjectName("");
    if (!lessonId && !examId) return undefined;

    let cancelled = false;
    const url = lessonId ? `/lessons/${lessonId}/` : `/exams/${examId}/`;
    client
      .get(url)
      .then((res) => {
        if (cancelled) return;
        const name = res.data.subject_name || res.data.exam?.subject_name || "";
        setFetchedSubjectName(name);
      })
      .catch(() => {
        if (!cancelled) setFetchedSubjectName("");
      });

    return () => {
      cancelled = true;
    };
  }, [lessonId, examId]);

  const subjectFromRoute = subjects.find((s) => String(s.id) === String(subjectId));
  const themeKey =
    resolveSubjectKey(subjectFromRoute?.name) ||
    resolveSubjectKey(fetchedSubjectName) ||
    null;
  const theme = getSubjectTheme(themeKey);
  const logoSrc = theme?.logo || DEFAULT_LOGO;
  const logoAlt = theme ? `زاد ${theme.label}` : "زاد التحصيلي";

  useEffect(() => {
    applySubjectTheme(themeKey);
    return () => clearSubjectTheme();
  }, [themeKey]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <>
      <header className="app-header">
        <NavLink to="/" className="logo" onClick={() => clearSubjectTheme()}>
          <img className="logo-img" src={logoSrc} alt={logoAlt} />
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
