import { Link } from "react-router-dom";
import LegalPage, { ContactBlock, LegalSection } from "../../components/LegalPage";
import { BUSINESS } from "../../legal/business";

export default function Privacy() {
  return (
    <LegalPage
      title="سياسة الخصوصية"
      titleEn="Privacy policy"
      intro="نوضح هنا البيانات التي نجمعها، ولماذا، ومع من نشاركها، وكيف تتحكم فيها."
      englishSummary={
        <>
          <ul>
            <li>
              Data controller: {BUSINESS.legalName} ({BUSINESS.brandLatin}),{" "}
              {BUSINESS.address}, {BUSINESS.supportEmail}.
            </li>
            <li>
              We collect account data (name, phone, email, gender), learning activity
              (answers, scores, watched lessons, attendance), device/log data and
              payment status. Card details are entered directly with{" "}
              {BUSINESS.paymentProcessor}; we only receive a payment reference, the
              amount and the last four digits.
            </li>
            <li>
              We use the data to provide the service, personalise study plans, show a
              name watermark on videos (anti-piracy), process payments and refunds,
              provide support and meet legal obligations. We do not sell personal
              data.
            </li>
            <li>
              Processors: Stripe (payments), Vercel and Render (hosting), Neon
              (database), Bunny Stream (video), BiggerBlueButton (live classes),
              Telegram (optional sign-in).
            </li>
            <li>
              You can access, correct or delete your data by emailing{" "}
              {BUSINESS.supportEmail}. We keep account data while the account is active
              and payment records as long as the law requires.
            </li>
          </ul>
        </>
      }
    >
      <LegalSection title="١. من المسؤول عن بياناتك">
        <p>
          المسؤول عن معالجة البيانات هو {BUSINESS.legalName} ({BUSINESS.brandLatin})،{" "}
          {BUSINESS.address}. للتواصل بشأن الخصوصية:{" "}
          <a href={`mailto:${BUSINESS.supportEmail}`} dir="ltr">{BUSINESS.supportEmail}</a>.
        </p>
      </LegalSection>

      <LegalSection title="٢. البيانات التي نجمعها">
        <ul>
          <li>
            <strong>بيانات الحساب:</strong> الاسم، رقم الهاتف، البريد الإلكتروني، الجنس،
            كلمة المرور (مشفّرة).
          </li>
          <li>
            <strong>بيانات التعلّم:</strong> الدروس التي شاهدتها، إجاباتك ودرجاتك،
            الأسئلة المحفوظة، حضور الحصص، خطة المذاكرة.
          </li>
          <li>
            <strong>بيانات الدفع:</strong> الباقة، المبلغ، العملة، تاريخ الدفع، مرجع
            العملية، وآخر أربعة أرقام من البطاقة فقط. تُدخل بيانات البطاقة مباشرة لدى
            مزوّد الدفع {BUSINESS.paymentProcessor} ولا تمر عبر خوادمنا.
          </li>
          <li>
            <strong>بيانات تقنية:</strong> عنوان IP، نوع الجهاز والمتصفح، سجلات الدخول،
            وملفات تعريف الارتباط أو التخزين المحلي اللازمة لتسجيل الدخول.
          </li>
          <li>
            <strong>تسجيل الدخول عبر تيليجرام (اختياري):</strong> المعرّف والاسم اللذان
            يشاركهما تيليجرام معنا عند موافقتك.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="٣. لماذا نستخدم بياناتك">
        <ul>
          <li>إنشاء حسابك وتقديم الدروس والاختبارات والحصص المباشرة.</li>
          <li>تخصيص خطة المذاكرة وعرض نتائجك وتقدّمك.</li>
          <li>
            عرض علامة مائية باسمك على الفيديوهات لحماية المحتوى من إعادة النشر.
          </li>
          <li>معالجة المدفوعات والاستردادات ومنع الاحتيال.</li>
          <li>الرد على استفساراتك وتقديم الدعم.</li>
          <li>إشعارك بمواعيد الحصص والتحديثات المهمة للخدمة.</li>
          <li>الالتزام بالمتطلبات القانونية والمحاسبية.</li>
        </ul>
        <p>لا نبيع بياناتك الشخصية ولا نستخدمها لإعلانات طرف ثالث.</p>
      </LegalSection>

      <LegalSection title="٤. مع من نشارك البيانات">
        <p>نشارك الحد الأدنى اللازم مع مزوّدي خدمات يعملون لحسابنا بموجب اتفاقيات حماية:</p>
        <ul>
          <li>
            <strong>Stripe</strong> لمعالجة المدفوعات (
            <a href="https://stripe.com/privacy" target="_blank" rel="noreferrer" dir="ltr">
              stripe.com/privacy
            </a>
            ).
          </li>
          <li><strong>Vercel</strong> و<strong>Render</strong> لاستضافة الموقع والخوادم.</li>
          <li><strong>Neon</strong> لقاعدة البيانات.</li>
          <li><strong>Bunny Stream</strong> لبث الفيديوهات بروابط محمية.</li>
          <li><strong>BiggerBlueButton</strong> لعقد الحصص المباشرة وتسجيلها.</li>
          <li><strong>Telegram</strong> عند اختيارك تسجيل الدخول عبره.</li>
          <li>المدرس والمدير داخل المنصة يرون اسمك ونتائجك وحضورك ضمن مجموعتك فقط.</li>
          <li>الجهات الرسمية عند وجود التزام قانوني.</li>
        </ul>
      </LegalSection>

      <LegalSection title="٥. مدة الاحتفاظ بالبيانات">
        <ul>
          <li>بيانات الحساب والتعلّم: طوال فترة نشاط الحساب، وتُحذف أو تُخفى هويتها خلال ١٢ شهراً من طلب الحذف.</li>
          <li>سجلات الدفع: للمدة التي تفرضها القوانين الضريبية والمحاسبية.</li>
          <li>تسجيلات الحصص: لمدة العام الدراسي ثم تُحذف.</li>
        </ul>
      </LegalSection>

      <LegalSection title="٦. حقوقك">
        <p>
          يحق لك الاطلاع على بياناتك وتصحيحها وطلب حذفها، والاعتراض على بعض أوجه
          المعالجة، وسحب موافقتك متى كانت المعالجة قائمة عليها. أرسل طلبك إلى{" "}
          <a href={`mailto:${BUSINESS.supportEmail}`} dir="ltr">{BUSINESS.supportEmail}</a>{" "}
          وسنرد {BUSINESS.responseTime}.
        </p>
      </LegalSection>

      <LegalSection title="٧. الأمان">
        <p>
          نستخدم الاتصال المشفّر (HTTPS) وتشفير كلمات المرور وصلاحيات وصول محدودة. بيانات
          البطاقات لا تُخزَّن لدينا إطلاقاً وتُعالج لدى مزوّد دفع معتمد وفق معيار PCI DSS.
        </p>
      </LegalSection>

      <LegalSection title="٨. خصوصية الأطفال">
        <p>
          الخدمة موجهة لطلاب المرحلة الثانوية. المستخدم الأصغر من {BUSINESS.minAge} عاماً
          يشترك بموافقة ولي الأمر ومن خلاله. إذا علمنا بجمع بيانات طفل دون موافقة ولي
          أمره نحذفها فوراً.
        </p>
      </LegalSection>

      <LegalSection title="٩. ملفات تعريف الارتباط والتخزين المحلي">
        <p>
          نستخدم التخزين المحلي في المتصفح لحفظ جلسة تسجيل الدخول وتفضيلات العرض فقط.
          لا نستخدم ملفات تتبع إعلانية.
        </p>
      </LegalSection>

      <LegalSection title="١٠. التعديلات">
        <p>
          عند تعديل هذه السياسة ننشر النسخة الجديدة هنا مع تاريخ التحديث، ونبلغك داخل
          الموقع إذا كان التعديل جوهرياً.
        </p>
      </LegalSection>

      <LegalSection title="١١. تواصل معنا">
        <ContactBlock />
        <p style={{ marginTop: 12 }}>
          راجع أيضاً <Link to="/terms"><strong>الشروط والأحكام</strong></Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
