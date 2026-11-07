/**
 * Business facts shown on the public pages Stripe reviews
 * (About, Pricing, Terms, Privacy, Refund policy, Contact, footer).
 *
 * Keep legalName and statementDescriptor identical to the Stripe account.
 */
export const BUSINESS = {
  brand: "مرام التحصيلي",
  brandLatin: "Maram Edu",
  tagline: "للتحصيلي بإتقان",
  // Registered legal name as it appears on Stripe
  legalName: "Maram Education",
  // Appears on the student's card statement (must match Stripe)
  statementDescriptor: "Maram Edu",
  website: "https://maramedu.com",
  supportEmail: "Maramedu@icloud.com",
  supportEmailAlt: "Keemkh59@icloud.com",
  supportPhone: "+20 15 0568 8548",
  supportWhatsapp: "+20 15 0568 8548",
  supportHours: "يومياً من ١٠ صباحاً حتى ١٠ مساءً (بتوقيت القاهرة)",
  supportHoursEn: "daily, 10:00–22:00 Cairo time",
  responseTime: "خلال يوم عمل واحد",
  // Registered address (يُستكمل بالعنوان المسجّل في Stripe)
  address: "جمهورية مصر العربية",
  country: "مصر",
  governingLaw: "جمهورية مصر العربية",
  refundWindowDays: 7,
  // Refund allowed only while this share of the paid content is still unused.
  refundMaxUsagePercent: 10,
  refundProcessingDays: "٥ إلى ١٠ أيام عمل",
  refundProcessingDaysEn: "5–10 business days",
  minAge: 13,
  acceptedCards: ["Visa", "Mastercard", "mada"],
  paymentProcessor: "Stripe",
  lastUpdated: "٧ نوفمبر ٢٠٢٦",
};

export const LEGAL_LINKS = [
  { to: "/about", label: "من نحن" },
  { to: "/pricing", label: "الأسعار والباقات" },
  { to: "/terms", label: "الشروط والأحكام" },
  { to: "/privacy", label: "سياسة الخصوصية" },
  { to: "/refund-policy", label: "سياسة الاسترداد والإلغاء" },
  { to: "/contact", label: "اتصل بنا" },
];
