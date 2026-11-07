import { Link } from "react-router-dom";
import LegalPage, { ContactBlock, LegalSection } from "../../components/LegalPage";
import { BUSINESS } from "../../legal/business";

export default function Terms() {
  return (
    <LegalPage
      title="الشروط والأحكام"
      titleEn="Terms of service"
      intro={`باستخدامك موقع ${BUSINESS.brand} أو إنشاء حساب أو شراء اشتراك فأنت توافق على هذه الشروط. اقرأها بعناية.`}
      englishSummary={
        <>
          <ul>
            <li>
              The service is provided by {BUSINESS.legalName} ({BUSINESS.brandLatin}),{" "}
              {BUSINESS.address}.
            </li>
            <li>
              Users must be at least {BUSINESS.minAge} years old; younger students
              need a parent or guardian to create the account and make payments.
            </li>
            <li>
              Subscriptions are prepaid for a fixed term (30, 90 or 365 days) at the
              prices and currency shown on the Pricing page and again at checkout, and{" "}
              <strong>do not auto-renew</strong>.
            </li>
            <li>
              Payments are processed securely by {BUSINESS.paymentProcessor}; we never
              store full card numbers.
            </li>
            <li>
              One account per student. Sharing credentials, downloading, recording or
              redistributing lessons and questions is prohibited and may lead to
              termination without refund.
            </li>
            <li>
              Refunds follow the Refund &amp; Cancellation policy. Governing law:{" "}
              {BUSINESS.governingLaw}.
            </li>
          </ul>
        </>
      }
    >
      <LegalSection title="١. التعريفات ومقدّم الخدمة">
        <p>
          «المنصة» أو «نحن» تعني {BUSINESS.legalName} ({BUSINESS.brandLatin})، ومقرها{" "}
          {BUSINESS.address}. «المستخدم» أو «أنت» تعني كل من يتصفح الموقع أو ينشئ حساباً أو
          يشتري اشتراكاً. تشمل «الخدمة» الدروس المرئية وبنوك الأسئلة والاختبارات
          والحصص المباشرة والجدول الذكي وكل ما يُقدَّم عبر الموقع.
        </p>
      </LegalSection>

      <LegalSection title="٢. الأهلية والحساب">
        <ul>
          <li>
            يجب ألا يقل عمر المستخدم عن {BUSINESS.minAge} عاماً. الطالب الأصغر سناً يستخدم
            المنصة بموافقة ولي الأمر الذي ينشئ الحساب ويتولى الدفع.
          </li>
          <li>تلتزم بتقديم بيانات صحيحة (الاسم، رقم الهاتف، البريد) وتحديثها عند تغيّرها.</li>
          <li>
            الحساب شخصي لطالب واحد. أنت مسؤول عن سرية كلمة المرور وعن كل ما يتم من خلال
            حسابك.
          </li>
          <li>يحق لنا إيقاف أي حساب تثبت مشاركته مع أكثر من شخص أو استخدامه بشكل مخالف.</li>
        </ul>
      </LegalSection>

      <LegalSection title="٣. الاشتراكات والأسعار والدفع">
        <ul>
          <li>
            الباقات والأسعار والعملة معلنة في صفحة{" "}
            <Link to="/pricing"><strong>الأسعار والباقات</strong></Link> وتظهر مرة أخرى قبل
            إتمام الدفع.
          </li>
          <li>
            الاشتراك <strong>مدفوع مقدّماً لمدة محددة</strong> معلنة مع كل باقة (الفضية أو
            الذهبية) ولا يتجدد تلقائياً. لا يُخصم أي مبلغ دون أن تختار الاشتراك بنفسك.
          </li>
          <li>
            تتم معالجة المدفوعات عبر مزوّد دفع آمن ({BUSINESS.paymentProcessor}). لا نخزّن
            أرقام البطاقات الكاملة على خوادمنا.
          </li>
          <li>
            يظهر الخصم في كشف حساب البطاقة باسم{" "}
            <span dir="ltr">{BUSINESS.statementDescriptor}</span>.
          </li>
          <li>
            الأسعار شاملة الضرائب المطبقة ما لم يُذكر خلاف ذلك. قد تضيف البنوك رسوم تحويل
            عملة خارج نطاق سيطرتنا.
          </li>
          <li>يبدأ الاشتراك فور نجاح الدفع، ويُضاف إلى نهاية أي اشتراك نشط حالياً.</li>
        </ul>
      </LegalSection>

      <LegalSection title="٤. الاسترداد والإلغاء">
        <p>
          تنطبق <Link to="/refund-policy"><strong>سياسة الاسترداد والإلغاء</strong></Link>{" "}
          وهي جزء لا يتجزأ من هذه الشروط. باختصار: استرداد كامل خلال{" "}
          {BUSINESS.refundWindowDays} أيام من الشراء بشرط ألا يتجاوز استهلاك المحتوى{" "}
          {BUSINESS.refundMaxUsagePercent}٪، ولا استرداد لباقة سبقها عرض تجريبي، واسترداد
          كامل في حالات الخصم المكرر أو العطل التقني.
        </p>
      </LegalSection>

      <LegalSection title="٥. الترخيص والملكية الفكرية">
        <ul>
          <li>
            نمنحك ترخيصاً شخصياً، غير حصري، غير قابل للتحويل، لمشاهدة المحتوى عبر الموقع
            خلال مدة اشتراكك فقط.
          </li>
          <li>
            جميع الفيديوهات والأسئلة والشروحات والتصاميم مملوكة للمنصة أو لمدرسيها ومحمية
            بقوانين الملكية الفكرية.
          </li>
          <li>
            يُحظر تحميل أو تسجيل أو نسخ أو بيع أو إعادة نشر أي جزء من المحتوى، أو إزالة
            العلامة المائية التي تحمل اسمك.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="٦. الاستخدام المقبول">
        <ul>
          <li>عدم محاولة اختراق الموقع أو تجاوز حدود الاستخدام أو انتحال شخصية الغير.</li>
          <li>
            الالتزام بالاحترام في الحصص المباشرة والمحادثات؛ يحق للمدرس إخراج أي مشارك
            مسيء.
          </li>
          <li>عدم استخدام المنصة لأي غرض غير قانوني.</li>
        </ul>
      </LegalSection>

      <LegalSection title="٧. الحصص المباشرة والتسجيلات">
        <p>
          تُعقد الحصص المباشرة حسب الجدول الذي يضعه المدير. قد تُسجَّل الحصص لإتاحتها
          للطلاب المشتركين في المجموعة نفسها؛ وباشتراكك في المجموعة توافق على ذلك. قد
          تتغير المواعيد لظروف طارئة وسنبلغك بذلك عبر الموقع.
        </p>
      </LegalSection>

      <LegalSection title="٨. توافر الخدمة وحدود المسؤولية">
        <ul>
          <li>نبذل جهدنا لإتاحة الخدمة على مدار الساعة، وقد تحدث انقطاعات للصيانة أو لأسباب خارجة عن إرادتنا.</li>
          <li>
            المحتوى تعليمي مساعد ولا نضمن تحقيق درجة معينة في الاختبار.
          </li>
          <li>
            في حدود ما يسمح به القانون، لا تتجاوز مسؤوليتنا تجاهك إجمالي ما دفعته خلال
            الاثني عشر شهراً السابقة للمطالبة.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="٩. إنهاء الخدمة">
        <p>
          يمكنك التوقف عن استخدام الخدمة في أي وقت. يحق لنا تعليق أو إنهاء الحساب عند
          مخالفة هذه الشروط، دون استرداد في حالات المخالفة الجسيمة المذكورة في البند ٥
          و٦.
        </p>
      </LegalSection>

      <LegalSection title="١٠. التعديلات">
        <p>
          قد نعدّل هذه الشروط من وقت لآخر. ننشر النسخة المحدثة على هذه الصفحة مع تاريخ
          التحديث، ويُعد استمرارك في استخدام الخدمة موافقة على التعديل.
        </p>
      </LegalSection>

      <LegalSection title="١١. القانون المطبق">
        <p>
          تخضع هذه الشروط لقوانين {BUSINESS.governingLaw}، وتختص محاكمها بأي نزاع لم تتم
          تسويته ودياً. نشجعك على التواصل معنا أولاً لحل أي خلاف.
        </p>
      </LegalSection>

      <LegalSection title="١٢. تواصل معنا">
        <ContactBlock />
      </LegalSection>
    </LegalPage>
  );
}
