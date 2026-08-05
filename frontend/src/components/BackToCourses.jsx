import { Link } from "react-router-dom";

/**
 * Back navigation into the courses flow.
 * - with subjectId → subject hub (تأسيس / تجميع / اختبارات)
 * - always offers a link to the courses list
 */
export default function BackToCourses({ subjectId, showSubjectHub = true }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
      {showSubjectHub && subjectId ? (
        <Link to={`/courses/${subjectId}`} className="btn btn-secondary btn-sm">
          ← العودة للدورات
        </Link>
      ) : (
        <Link to="/courses" className="btn btn-secondary btn-sm">
          ← العودة للدورات
        </Link>
      )}
      {showSubjectHub && subjectId ? (
        <Link to="/courses" className="btn btn-ghost btn-sm">
          كل المواد
        </Link>
      ) : null}
    </div>
  );
}
