import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";

export default function Courses() {
  const [subjects, setSubjects] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    client.get("/subjects/").then((res) => setSubjects(res.data.results || res.data));
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>دورات</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 32 }}>
        اختر المادة — ثم تأسيس أو تجميع أو اختبارات
      </p>
      <div className="grid grid-2" style={{ maxWidth: 720 }}>
        {subjects.map((s, i) => (
          <button
            key={s.id}
            className={`btn ${i === 0 ? "btn-primary" : "btn-secondary"}`}
            style={{ minHeight: 88, fontSize: 20 }}
            onClick={() => navigate(`/courses/${s.id}`)}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
