import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import TelegramLoginButton from "../components/TelegramLoginButton";
import "../styles/auth-exact.css";

const SA_REGIONS = [
  "الرياض",
  "مكة المكرمة",
  "المدينة المنورة",
  "القصيم",
  "الشرقية",
  "عسير",
  "تبوك",
  "حائل",
  "الحدود الشمالية",
  "جازان",
  "نجران",
  "الباحة",
  "الجوف",
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    guardian_phone: "",
    region: "",
    city: "",
    school_name: "",
    school_type: "government",
    gender: "male",
    email: "",
    password: "",
  });
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e) {
    e.preventDefault();
    setErrors({});
    if (!agreed) {
      setErrors({ agree: "يلزم الموافقة على الشروط وسياسة الخصوصية للمتابعة." });
      return;
    }
    if (!form.region) {
      setErrors({ region: "المنطقة مطلوبة" });
      return;
    }
    if (!form.city.trim()) {
      setErrors({ city: "المدينة مطلوبة" });
      return;
    }
    if (!form.school_name.trim()) {
      setErrors({ school_name: "اسم المدرسة مطلوب" });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        full_name: `${form.first_name} ${form.last_name}`.trim(),
        phone: form.phone,
        guardian_phone: form.guardian_phone || "",
        region: form.region,
        city: form.city.trim(),
        school_name: form.school_name.trim(),
        school_type: form.school_type,
        gender: form.gender,
        email: form.email,
        password: form.password,
      };
      await register(payload);
      navigate("/");
    } catch (err) {
      if (err?.message === "ACCOUNT_CREATED_LOGIN_FAILED") {
        setErrors({
          detail:
            "تم إنشاء الحساب. الرجاء تسجيل الدخول الآن (قد يحتاج السيرفر دقيقة للاستيقاظ).",
        });
      } else if (!err.response) {
        setErrors({
          detail: "تعذّر الاتصال بالسيرفر. انتظر 30–60 ثانية ثم أعد المحاولة.",
        });
      } else {
        const data = err.response.data || {};
        const flat = {};
        for (const [k, v] of Object.entries(data)) {
          flat[k] = Array.isArray(v) ? v.join(" ") : String(v);
        }
        if (!flat.detail && !Object.keys(flat).length) {
          flat.detail = "تعذّر إنشاء الحساب";
        }
        setErrors(flat);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-exact">
      <div className="auth-panel card form-card">
        <h2>إنشاء حساب</h2>
        <p className="auth-sub">خطوة البيانات الأساسية · جرّب الأسبوع الأول مجاناً</p>

        <TelegramLoginButton
          label="إنشاء حساب عبر تيليجرام"
          onSuccess={() => navigate("/")}
        />

        <div className="auth-or">
          <i />
          أو بالبريد
          <i />
        </div>

        <form onSubmit={submit}>
          <div className="form-row-2">
            <div className="form-group">
              <label>الاسم الأول *</label>
              <input
                className="form-control"
                value={form.first_name}
                onChange={(e) => set("first_name", e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>اسم العائلة *</label>
              <input
                className="form-control"
                value={form.last_name}
                onChange={(e) => set("last_name", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>رقم الجوال *</label>
            <div className="phone-row">
              <span className="phone-cc" dir="ltr">
                +966
              </span>
              <input
                className="form-control"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="5X XXX XXXX"
                dir="ltr"
                required
              />
            </div>
            {errors.phone && <div className="error-text">{errors.phone}</div>}
          </div>

          <div className="form-group">
            <label>
              رقم جوال ولي الأمر <span className="opt">(اختياري)</span>
            </label>
            <div className="phone-row">
              <span className="phone-cc" dir="ltr">
                +966
              </span>
              <input
                className="form-control"
                value={form.guardian_phone}
                onChange={(e) => set("guardian_phone", e.target.value)}
                placeholder="5X XXX XXXX"
                dir="ltr"
              />
            </div>
            <small className="hint">إذا أضفته، تصله تقارير المستوى والحضور</small>
            {errors.guardian_phone && (
              <div className="error-text">{errors.guardian_phone}</div>
            )}
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>المنطقة *</label>
              <select
                className="form-control"
                value={form.region}
                onChange={(e) => set("region", e.target.value)}
                required
              >
                <option value="">اختر المنطقة</option>
                {SA_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {errors.region && <div className="error-text">{errors.region}</div>}
            </div>
            <div className="form-group">
              <label>المدينة *</label>
              <input
                className="form-control"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                required
              />
              {errors.city && <div className="error-text">{errors.city}</div>}
            </div>
          </div>

          <div className="form-group">
            <label>اسم المدرسة *</label>
            <input
              className="form-control"
              value={form.school_name}
              onChange={(e) => set("school_name", e.target.value)}
              required
            />
            {errors.school_name && (
              <div className="error-text">{errors.school_name}</div>
            )}
          </div>

          <div className="form-group">
            <label>نوع المدرسة *</label>
            <div className="seg-pills">
              <button
                type="button"
                className={`seg-pill${form.school_type === "government" ? " on" : ""}`}
                onClick={() => set("school_type", "government")}
              >
                حكومية
              </button>
              <button
                type="button"
                className={`seg-pill${form.school_type === "private" ? " on" : ""}`}
                onClick={() => set("school_type", "private")}
              >
                أهلية
              </button>
            </div>
            {errors.school_type && (
              <div className="error-text">{errors.school_type}</div>
            )}
          </div>

          <div className="form-group">
            <label>الجنس *</label>
            <div style={{ display: "flex", gap: 16 }}>
              <label style={{ fontWeight: 400 }}>
                <input
                  type="radio"
                  checked={form.gender === "male"}
                  onChange={() => set("gender", "male")}
                />{" "}
                ذكر
              </label>
              <label style={{ fontWeight: 400 }}>
                <input
                  type="radio"
                  checked={form.gender === "female"}
                  onChange={() => set("gender", "female")}
                />{" "}
                أنثى
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>البريد الإلكتروني *</label>
            <input
              className="form-control"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              required
            />
            {errors.email && <div className="error-text">{errors.email}</div>}
          </div>

          <div className="form-group">
            <label>كلمة المرور *</label>
            <input
              className="form-control"
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              required
            />
            {errors.password && <div className="error-text">{errors.password}</div>}
          </div>

          <div className="form-group">
            <label className="consent-row">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <span>
                أوافق على{" "}
                <Link to="/terms" target="_blank" rel="noreferrer">
                  الشروط والأحكام
                </Link>{" "}
                و
                <Link to="/privacy" target="_blank" rel="noreferrer">
                  سياسة الخصوصية
                </Link>{" "}
                و
                <Link to="/refund-policy" target="_blank" rel="noreferrer">
                  سياسة الاسترداد
                </Link>
                .
              </span>
            </label>
            {errors.agree && <div className="error-text">{errors.agree}</div>}
          </div>
          {errors.detail && <div className="error-text">{errors.detail}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "…" : "إنشاء حساب"}
          </button>
        </form>

        <p className="auth-foot">
          لديك حساب؟ <Link to="/login">تسجيل الدخول</Link>
        </p>
      </div>
    </div>
  );
}
