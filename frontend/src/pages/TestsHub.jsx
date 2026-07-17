import { Link, useParams } from "react-router-dom";

export default function TestsHub() {
  const { subjectId } = useParams();
  return (
    <div>
      <div className="breadcrumb">دورات &gt; <span>اختبارات</span></div>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>اختبارات</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 32 }}>
        محاكي شخصي أو مدرس — من بنك التجميعات
      </p>
      <div className="grid grid-2">
        <div className="card" style={{ padding: 32 }}>
          <h3 style={{ fontSize: 22, marginBottom: 8 }}>المحاكي الشخصي</h3>
          <p style={{ color: "var(--text-muted)", marginBottom: 20 }}>
            عدد الأسئلة، الدروس، المستوى — اختبار عشوائي
          </p>
          <Link to={`/tests/simulator/${subjectId}`} className="btn btn-primary">ابدأ الإعداد</Link>
        </div>
        <div className="card" style={{ padding: 32 }}>
          <h3 style={{ fontSize: 22, marginBottom: 8 }}>اختبار المدرس</h3>
          <p style={{ color: "var(--text-muted)", marginBottom: 20 }}>
            معادلة صعوبة · مراجعة فورية أو نهائية
          </p>
          <Link to={`/tests/teacher/${subjectId}`} className="btn btn-primary">ابدأ الإعداد</Link>
        </div>
      </div>
    </div>
  );
}
