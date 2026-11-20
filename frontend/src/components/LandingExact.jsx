import { Fragment } from "react";
import { Link } from "react-router-dom";
import { whatsappHref } from "../legal/business";
import "./LandingExact.css";

const ICONS = {
  live: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="14" height="14" rx="2" />
      <path d="M16 10l6-3v10l-6-3" />
    </svg>
  ),
  group: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 20c0-2.5 1.5-4.5 4-4.5" />
    </svg>
  ),
  rec: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M10 9l5 3-5 3z" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-4-7.5L21 3v5h-5" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  cal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18M8 15h3" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  book: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M9 7h7M9 11h5" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" fill="currentColor" />
    </svg>
  ),
  wa: (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 22, height: 22 }}>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm4.5 12.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1.1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2z" />
    </svg>
  ),
};

const FEATURES = [
  { title: "حصص مباشرة وتفاعلية", text: "تتفاعل مع المعلم وتسأل وقت الحصة", icon: "live" },
  { title: "مجموعات صغيرة", text: "لا يتجاوز عدد المجموعة 10 طلاب", icon: "group" },
  { title: "كل الحصص مسجلة", text: "ترجع لها في أي وقت", icon: "rec" },
  { title: "معلمك معك 24 ساعة", text: "متابعة مستمرة عبر الواتساب", icon: "clock" },
  { title: "جدول مرن", text: "يناسب وقت كل طالب", icon: "cal" },
  { title: "واجبات واختبارات دورية", text: "تتابع مستواك أولاً بأول", icon: "check" },
  { title: "بنوك تجميعات محدثة", text: "أكثر من 8000 سؤال", icon: "book" },
];

const STEPS = [
  { n: "1", t: "احجز مقعدك في المجموعة", p: "سجّل حسابك وثبّت مكانك" },
  { n: "2", t: "يتواصل معك فريق الدعم", p: "لتحديد أفضل موعد يناسبك" },
  { n: "3", t: "أول أسبوع مجاناً", p: "يعني ما راح تدفع إلا بعد ما تجرّب" },
  { n: "4", t: "تدخل حصصك وتجرّب", p: "إذا عجبك الأسلوب والشرح تقدر تكمل" },
];

const SUBJECTS = [
  { c: "#5f8f2e", bg: "#f1f7e8", logo: "/subjects/math.png", title: "المنطق الرياضي والهندسة" },
  { c: "#6d28d9", bg: "#f3eefe", logo: "/subjects/physics.png", title: "علم الفيزياء" },
  { c: "#c0182f", bg: "#fdecee", logo: "/subjects/chem.png", title: "مقدمة في علم الكيمياء" },
  { c: "#c58a00", bg: "#fff6dc", logo: "/subjects/bio.png", title: "مقدمة في علم الأحياء" },
];

const FAQS = [
  {
    open: true,
    q: "هل الحصص مباشرة أو مسجلة؟",
    a: "الحصص مباشرة وتفاعلية مع المعلم، وكل حصة تُسجَّل وتقدر ترجع لها في أي وقت.",
  },
  { q: "كم عدد الطلاب في المجموعة؟", a: "المجموعات صغيرة ولا يتجاوز عددها 10 طلاب." },
  { q: "هل أقدر أجرّب قبل الاشتراك؟", a: "نعم، أول أسبوع مجاناً قبل ما تدفع." },
  { q: "هل الاشتراك يتجدد تلقائياً؟", a: "لا، الاشتراك مدفوع مقدماً ولا يتجدد تلقائياً." },
];

export default function LandingExact({ ctaTo = "/register", courseTo = "/login" }) {
  const wa = whatsappHref("مرحبا، أحتاج باقة مخصصة مع مرام");

  return (
    <div className="landing-exact">
      <section className="hero">
        <div className="ribbon">🔥 لا يفوتك عرض التسجيل المبكر</div>
        <div className="hero-row">
          <div className="hin">
            <span className="tag">
              <i className="dot" />
              التسجيل مفتوح الآن · المقاعد محدودة
            </span>
            <h1>
              تعبت من الحصص المسجلة؟ <em>معلمك معك</em> أولاً بأول
            </h1>
            <p>مع مرام صار التحصيلي أسهل. مو مجرد حصص، رحلة تعليم ومتابعة لين تحقق هدفك.</p>
            <div className="cta">
              <Link className="b1" to={ctaTo}>احجز مقعدك الآن ←</Link>
              <a className="b2" href="#ld-trial">جرّب الأسبوع التجريبي</a>
            </div>
            <div className="seats">
              <span className="pulse" />
              <b>تبقى 4 مقاعد فقط</b> في المجموعة القادمة
              <div className="mini"><i style={{ width: "60%" }} /></div>
            </div>
            <div className="trust">
              <span>✓ حصص مباشرة</span>
              <span>✓ مجموعات صغيرة</span>
              <span>✓ بنوك تجميعات</span>
            </div>
          </div>
          <div className="hvis" aria-hidden="true">
            <img src="/banner.png" alt="" decoding="async" fetchPriority="high" />
          </div>
        </div>
      </section>

      <div className="stats">
        <div className="st"><strong>+8000</strong><span>سؤال تجميعات</span></div>
        <div className="st"><strong>10</strong><span>طلاب كحد أقصى للمجموعة</span></div>
        <div className="st"><strong>24/7</strong><span>متابعة عبر الواتساب</span></div>
        <div className="st"><strong>∞</strong><span>اختبارات محاكية لا محدودة</span></div>
      </div>

      <div className="wrap">
        <div className="sh">
          <small>ليش مرام؟</small>
          <h2>مميزات دورة مرام</h2>
          <p>كل ما تحتاجه لتذاكر بإتقان وتصل لهدفك</p>
        </div>
        <div className="feats">
          {FEATURES.map((f) => (
            <div className="ft" key={f.title}>
              <div className="fi">{ICONS[f.icon]}</div>
              <b>{f.title}</b>
              <p>{f.text}</p>
            </div>
          ))}
          <Link className="ft hl" to={ctaTo}>
            <div className="fi">{ICONS.arrow}</div>
            <b>جاهز تبدأ؟</b>
            <p>انضم لمرام وابدأ من اليوم</p>
          </Link>
        </div>

        <div className="sh">
          <small>أربع خطوات بسيطة</small>
          <h2>كيف تبدأ مع مرام؟</h2>
        </div>
        <div className="steps">
          {STEPS.map((s, i) => (
            <Fragment key={s.n}>
              <div className="sp">
                <span className="n">{s.n}</span>
                <b>{s.t}</b>
                <p>{s.p}</p>
              </div>
              {i < STEPS.length - 1 ? <div className="ar">←</div> : null}
            </Fragment>
          ))}
        </div>

        <div className="offer" id="ld-trial">
          <div className="of-r">
            <span className="badge">⚡ عرض لفترة محدودة</span>
            <h2>استغل عرض التسجيل المبكر</h2>
            <p>سجّل الحين واحجز مقعدك قبل ما تكتمل المجموعات</p>
            <ul>
              <li>خصم <span dir="ltr">33%</span> على سعر الباقة</li>
              <li>إمكانية دفع مبلغ الدورة على 3 دفعات</li>
              <li>أولوية اختيار موعد المجموعة</li>
              <li>الدفع بعد الأسبوع التجريبي المجاني عند بداية الدورة</li>
            </ul>
            <div className="of-cta">
              <Link className="b1" to={ctaTo}>سجّل الحين واستفد من العرض ←</Link>
            </div>
          </div>
          <div className="of-l">
            <div className="coupon">
              <div className="burst">وفّر<br />الثلث!</div>
              <small>كوبون التسجيل المبكر</small>
              <div className="big"><span>خصم</span><strong dir="ltr">33%</strong></div>
              <div className="cl">على سعر الباقة</div>
              <div className="perf" />
              <div className="cb2">💳 وقسّطها على <b>3 دفعات</b></div>
            </div>
          </div>
        </div>

        <div className="sh">
          <small>جرّب مجاناً</small>
          <h2>تصفّح حسب المادة</h2>
          <p>شاهد درساً مجانياً من كل مادة قبل ما تشترك</p>
        </div>
        <div className="subj">
          {SUBJECTS.map((s) => (
            <div className="sc" key={s.title} style={{ "--c": s.c, "--bg": s.bg }}>
              <div className="sc-top"><img src={s.logo} alt="" /></div>
              <div className="sc-b">
                <span className="free">درس مجاني</span>
                <b>{s.title}</b>
                <div className="meta">
                  <span>فيديو</span><span>واجب</span><span>10 أسئلة تجميع</span>
                </div>
                <div className="acts">
                  <Link className="pl" to={courseTo}>{ICONS.play}شاهد الدرس المجاني</Link>
                  <Link className="en" to={courseTo}>ادخل الدورة ←</Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="sh">
          <small>عندك سؤال؟</small>
          <h2>الأسئلة الشائعة</h2>
        </div>
        <div className="faq">
          {FAQS.map((f) => (
            <details key={f.q} className={`q${f.open ? " open" : ""}`} open={Boolean(f.open)}>
              <summary>
                <b>
                  {f.q}
                  <i>{f.open ? "−" : "+"}</i>
                </b>
              </summary>
              {f.a ? <p>{f.a}</p> : null}
            </details>
          ))}
        </div>

        <div className="final">
          <div className="fi2">🎯</div>
          <h2>محتاج باقة مخصصة لك؟</h2>
          <p>تواصل معنا ونضمن لك أحسن باقة تناسبك</p>
          <a className="b1 sup" href={wa} target="_blank" rel="noreferrer">
            {ICONS.wa}
            تواصل مع الدعم الفني
          </a>
        </div>
      </div>
    </div>
  );
}
