import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LegalPage, { LegalSection } from "../../components/LegalPage";
import { useAuth } from "../../auth/AuthContext";
import { BUSINESS, whatsappHref } from "../../legal/business";
import Price, { CurrencyLabel } from "../../components/Price";
import { FEATURED_PLAN, PLAN_FEATURES, fetchPlans } from "../../utils/plans";

export default function Pricing() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchPlans()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError("تعذّر تحميل الأسعار الآن. حاول مرة أخرى بعد قليل.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const plans = data?.plans || [];
  const currency = data?.currency || "";
  const ctaTo = user ? "/subscription" : "/register";
  const ctaLabel = user ? "اشترك الآن" : "أنشئ حساباً واشترك";
  const wa = whatsappHref("مرحبا، أحتاج باقة مخصصة مع مرام");

  return (
    <LegalPage
      title="الأسعار والباقات"
      titleEn="Pricing"
      intro="باقتان واضحتان: الفضية للمحتوى المسجّل، والذهبية تضيف الحصص المباشرة مع المدرس. كل الباقات مدفوعة مقدّماً، لا تتجدد تلقائياً، وتُفعَّل فور الدفع."
      englishSummary={
        <>
          <p>
            Prepaid digital subscriptions for {BUSINESS.brandLatin}. Prices are shown in{" "}
            {currency || "the listed currency"} and include applicable taxes. Access starts immediately after payment and ends on
            the expiry date; plans <strong>do not auto-renew</strong>. Payments are
            processed by {BUSINESS.paymentProcessor}; we accept{" "}
            {BUSINESS.acceptedCards.join(", ")}.
          </p>
          <ul>
            {plans.map((p) => (
              <li key={p.id}>
                {p.label_en || p.id} ({p.days} days
                {p.live_classes ? ", includes live classes" : ", recorded content"}):{" "}
                {Number(p.price).toLocaleString("en-US")} {p.currency}
              </li>
            ))}
          </ul>
        </>
      }
    >
      <div className="pricing-trust">
        <span>دفع آمن</span>
        <span>بدون تجديد تلقائي</span>
        <span>تفعيل فوري</span>
      </div>

      {error && <div className="banner">{error}</div>}

      <div className="pricing-grid">
        {plans.map((p) => {
          const featured = p.id === FEATURED_PLAN;
          const listPrice = Number(p.compare_at_price || p.list_price || 0);
          const price = Number(p.price);
          const save = listPrice > price ? Math.round(listPrice - price) : 0;
          const installment = price > 0 ? Math.round((price / 3) * 100) / 100 : 0;
          return (
            <div
              key={p.id}
              className={`card pricing-card ${featured ? "pricing-card--featured" : ""}`}
            >
              {featured && <div className="pricing-card__badge">الأكثر طلباً</div>}
              <h3 className="pricing-card__name">{p.label}</h3>
              <div className="pricing-card__price">
                <Price amount={p.price} currency={p.currency} />
              </div>
              {save > 0 && (
                <div className="pricing-card__save">
                  وفر {save} · تسجيل مبكر
                </div>
              )}
              {featured && installment > 0 && (
                <div className="pricing-card__install">
                  أو قسّط على 3 دفعات × <Price amount={installment} currency={p.currency} />
                </div>
              )}
              <div className="pricing-card__chips">
                <span>{p.days} يوم</span>
                {p.live_classes ? <span>حصص مباشرة</span> : <span>محتوى مسجّل</span>}
              </div>
              <div className="pricing-card__term">دفعة واحدة · لا يتجدد تلقائياً</div>
              <ul className="pricing-card__features">
                {(PLAN_FEATURES[p.id] || []).map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Link to={ctaTo} className={`btn ${featured ? "btn-primary" : "btn-secondary"} btn-block`}>
                {ctaLabel}
              </Link>
            </div>
          );
        })}
        {!error && plans.length === 0 && <div className="spinner">جاري تحميل الأسعار…</div>}
      </div>

      <div className="pricing-custom ui-card">
        <div>
          <h3>محتاج شيء مختلف؟</h3>
          <p>نصمّم باقتك: مادة واحدة، خصوصي كامل، أو مواضيع محددة.</p>
        </div>
        <a className="btn btn-primary" href={wa} target="_blank" rel="noreferrer">
          تواصل معنا
        </a>
      </div>

      <LegalSection title="ما الذي يشمله كل اشتراك">
        <ul>
          <li>دروس التأسيس المرئية كاملة في المواد الأربع.</li>
          <li>تجميعات أسئلة السنوات السابقة مع الحل والشرح لكل سؤال.</li>
          <li>اختبارات محاكاة غير محدودة وتقارير النتائج.</li>
          <li>الجدول الذكي وخطة المذاكرة اليومية.</li>
          <li>الحصص المباشرة حسب المجموعة الدراسية (الباقة الذهبية فقط).</li>
        </ul>
      </LegalSection>

      <LegalSection title="معلومات الدفع">
        <ul>
          <li>
            الأسعار بعملة{" "}
            <strong>{currency ? <CurrencyLabel code={currency} /> : "—"}</strong>{" "}
            وشاملة الضرائب المطبقة. قد يضيف بنكك رسوم تحويل عملة إذا كانت بطاقتك بعملة أخرى.
          </li>
          <li>
            وسائل الدفع المقبولة: {BUSINESS.acceptedCards.join("، ")} عبر بوابة{" "}
            {BUSINESS.paymentProcessor} الآمنة. لا نحتفظ ببيانات بطاقتك.
          </li>
          <li>
            يظهر الخصم في كشف الحساب باسم <span dir="ltr">{BUSINESS.statementDescriptor}</span>.
          </li>
          <li>
            الاشتراك <strong>لا يتجدد تلقائياً</strong>. عند انتهاء المدة يمكنك الاشتراك مرة
            أخرى متى شئت.
          </li>
          <li>
            الاسترداد: خلال {BUSINESS.refundWindowDays} أيام من الشراء بشرط ألا يتجاوز
            استهلاك المحتوى {BUSINESS.refundMaxUsagePercent}٪، ولا يشمل الباقات التي سبقها
            عرض تجريبي، حسب{" "}
            <Link to="/refund-policy"><strong>سياسة الاسترداد والإلغاء</strong></Link>.
          </li>
        </ul>
      </LegalSection>
    </LegalPage>
  );
}
