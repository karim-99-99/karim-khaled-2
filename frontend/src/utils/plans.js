import client from "../api/client";

const CURRENCY_NAMES = {
  SAR: "ريال سعودي",
  EGP: "جنيه مصري",
  USD: "دولار أمريكي",
  AED: "درهم إماراتي",
  KWD: "دينار كويتي",
  EUR: "يورو",
};

export const PLAN_FEATURES = {
  monthly: ["كل الدروس المرئية", "بنك الأسئلة مع الحلول", "اختبارات المحاكاة", "الجدول الذكي"],
  quarterly: ["كل مزايا الباقة الشهرية", "الحصص المباشرة مع المدرس", "متابعة المدرس للنتائج"],
  yearly: ["كل مزايا الباقة الفصلية", "تغطية العام الدراسي كاملاً", "أفضل سعر لليوم الواحد"],
};

export function currencyName(code) {
  return CURRENCY_NAMES[code] || code;
}

export function formatPrice(price, currency) {
  const n = Number(price);
  const amount = Number.isFinite(n)
    ? n.toLocaleString("ar-EG", { maximumFractionDigits: 2 })
    : String(price);
  return `${amount} ${currencyName(currency)}`;
}

export async function fetchPlans() {
  const { data } = await client.get("/subscription/plans/");
  return data;
}
