/**
 * Business facts shown on the public pages Stripe reviews
 * (About, Pricing, Terms, Privacy, Refund policy, Contact, footer).
 *
 * Fill the fields marked «يُستكمل» with the real registered details before
 * submitting the Stripe application. Keep the name identical to the one on
 * the Stripe account and the card statement descriptor.
 */
export const BUSINESS = {
  brand: "زاد التحصيلي",
  brandLatin: "Zad Al-Tahsili",
  tagline: "زادك للمئوية",
  // Registered legal name as it appears on Stripe (يُستكمل)
  legalName: "زاد التحصيلي للتعليم الإلكتروني",
  // Appears on the student's card statement (يُستكمل — must match Stripe)
  statementDescriptor: "ZAD ALTAHSILI",
  website: "https://maramedu.com",
  supportEmail: "support@zad-altahsili.com",
  supportPhone: "+20 10 0000 0000",
  supportWhatsapp: "+20 10 0000 0000",
  supportHours: "يومياً من ١٠ صباحاً حتى ١٠ مساءً (بتوقيت القاهرة)",
  supportHoursEn: "daily, 10:00–22:00 Cairo time",
  responseTime: "خلال يوم عمل واحد",
  // Registered address (يُستكمل)
  address: "القاهرة، جمهورية مصر العربية",
  country: "مصر",
  governingLaw: "جمهورية مصر العربية",
  refundWindowDays: 7,
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
