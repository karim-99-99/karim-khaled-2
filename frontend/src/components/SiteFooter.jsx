import { Link } from "react-router-dom";
import { BUSINESS, LEGAL_LINKS } from "../legal/business";

const SOCIAL = [
  { key: "whatsapp", label: "واتساب", href: BUSINESS.social.whatsapp },
  { key: "instagram", label: "إنستغرام", href: BUSINESS.social.instagram },
  { key: "tiktok", label: "تيك توك", href: BUSINESS.social.tiktok },
  { key: "telegram", label: "تيليجرام", href: BUSINESS.social.telegram },
  { key: "x", label: "X", href: BUSINESS.social.x },
];

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <div className="site-footer__name">مرام التحصيلي</div>
          <p>
            منصة تعليمية إلكترونية لطلاب اختبار التحصيلي: دروس مرئية، بنك أسئلة، اختبارات محاكاة، وحصص مباشرة. اشتراكات مدفوعة مقدماً لا تتجدد تلقائياً.
          </p>
          <div className="site-footer__legal-name">Maram Education</div>
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
            <li>نقبل: {BUSINESS.acceptedCards.join("، ")}</li>
            <li>
              يظهر الخصم باسم <span dir="ltr">{BUSINESS.statementDescriptor}</span>
            </li>
            <li>
              <Link to="/pricing">الأسعار بالعملة معلنة قبل الدفع</Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="site-footer__social">
        {SOCIAL.map((s) => (
          <a
            key={s.key}
            className={`site-footer__social-link site-footer__social-link--${s.key}`}
            href={s.href}
            target={s.href.startsWith("http") ? "_blank" : undefined}
            rel={s.href.startsWith("http") ? "noreferrer" : undefined}
            aria-label={s.label}
          >
            {s.label}
          </a>
        ))}
      </div>

      <div className="site-footer__bottom">
        © {year} {BUSINESS.brand} — جميع الحقوق محفوظة.
      </div>
    </footer>
  );
}
