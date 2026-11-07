import { Link } from "react-router-dom";
import LegalPage, { ContactBlock, LegalSection } from "../../components/LegalPage";
import { BUSINESS } from "../../legal/business";

export default function RefundPolicy() {
  const days = BUSINESS.refundWindowDays;
  const maxUsage = BUSINESS.refundMaxUsagePercent;
  return (
    <LegalPage
      title="سياسة الاسترداد والإلغاء"
      titleEn="Refund & cancellation policy"
      intro="نوضح هنا متى يحق لك استرداد المبلغ، وكيف تطلب ذلك، وما الذي يحدث عند الإلغاء."
      englishSummary={
        <>
          <ul>
            <li>
              All plans are <strong>prepaid for a fixed term</strong> and{" "}
              <strong>do not auto-renew</strong>. There is no recurring charge to
              cancel; access simply ends on the expiry date.
            </li>
            <li>
              <strong>Full refund within {days} days</strong> of purchase, provided
              that no more than <strong>{maxUsage}%</strong> of the paid content
              (lessons, question sets and live classes) has been used.
            </li>
            <li>
              <strong>No refund</strong> for a plan whose content was offered as a
              free trial or sample before purchase: you were able to evaluate it
              before paying.
            </li>
            <li>
              Full refund at any time for duplicate charges, charges made without
              the cardholder&apos;s authorisation, or a technical fault on our side
              that we cannot fix within 3 business days.
            </li>
            <li>
              After the {days}-day window, or once the content has been
              substantially used, fees are non-refundable, except as required by
              law.
            </li>
            <li>
              Refunds go back to the original payment method within{" "}
              {BUSINESS.refundProcessingDaysEn} after approval. To request one, email{" "}
              {BUSINESS.supportEmail} with the account email and payment date.
            </li>
            <li>
              Please contact us before opening a dispute with your bank; most issues
              are resolved within one business day.
            </li>
          </ul>
        </>
      }
    >
      <LegalSection title="١. طبيعة الاشتراك">
        <p>
          جميع الباقات (الفضية والذهبية) <strong>مدفوعة مقدّماً لمدة محددة</strong> ولا
          تتجدد تلقائياً. لا نخصم أي مبلغ متكرر من بطاقتك، وعند انتهاء المدة يتوقف
          الوصول إلى المحتوى المدفوع ويمكنك الاشتراك مرة أخرى متى شئت.
        </p>
      </LegalSection>

      <LegalSection title="٢. حالات الاسترداد الكامل">
        <ul>
          <li>
            <strong>خلال {days} أيام من الشراء</strong> بشرط ألا يتجاوز استهلاكك{" "}
            <strong>{maxUsage}٪</strong> من المحتوى المدفوع (الدروس، تجميعات الأسئلة،
            الحصص المباشرة). يُحسب الاستهلاك من سجل الحساب على المنصة.
          </li>
          <li>خصم مكرر لنفس الباقة بالخطأ.</li>
          <li>عملية دفع تمت دون تفويض صاحب البطاقة، بعد التحقق.</li>
          <li>
            عطل تقني من جهتنا يمنع الوصول إلى المحتوى ولم نتمكن من إصلاحه خلال ٣ أيام
            عمل من إبلاغنا.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="٣. الحالات غير القابلة للاسترداد">
        <ul>
          <li>
            <strong>الباقات التي سبقها عرض تجريبي:</strong> إذا أتيح لك تجربة محتوى
            الباقة مجاناً قبل الشراء (درس مجاني، أسئلة تجريبية، أو فترة تجريبية) فلا يحق
            الاسترداد بعد الدفع، لأنك اطّلعت على المحتوى قبل اتخاذ القرار.
          </li>
          <li>انقضاء {days} أيام على الشراء، أو تجاوز استهلاك {maxUsage}٪ من المحتوى.</li>
          <li>عدم استخدام الاشتراك طوال المدة دون طلب استرداد في الوقت المحدد.</li>
          <li>إيقاف الحساب بسبب مخالفة الشروط (مثل مشاركة الحساب أو تسجيل المحتوى).</li>
          <li>اختلاف التوقعات الشخصية عن محتوى تم وصفه بوضوح قبل الشراء.</li>
        </ul>
        <p>يبقى حقك في الاسترداد محفوظاً في أي حالة يوجبها القانون المعمول به.</p>
      </LegalSection>

      <LegalSection title="٤. كيف تطلب الاسترداد">
        <ol>
          <li>
            راسلنا على <a href={`mailto:${BUSINESS.supportEmail}`} dir="ltr">{BUSINESS.supportEmail}</a>{" "}
            أو عبر واتساب <span dir="ltr">{BUSINESS.supportWhatsapp}</span>.
          </li>
          <li>اذكر البريد المسجّل في حسابك، وتاريخ الدفع، والباقة، وسبب الطلب.</li>
          <li>نرد عليك {BUSINESS.responseTime} بقبول الطلب أو توضيح السبب.</li>
          <li>
            بعد الموافقة يُعاد المبلغ إلى <strong>نفس وسيلة الدفع</strong> خلال{" "}
            {BUSINESS.refundProcessingDays}، حسب البنك المصدر للبطاقة.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="٥. الإلغاء">
        <p>
          لأن الاشتراك لا يتجدد تلقائياً، لا توجد خطوة إلغاء مطلوبة؛ لن يُخصم منك أي
          مبلغ آخر دون أن تختار الاشتراك بنفسك. إذا رغبت في إنهاء الاشتراك قبل موعده مع
          استرداد المبلغ، تنطبق البنود أعلاه.
        </p>
      </LegalSection>

      <LegalSection title="٦. الاعتراض على عملية دفع">
        <p>
          إذا رأيت خصماً لا تعرفه باسم <span dir="ltr">{BUSINESS.statementDescriptor}</span>،
          تواصل معنا أولاً قبل فتح نزاع لدى البنك؛ أغلب الحالات تُحل خلال يوم عمل واحد.
          نتعاون بالكامل مع البنوك ومزوّد الدفع {BUSINESS.paymentProcessor} في أي نزاع.
        </p>
      </LegalSection>

      <LegalSection title="٧. تواصل معنا">
        <ContactBlock />
        <p style={{ marginTop: 12 }}>
          راجع أيضاً <Link to="/terms"><strong>الشروط والأحكام</strong></Link> و{" "}
          <Link to="/pricing"><strong>الأسعار والباقات</strong></Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
