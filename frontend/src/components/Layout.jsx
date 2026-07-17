import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initial = user?.full_name?.trim()?.[0] || "؟";

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <>
      <header className="app-header">
        <NavLink to="/" className="logo">
          <div className="logo-icon">ت</div> منصة التعلم
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
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                خروج
              </button>
              <div className="avatar">{initial}</div>
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
