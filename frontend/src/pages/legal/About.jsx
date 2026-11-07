import { Link } from "react-router-dom";
import LegalPage, { ContactBlock, LegalSection } from "../../components/LegalPage";
import { BUSINESS } from "../../legal/business";

export default function About() {
  return (
    <LegalPage
      title="من نحن"
      titleEn="About us"
      intro={`${BUSINESS.brand} منصة تعليمية إلكترونية لطلاب اختبار التحصيلي، تقدّم شرحاً مرئياً وبنك أسئلة وحصصاً مباشرة بإشراف مدرسين متخصصين.`}
      englishSummary={
        <>
          <p>
            <strong>{BUSINESS.brandLatin}</strong> ({BUSINESS.legalName}) is an online
            learning platform for high-school students preparing for the Tahsili
            (achievement) exam in Mathematics, Physics, Chemistry and Biology.
          </p>
          <p>
            We sell prepaid digital subscriptions (monthly, quarterly, yearly) that
            unlock recorded video lessons, question banks with worked solutions,
            practice exams, a study planner and scheduled live classes. Access is
            delivered instantly online after payment; nothing is shipped.
          </p>
          <p>
            Support: {BUSINESS.supportEmail} · {BUSINESS.supportPhone} · {BUSINESS.address}
          </p>
        </>
      }
    >
      <LegalSection title="ماذا نقدّم">
        <ul>
          <li>دروس تأسيس مرئية مسجّلة في الرياضيات والفيزياء والكيمياء والأحياء.</li>
          <li>تجميعات أسئلة الاختبارات السابقة مع الحل والشرح لكل سؤال.</li>
          <li>اختبارات محاكاة شخصية واختبارات يضعها المدرس مع تقارير النتائج.</li>
          <li>حصص مباشرة مجدولة مع المدرس داخل مجموعات دراسية صغيرة.</li>
          <li>الجدول الذكي: خطة مذاكرة يومية مخصصة لكل طالب.</li>
        </ul>
      </LegalSection>

      <LegalSection title="طريقة الاستفادة من الخدمة">
        <p>
          الخدمة رقمية بالكامل. بعد إنشاء الحساب واختيار الباقة وإتمام الدفع يتم تفعيل
          الاشتراك فوراً ويُفتح المحتوى داخل الموقع من أي متصفح على الهاتف أو الحاسوب.
          لا يوجد أي منتج يُشحن.
        </p>
        <p>
          الأسعار معلنة في صفحة{" "}
          <Link to="/pricing">
            <strong>الأسعار والباقات</strong>
          </Link>
          ، والاشتراك مدفوع مقدّماً لمدة محددة ولا يتجدد تلقائياً.
        </p>
      </LegalSection>

      <LegalSection title="بيانات النشاط">
        <ul>
          <li>
            <strong>الاسم التجاري:</strong> {BUSINESS.brand} ({BUSINESS.brandLatin})
          </li>
          <li>
            <strong>الاسم القانوني:</strong> {BUSINESS.legalName}
          </li>
          <li>
            <strong>الدولة:</strong> {BUSINESS.country}
          </li>
          <li>
            <strong>الاسم الظاهر في كشف حساب البطاقة:</strong>{" "}
            <span dir="ltr">{BUSINESS.statementDescriptor}</span>
          </li>
          <li>
            <strong>الموقع الإلكتروني:</strong>{" "}
            <a href={BUSINESS.website} dir="ltr">
              {BUSINESS.website}
            </a>
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="تواصل معنا">
        <ContactBlock />
      </LegalSection>
    </LegalPage>
  );
}
