import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import client from "../api/client";

export default function StudentReports() {
  const { studentId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .get(`/teacher/students/${studentId}/reports/`)
      .then((res) => setData(res.data))
      .catch((e) => setError(e.response?.data?.detail || "تعذّر التحميل"))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <div className="spinner">جاري التحميل…</div>;

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 12 }}>
        <Link to="/teacher/students">← الطلاب</Link>
      </div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>
        تقارير {data?.student?.full_name || ""}
      </h1>
      {data?.parent_link && (
        <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>
          أولياء مربوطون: {data.parent_link.linked_count} · كود الربط:{" "}
          <code>{data.parent_link.code}</code>
        </p>
      )}
      {error && <div className="banner">{error}</div>}
      {(data?.reports || []).length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>لا تقارير بعد.</p>
      )}
      <div style={{ display: "grid", gap: 12 }}>
        {(data?.reports || []).map((r) => (
          <div key={r.id} className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <strong>
                {r.report_type === "reminder" ? "تذكير مهام" : "تقرير حصة"}
                {r.subject_name ? ` · ${r.subject_name}` : ""}
              </strong>
              <span
                style={{
                  fontWeight: 700,
                  color:
                    r.status === "sent"
                      ? "#16a34a"
                      : r.status === "no_parent"
                        ? "#c26a00"
                        : "#dc2626",
                }}
              >
                {r.status}
              </span>
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: 13, margin: "6px 0 10px" }}>
              {r.sent_at || r.created_at}
              {r.created_by_name ? ` · ${r.created_by_name}` : ""}
            </div>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                fontFamily: "inherit",
                margin: 0,
                background: "#f8fafc",
                padding: 12,
                borderRadius: 12,
              }}
            >
              {r.content_text}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
