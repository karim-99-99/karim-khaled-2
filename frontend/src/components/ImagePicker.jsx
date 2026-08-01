/** Small image picker that stores a compressed data-URL (or clears it). */
export default function ImagePicker({ value, onChange, label = "صورة" }) {
  function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.alert("اختر ملف صورة فقط");
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      window.alert("حجم الصورة كبير — اختر صورة أصغر من 1.5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  return (
    <div style={{ marginTop: 6, marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer", margin: 0 }}>
          {value ? `تغيير ${label}` : `إضافة ${label}`}
          <input type="file" accept="image/*" hidden onChange={onFile} />
        </label>
        {value && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange("")}>
            حذف الصورة
          </button>
        )}
      </div>
      {value && (
        <img
          src={value}
          alt=""
          style={{
            display: "block",
            marginTop: 8,
            maxWidth: "100%",
            maxHeight: 180,
            borderRadius: 8,
            border: "1px solid var(--border)",
          }}
        />
      )}
    </div>
  );
}
