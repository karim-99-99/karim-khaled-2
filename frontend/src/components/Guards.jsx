import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner">جاري التحميل…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export function RequireRole({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner">جاري التحميل…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role))
    return <Navigate to="/" replace />;
  return children;
}

/** Gold-only routes (schedule, daily tasks). Silver → home. */
export function RequireGold({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner">جاري التحميل…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "student" && user.is_silver) {
    return <Navigate to="/" replace />;
  }
  return children;
}
