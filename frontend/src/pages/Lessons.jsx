import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import client from "../api/client";

export default function Lessons() {
  const { subjectId } = useParams();
  const { user } = useAuth();
  const [lessons, setLessons] = useState([]);
  const freeTier = user?.role === "student" && !user?.has_active_subscription;

  useEffect(() => {
    client.get(`/subjects/${subjectId}/lessons/`).then((res) => setLessons(res.data));
  }, [subjectId]);

  return (
    <div>
      <div className="breadcrumb">دورات &gt; <span>تأسيس</span></div>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>تأسيس — الدروس</h1>
      {freeTier && (
        <div className="banner" style={{ marginBottom: 16 }}>
          المعاينة المجانية: يمكنك مشاهدة أول درس فقط وحل أول ١٠ أسئلة —
          الرجاء التواصل مع الإدارة لتفعيل الحساب بالكامل.
        </div>
      )}
      {lessons.map((l) => {
        const locked = l.is_locked;
        const inner = (
          <>
            <span style={{ fontWeight: 700, width: 32 }}>{l.order_number}</span>
            <span style={{ flex: 1, fontWeight: 600 }}>{l.title}</span>
            {l.is_free_preview || l.order_number === 1 ? (
              <span className="badge badge-active">مجاني</span>
            ) : locked ? (
              <span className="badge badge-expired">يتطلب تفعيل</span>
            ) : null}
            <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
              {locked ? "مقفل" : "فيديو · PDF · واجب"}
            </span>
          </>
        );
        if (locked) {
          return (
            <div
              key={l.id}
              className="card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: 16,
                marginBottom: 12,
                opacity: 0.65,
                cursor: "not-allowed",
              }}
            >
              {inner}
            </div>
          );
        }
        return (
          <Link
            key={l.id}
            to={`/lessons/${l.id}`}
            className="card"
            style={{ display: "flex", alignItems: "center", gap: 16, padding: 16, marginBottom: 12 }}
          >
            {inner}
          </Link>
        );
      })}
      {lessons.length === 0 && <p style={{ color: "var(--text-muted)" }}>لا توجد دروس.</p>}
    </div>
  );
}
