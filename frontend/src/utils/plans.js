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
    "صالح حتى نهاية اختبار التحصيلي",
    "دروس مسجّلة في المواد الأربع",
    "بنوك أسئلة مع الحلول",
    "اختبارات محاكاة وتقارير",
    "دورة المراجعة النهائية",
  ],
  gold: [
    "كل مزايا الباقة الفضية",
    "حصص مباشرة بمجموعات صغيرة",
    "جروب واتساب تواصل مباشر مع المدرس",
    "متابعة المدرس للنتائج والواجبات",
    "اختبارات مخصصة للمجموعة",
    "دورة المراجعة النهائية",
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
