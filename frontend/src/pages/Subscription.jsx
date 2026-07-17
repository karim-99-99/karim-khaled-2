import { useEffect, useState } from "react";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";

const PLANS = [
  { id: "monthly", label: "شهري" },
  { id: "quarterly", label: "فصلي" },
  { id: "yearly", label: "سنوي" },
];
const METHODS = [
  { id: "card", label: "بطاقة بنكية" },
  { id: "vodafone_cash", label: "فودافون كاش" },
  { id: "wallet", label: "محفظة إلكترونية" },
];

export default function Subscription() {
  const { refreshUser } = useAuth();
  const [state, setState] = useState(null);
  const [plan, setPlan] = useState("yearly");
  const [method, setMethod] = useState("card");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    client.get("/subscription/").then((res) => setState(res.data));
  }
  useEffect(load, []);

  async function checkout() {
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
        </div>
      )}

      <h3 style={{ marginBottom: 16 }}>اختر الباقة</h3>
      <div className="grid grid-3" style={{ maxWidth: 600, marginBottom: 24 }}>
        {PLANS.map((p) => (
          <div key={p.id} className="card"
            style={{ padding: 16, textAlign: "center", cursor: "pointer",
              border: plan === p.id ? "2px solid var(--primary)" : undefined }}
            onClick={() => setPlan(p.id)}>
            <strong>{p.label}</strong>
          </div>
        ))}
      </div>

      <p style={{ marginBottom: 12, fontWeight: 600 }}>بوابة الدفع</p>
      <div className="filter-row">
        {METHODS.map((m) => (
          <span key={m.id} className={`chip ${method === m.id ? "active" : ""}`} onClick={() => setMethod(m.id)}>
            {m.label}
          </span>
        ))}
      </div>

      {msg && <div className="banner" style={{ marginTop: 16 }}>{msg}</div>}
      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={checkout} disabled={busy}>
        {busy ? "…" : "إتمام الدفع والاشتراك"}
      </button>
    </div>
  );
}
