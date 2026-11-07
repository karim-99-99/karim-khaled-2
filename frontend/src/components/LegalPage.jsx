import { Link } from "react-router-dom";
import { BUSINESS, LEGAL_LINKS } from "../legal/business";

/**
 * Shared frame for the public policy pages. Each page gets an Arabic body,
 * an English summary for payment-provider reviewers, and cross links.
 */
export default function LegalPage({ title, titleEn, intro, englishSummary, children }) {
  return (
    <article className="legal-page">
      <header className="legal-page__head">
        <div className="eyebrow">{BUSINESS.brand}</div>
        <h1 className="legal-page__title">{title}</h1>
        {titleEn ? <div className="legal-page__title-en">{titleEn}</div> : null}
        {intro ? <p className="legal-page__intro">{intro}</p> : null}
        <div className="legal-page__meta">آخر تحديث: {BUSINESS.lastUpdated}</div>
      </header>

      <div className="legal-page__body">{children}</div>

      {englishSummary ? (
        <section className="legal-page__en" dir="ltr" lang="en">
          <h2>English summary</h2>
          {englishSummary}
        </section>
      ) : null}

      <nav className="legal-page__links" aria-label="صفحات السياسات">
        {LEGAL_LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="chip">
            {l.label}
          </Link>
        ))}
      </nav>
    </article>
  );
}

export function LegalSection({ title, children }) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function ContactBlock() {
  return (
    <ul className="legal-contact">
      <li>
        <strong>البريد الإلكتروني:</strong>{" "}
        <a href={`mailto:${BUSINESS.supportEmail}`} dir="ltr">
          {BUSINESS.supportEmail}
        </a>
        {BUSINESS.supportEmailAlt && (
          <>
            {" "}أو{" "}
            <a href={`mailto:${BUSINESS.supportEmailAlt}`} dir="ltr">
              {BUSINESS.supportEmailAlt}
            </a>
          </>
        )}
      </li>
      <li>
        <strong>الهاتف / واتساب:</strong>{" "}
        <a href={`tel:${BUSINESS.supportPhone.replace(/\s+/g, "")}`} dir="ltr">
          {BUSINESS.supportPhone}
        </a>
      </li>
      <li>
        <strong>العنوان:</strong> {BUSINESS.address}
      </li>
      <li>
        <strong>ساعات العمل:</strong> {BUSINESS.supportHours}
      </li>
    </ul>
  );
}
