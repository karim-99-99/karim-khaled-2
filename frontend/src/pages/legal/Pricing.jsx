import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { whatsappHref } from "../../legal/business";
import "../../styles/pricing-exact.css";

export default function Pricing() {
  const { user } = useAuth();
  const ctaTo = user ? "/subscription" : "/register";
  const wa = whatsappHref("مرحبا، أحتاج باقة مخصصة مع مرام");

  return (
    <div className="pricing-exact">
      <div className="head">
        <small>مرام التحصيلي</small>
        <h1>الأسعار والباقات</h1>
        <div className="note">
          <span>✓ دفع آمن</span>
          <span>✓ لا تتجدد تلقائياً</span>
          <span>✓ تُفعّل فور الدفع</span>
        </div>
      </div>

      <div className="cards">
        <div className="card silver">
          <h2>الباقة الفضية</h2>
          <div className="sub">للمذاكرة الذاتية بالمحتوى المسجّل</div>
          <div className="price">
            <strong>190</strong>
            <span>ريال</span>
          </div>
          <div className="per">📅 صالحة حتى نهاية اختبار التحصيلي — الفترة الثانية</div>
          <ul>
            <li><span className="ck">✓</span>كل الدروس المرئية في المواد الأربع</li>
            <li><span className="ck">✓</span>تجميعات الأسئلة مع الحلول والشرح</li>
            <li><span className="ck">✓</span>اختبارات المحاكاة وتقارير النتائج</li>
            <li><span className="ck">✓</span>الجدول الذكي وخطة المذاكرة اليومية</li>
            <li className="hl"><span className="ck">✓</span>دورة المراجعة النهائية<em>جديد</em></li>
          </ul>
          <Link className="btn" to={ctaTo}>اشترك الآن</Link>
        </div>

        <div className="card gold">
          <span className="pop">⭐ الأكثر طلباً</span>
          <h2>الباقة الذهبية</h2>
          <div className="sub">حصص مباشرة ومتابعة كاملة مع المدرسين</div>
          <div className="offer">
            <span className="ob">🔥 عرض التسجيل المبكر</span>
            <span className="save">وفّر 510 ريال</span>
          </div>
          <div className="price">
            <strong>990</strong>
            <span>ريال</span>
            <s>1500 ريال</s>
          </div>
          <div className="inst">
            💳 أو قسّطها على <b>3 دفعات</b> × <b>330 ريال</b>
          </div>
          <div className="per" style={{ marginTop: 10 }}>
            📅 صالحة حتى نهاية اختبار التحصيلي — الفترة الثانية
          </div>
          <div className="spec">
            <div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              <strong>14 أسبوع</strong>
              <span>مدة الدورة</span>
            </div>
            <div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12h4l3 8 4-16 3 8h4" />
              </svg>
              <strong>5 أيام</strong>
              <span>في الأسبوع</span>
            </div>
            <div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              <strong>ساعتان</strong>
              <span>مدة الحصة يومياً</span>
            </div>
          </div>
          <ul>
            <li><span className="ck">✓</span>كل مزايا الباقة الفضية</li>
            <li><span className="ck">✓</span>الحصص المباشرة مع المدرس في مجموعة صغيرة</li>
            <li className="hl"><span className="ck">✓</span>مجموعة واتساب وتواصل مباشر مع المدرسين</li>
            <li><span className="ck">✓</span>متابعة المدرس للنتائج والواجبات</li>
            <li><span className="ck">✓</span>اختبارات يضعها المدرس للمجموعة</li>
            <li className="hl"><span className="ck">✓</span>دورة المراجعة النهائية<em>جديد</em></li>
          </ul>
          <Link className="btn" to={ctaTo}>اشترك الآن ←</Link>
        </div>
      </div>

      <div className="custom">
        <div className="cl">
          <span className="ci">🧩</span>
          <div>
            <small>باقة مخصصة</small>
            <h3>تحتاج شي مختلف؟ نصمم لك باقتك الخاصة</h3>
            <div className="opts">
              <span>📘 مادة واحدة فقط</span>
              <span>👤 حصص فردية لمادة كاملة</span>
              <span>🎯 حصص فردية لمواضيع معينة</span>
            </div>
          </div>
        </div>
        <a className="cbtn" href={wa} target="_blank" rel="noreferrer">
          <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 22, height: 22 }}>
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm4.5 12.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1.1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2z" />
          </svg>
          تواصل معنا
        </a>
      </div>
    </div>
  );
}
