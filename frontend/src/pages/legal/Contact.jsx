import LegalPage, { ContactBlock, LegalSection } from "../../components/LegalPage";
import { BUSINESS } from "../../legal/business";

export default function Contact() {
  return (
    <LegalPage
      title="اتصل بنا"
      titleEn="Contact & customer service"
      intro="فريق الدعم جاهز لمساعدتك في الاشتراك والدفع والمحتوى والمشاكل التقنية."
      englishSummary={
        <>
          <p>
            Customer service for {BUSINESS.brandLatin}: email {BUSINESS.supportEmail}
            {BUSINESS.supportEmailAlt ? ` or ${BUSINESS.supportEmailAlt}` : ""},
            phone/WhatsApp {BUSINESS.supportPhone}, {BUSINESS.supportHoursEn}. Address:{" "}
            {BUSINESS.address}. We reply within one business day.
          </p>
          <p>
            For billing questions include the email on your account and the date of
            the payment. Refund requests follow our Refund &amp; Cancellation policy.
          </p>
        </>
      }
    >
      <LegalSection title="بيانات التواصل">
        <ContactBlock />
        <p style={{ marginTop: 12 }}>
          نرد على الرسائل <strong>{BUSINESS.responseTime}</strong>.
        </p>
      </LegalSection>

      <LegalSection title="استفسارات الدفع والاشتراك">
        <p>
          عند مراسلتنا بخصوص عملية دفع، اذكر البريد الإلكتروني المسجّل في حسابك وتاريخ
          الدفع والباقة المختارة حتى نتحقق بسرعة. طلبات الاسترداد تُعالج حسب{" "}
          <a href="/refund-policy">
            <strong>سياسة الاسترداد والإلغاء</strong>
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="الدعم التقني">
        <p>
          لو واجهت مشكلة في تشغيل فيديو أو دخول حصة مباشرة أو ظهور الأسئلة، أرسل لنا
          وصف المشكلة ونوع الجهاز والمتصفح، وسنساعدك في أقرب وقت.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
