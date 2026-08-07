import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import client from "../api/client";

/**
 * Legacy /sections/:id route — redirects into the lesson page accordion.
 */
export default function SectionDetail() {
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    client
      .get(`/lesson-sections/${sectionId}/`)
      .then((res) => {
        if (cancelled) return;
        const lessonId = res.data.lesson;
        if (lessonId) {
          navigate(`/lessons/${lessonId}?section=${sectionId}`, { replace: true });
        } else {
          setErr("العنوان الفرعي غير مرتبط بدرس");
        }
      })
      .catch(() => {
        if (!cancelled) setErr("تعذّر فتح العنوان الفرعي");
      });
    return () => {
      cancelled = true;
    };
  }, [sectionId, navigate]);

  if (err) {
    return (
      <div className="card" style={{ padding: 24, textAlign: "center" }}>
        <p>{err}</p>
      </div>
    );
  }

  return <div className="spinner">جاري الفتح…</div>;
}
