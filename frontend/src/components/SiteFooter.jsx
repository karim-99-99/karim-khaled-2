import { Link } from "react-router-dom";
import { BUSINESS, LEGAL_LINKS } from "../legal/business";

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <div className="site-footer__name">{BUSINESS.brand}</div>
          <p>
            منصة تعليمية إلكترونية لطلاب اختبار التحصيلي: دروس مرئية، بنك أسئلة، اختبارات
            محاكاة، وحصص مباشرة. اشتراكات مدفوعة مقدّماً لا تتجدد تلقائياً.
          </p>
          <div className="site-footer__legal-name">{BUSINESS.legalName}</div>
        </div>

        <div className="site-footer__col">
          <div className="site-footer__heading">السياسات</div>
          <ul>
            {LEGAL_LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="site-footer__col">
          <div className="site-footer__heading">خدمة العملاء</div>
          <ul>
            <li>
              <a href={`mailto:${BUSINESS.supportEmail}`} dir="ltr">
                {BUSINESS.supportEmail}
              </a>
            </li>
            <li>
              <a href={`tel:${BUSINESS.supportPhone.replace(/\s+/g, "")}`} dir="ltr">
                {BUSINESS.supportPhone}
              </a>
            </li>
            <li>{BUSINESS.address}</li>
            <li>{BUSINESS.supportHours}</li>
          </ul>
        </div>

        <div className="site-footer__col">
          <div className="site-footer__heading">الدفع الآمن</div>
          <ul>
            <li>المدفوعات تتم عبر {BUSINESS.paymentProcessor} بتشفير كامل.</li>
            <li>
              نقبل: {BUSINESS.acceptedCards.join("، ")}
            </li>
            <li>
              يظهر الخصم باسم <span dir="ltr">{BUSINESS.statementDescriptor}</span>
            </li>
            <li>
              <Link to="/pricing">الأسعار بالعملة معلنة قبل الدفع</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="site-footer__bottom">
        © {year} {BUSINESS.brand} — جميع الحقوق محفوظة.
      </div>
    </footer>
  );
}
