import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { BUSINESS } from "../legal/business";
import { PLAN_FEATURES, currencyName, fetchPlans, formatPrice } from "../utils/plans";

const METHODS = [
  { id: "card", label: "بطاقة بنكية" },
  { id: "vodafone_cash", label: "فودافون كاش" },
  { id: "wallet", label: "محفظة إلكترونية" },
];

export default function Subscription() {
  const { refreshUser } = useAuth();
  const [state, setState] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [plan, setPlan] = useState("yearly");
  const [method, setMethod] = useState("card");
  const [agreed, setAgreed] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    client.get("/subscription/").then((res) => setState(res.data));
  }
  useEffect(() => {
    load();
    fetchPlans()
      .then(setCatalog)
      .catch(() => setCatalog({ plans: [], currency: "" }));
  }, []);

  const plans = catalog?.plans || [];
  const selected = plans.find((p) => p.id === plan) || null;

  async function checkout() {
    if (!agreed) {
      setMsg("يلزم الموافقة على الشروط وسياسة الاسترداد قبل الدفع.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const { data } = await client.post("/subscription/checkout/", { plan, method });
      setMsg(data.note || "تم التفعيل");
      await refreshUser();
      load();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر إتمام الدفع");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 32, marginBottom: 24 }}>اشتراكي</h1>

      {state?.active && (
        <div className="card" style={{ padding: 24, marginBottom: 24, border: "2px solid var(--success)" }}>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>الاشتراك نشط</h2>
          <p style={{ color: "var(--text-muted)" }}>الباقة: {state.subscription.plan}</p>
          <p style={{ color: "var(--text-muted)" }}>ينتهي في: {state.subscription.end_date}</p>
          <p style={{ fontWeight: 700, color: "var(--primary)", marginTop: 8 }}>
            متبقي: {state.subscription.days_remaining} يوم
          </p>
          <p style={{ color: "var(--text-muted)", marginTop: 8, fontSize: 14 }}>
            الاشتراك لا يتجدد تلقائياً. أي باقة جديدة تُضاف بعد تاريخ الانتهاء الحالي.
          </p>
        </div>
      )}

      <h3 style={{ marginBottom: 16 }}>اختر الباقة</h3>
      <div className="grid grid-3" style={{ maxWidth: 760, marginBottom: 24 }}>
        {plans.map((p) => (
          <div
            key={p.id}
            className="card"
            role="button"
            tabIndex={0}
            style={{
              padding: 18,
              textAlign: "center",
              cursor: "pointer",
              border: plan === p.id ? "2px solid var(--primary)" : undefined,
            }}
            onClick={() => setPlan(p.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setPlan(p.id);
            }}
          >
            <strong style={{ fontSize: 18 }}>{p.label}</strong>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--primary)", marginTop: 6 }}>
              {formatPrice(p.price, p.currency)}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              لمدة {p.days} يوماً · دفعة واحدة
            </div>
            <ul style={{ textAlign: "start", fontSize: 13, marginTop: 10, paddingInlineStart: 18 }}>
              {(PLAN_FEATURES[p.id] || []).map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ))}
        {catalog && plans.length === 0 && (
          <div className="banner">تعذّر تحميل الأسعار. حاول مرة أخرى بعد قليل.</div>
        )}
        {!catalog && <div className="spinner">جاري تحميل الباقات…</div>}
      </div>

      <p style={{ marginBottom: 12, fontWeight: 600 }}>بوابة الدفع</p>
      <div className="filter-row">
        {METHODS.map((m) => (
          <span key={m.id} className={`chip ${method === m.id ? "active" : ""}`} onClick={() => setMethod(m.id)}>
            {m.label}
          </span>
        ))}
      </div>

      {selected && (
        <div className="card checkout-summary">
          <div className="checkout-summary__row">
            <span>الباقة</span>
            <strong>{selected.label} ({selected.days} يوماً)</strong>
          </div>
          <div className="checkout-summary__row">
            <span>المبلغ المستحق الآن</span>
            <strong>{formatPrice(selected.price, selected.currency)}</strong>
          </div>
          <div className="checkout-summary__row">
            <span>العملة</span>
            <strong>{currencyName(selected.currency)} ({selected.currency})</strong>
          </div>
          <div className="checkout-summary__row">
            <span>التجديد</span>
            <strong>لا يتجدد تلقائياً</strong>
          </div>
          <div className="checkout-summary__row">
            <span>يظهر في كشف الحساب باسم</span>
            <strong dir="ltr">{BUSINESS.statementDescriptor}</strong>
          </div>
          <p className="checkout-summary__note">
            الأسعار شاملة الضرائب المطبقة. الدفع آمن عبر {BUSINESS.paymentProcessor} ولا نخزّن
            بيانات بطاقتك. استرداد كامل خلال {BUSINESS.refundWindowDays} أيام عند الاستخدام
            المحدود حسب <Link to="/refund-policy">سياسة الاسترداد</Link>.
          </p>
        </div>
      )}

      <label className="consent-row" style={{ marginTop: 16 }}>
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>
          قرأت وأوافق على <Link to="/terms" target="_blank" rel="noreferrer">الشروط والأحكام</Link> و
          <Link to="/refund-policy" target="_blank" rel="noreferrer">سياسة الاسترداد والإلغاء</Link>.
        </span>
      </label>

      {msg && <div className="banner" style={{ marginTop: 16 }}>{msg}</div>}
      <button
        className="btn btn-primary"
        style={{ marginTop: 16 }}
        onClick={checkout}
        disabled={busy || !selected}
      >
        {busy
          ? "…"
          : selected
            ? `ادفع ${formatPrice(selected.price, selected.currency)} واشترك`
            : "إتمام الدفع والاشتراك"}
      </button>
    </div>
  );
}
