import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { resolveSubjectKey } from "../theme/subjects";

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
        اختر المادة — يتغيّر الشعار والألوان تلقائياً داخل المادة
      </p>
      <div className="grid grid-2" style={{ maxWidth: 720 }}>
        {subjects.map((s) => {
          const key = resolveSubjectKey(s.name) || "math";
          return (
            <button
              key={s.id}
              className={`btn subject-tile ${key}`}
              style={{ minHeight: 100, fontSize: 22 }}
              onClick={() => navigate(`/courses/${s.id}`)}
            >
              {s.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
