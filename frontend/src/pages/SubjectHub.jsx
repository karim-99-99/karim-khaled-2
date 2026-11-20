import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { canEditSubject } from "../auth/teacherScope";
import { getSubjectTheme, resolveSubjectKey } from "../theme/subjects";
import "../styles/subject-exact.css";

const CalIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

function formatArDate(raw) {
  if (!raw) return null;
  const s = String(raw);
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]} / ${m[2]} / ${m[1]}`;
  return s;
}

export default function SubjectHub() {
  const { subjectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subject, setSubject] = useState(null);
  const [teacherTests, setTeacherTests] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const canEdit = canEditSubject(user, subjectId);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("zad_subjects_cache_v1");
      if (raw) {
        const list = JSON.parse(raw);
        const hit = (list || []).find((s) => String(s.id) === String(subjectId));
        if (hit) {
          setSubject(hit);
          return;
        }
      }
    } catch {
      /* ignore */
    }
    client
      .get(`/subjects/${subjectId}/`)
      .then((res) => setSubject(res.data))
      .catch(() => {
        client.get(`/subjects/`).then((res) => {
          const list = res.data.results || res.data;
          setSubject(list.find((s) => String(s.id) === subjectId) || null);
        });
      });
  }, [subjectId]);

  useEffect(() => {
    client
      .get(`/teacher-tests/?subject=${subjectId}`)
      .then((res) => setTeacherTests(res.data.results || res.data || []))
      .catch(() => setTeacherTests([]));
  }, [subjectId]);

  async function startTeacherTest(id) {
    setBusyId(id);
    try {
      const { data } = await client.post("/exams/teacher/", { teacher_test: id });
      navigate(`/exam/${data.exam.id}`);
    } catch {
      setBusyId(null);
    }
  }

  const key = resolveSubjectKey(subject?.name) || "math";
  const theme = getSubjectTheme(key);

  return (
    <div className={`subject-exact tone-${key}`}>
      <div className="top">
        <div className="crumb">
          دورات &lt; <b>{subject?.name || "…"}</b>
        </div>
        <Link to="/courses" className="back">
          → العودة للدورات
        </Link>
      </div>

      <div className="split">
        <div className="hero">{theme?.logo ? <img src={theme.logo} alt={subject?.name || ""} /> : null}</div>
        <div className="stack">
          <Link to={`/courses/${subjectId}/lessons`} className="card t">
            <div className="ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
            <h3>تأسيس</h3>
            <span className="go">ادخل ←</span>
          </Link>
          <Link to={`/courses/${subjectId}/collections`} className="card j">
            <div className="ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="#c58a00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </div>
            <h3>تجميعات</h3>
            <span className="go">ادخل ←</span>
          </Link>
        </div>
      </div>

      <div className="exbox">
        <div className="exams">
          <div className="ex-l">
            <div className="ex-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M9 15l2 2 4-4" />
              </svg>
            </div>
            <b>
              اختبارات المدرسين <small className="sb">({subject?.name || "…"})</small>
            </b>
          </div>
          <Link to={`/tests/simulator/${subjectId}`}>✏️ صمّم اختبارك بنفسك</Link>
        </div>
        <ul className="exlist">
          {teacherTests.map((t, idx) => {
            const done = t.solved || t.my_score != null || t.status === "solved";
            const upcoming = t.is_upcoming || t.status === "upcoming";
            const score = t.my_score;
            const maxScore = t.max_score || t.question_count || 20;
            const dateLabel = formatArDate(t.opens_at || t.start_at || t.scheduled_at);
            return (
              <li key={t.id} className={done ? "done" : ""}>
                <span className="num">{done ? "✓" : idx + 1}</span>
                <b>
                  {t.name}
                  <small>{done ? "تم الحل" : upcoming ? "قادم" : "متاح"}</small>
                </b>
                {done && score != null ? (
                  <>
                    <span className="score">
                      درجتك{" "}
                      <strong dir="ltr">
                        {score} / {maxScore}
                      </strong>
                    </span>
                    <Link to="/results" className="rv">
                      مراجعة الإجابات
                    </Link>
                  </>
                ) : upcoming ? (
                  <>
                    {dateLabel ? (
                      <span className="date">
                        <CalIcon />
                        <span dir="ltr">{dateLabel}</span>
                      </span>
                    ) : null}
                    <span className="qs">{t.question_count || "—"} سؤال</span>
                  </>
                ) : (
                  <>
                    <span className="qs">{t.question_count || "—"} سؤال</span>
                    <button
                      type="button"
                      className="rv"
                      style={{ cursor: "pointer", background: "#fff" }}
                      disabled={busyId === t.id}
                      onClick={() => startTeacherTest(t.id)}
                    >
                      {busyId === t.id ? "…" : "ابدأ الاختبار"}
                    </button>
                  </>
                )}
              </li>
            );
          })}
          {!teacherTests.length && (
            <li>
              <span className="num">—</span>
              <b>
                لا اختبارات بعد<small>قريباً</small>
              </b>
              <Link to={`/courses/${subjectId}/tests`} className="rv">
                عرض الاختبارات
              </Link>
            </li>
          )}
        </ul>
        {canEdit && (
          <div style={{ padding: "12px 28px 20px" }}>
            <Link to={`/tests/teacher/${subjectId}`} className="rv">
              إنشاء / إدارة اختبار
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
