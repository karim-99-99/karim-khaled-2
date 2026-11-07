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
  silver: [
    "كل الدروس المرئية في المواد الأربع",
    "تجميعات الأسئلة مع الحلول والشرح",
    "اختبارات المحاكاة وتقارير النتائج",
    "الجدول الذكي وخطة المذاكرة اليومية",
  ],
  gold: [
    "كل مزايا الباقة الفضية",
    "الحصص المباشرة مع المدرس في مجموعة صغيرة",
    "متابعة المدرس للنتائج والواجبات",
    "اختبارات يضعها المدرس للمجموعة",
  ],
};

export const FEATURED_PLAN = "gold";

export function currencyName(code) {
  return CURRENCY_NAMES[code] || code;
}

export function formatAmount(price) {
  const n = Number(price);
  return Number.isFinite(n)
    ? n.toLocaleString("ar-EG", { maximumFractionDigits: 2 })
    : String(price);
}

/** Plain-text price (buttons / attributes). SAR uses the Unicode riyal sign. */
export function formatPriceText(price, currency) {
  const amount = formatAmount(price);
  if (String(currency).toUpperCase() === "SAR") {
    return `⃁ ${amount}`;
  }
  return `${amount} ${currencyName(currency)}`;
}

export async function fetchPlans() {
  const { data } = await client.get("/subscription/plans/");
  return data;
}
