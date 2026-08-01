# زاد التحصيلي — Full Mockup Documentation

Extracted from:
- [brand-board.html](brand-board.html) — Visual identity board (logo, colors, rules)
- [canva-mockups.html](canva-mockups.html) — Desktop / Laptop (1440×1024)
- [canva-mockups-mobile.html](canva-mockups-mobile.html) — Phone (375×812)
- [canva-mockups-tablet.html](canva-mockups-tablet.html) — Tablet (768×1024)

Logo asset: [brand/logo-zad-altahsili.png](brand/logo-zad-altahsili.png)

Subject logos: [brand/subjects/](brand/subjects/) · Canva themes: [canva-subject-themes.html](canva-subject-themes.html)

---

## Subject themes (CSS only — not 4 websites)

When a student opens a subject route, `Layout` sets `html[data-subject]` and swaps the header logo. Same pages/routes; only CSS variables change.

| Subject | `data-subject` | Primary | Accent | Logo |
|---|---|---|---|---|
| رياضيات | `math` | `#6B9B2D` | `#D4A017` | `subjects/math.png` |
| فيزياء | `physics` | `#7B3FA0` | `#D4A84B` | `subjects/physics.png` |
| كيمياء | `chem` | `#C41E3A` | `#D4A017` | `subjects/chem.png` |
| أحياء | `bio` | `#E6B006` | `#F5C518` | `subjects/bio.png` |

Outside subject routes the default brand (Royal Blue + Gold) stays active.


---

## 1. Project Overview

| Property | Value |
|---|---|
| **Platform name** | زاد التحصيلي (Zad Al-Tahsili) |
| **Tagline** | زادك للمئوية |
| **Purpose** | Canva-ready HTML mockups for screenshot import |
| **Language** | Arabic (`lang="ar"`, `dir="rtl"`) |
| **Subjects** | رياضيات، فيزياء، كيمياء، أحياء |
| **Usage** | Open in browser at 100% zoom → screenshot each frame → upload to Canva |

### File Cross-References
Each mockup file links to the other device variants and to the brand board.

---

## 2. Design System

### 2.1 Color Tokens (from logo)

| Token | Hex | Usage |
|---|---|---|
| `--primary` | `#0045AD` | Royal blue — brand, headers, nav active, primary UI |
| `--primary-dark` | `#003388` | Hover, hero gradient end |
| `--primary-light` | `#E5EEFF` | Active backgrounds, selected answers |
| `--accent` | `#FFC400` | Gold — CTAs only (ابدأ، اشترك، رابط الحصة) |
| `--accent-dark` | `#E6B000` | Accent hover |
| `--accent-soft` | `#FFF6D6` | Soft gold highlights / notes |
| `--bg` | `#F7F9FC` / `#F8FAFC` | Page background |
| `--surface` | `#FFFFFF` | Cards, headers |
| `--border` | `#E2E8F0` | Borders, dividers |
| `--text` | `#0F172A` | Primary text |
| `--text-muted` | `#64748B` | Secondary text |
| `--success` | `#16A34A` | Correct / live / active sub |
| `--error` | `#DC2626` | Wrong answers |
| `--warning` | `#F59E0B` | Timer / warnings |

### 2.2 Typography
- **Fonts:** Cairo (400, 600, 700) + Tajawal
- **Direction:** RTL throughout
- **Logo:** Full image `brand/logo-zad-altahsili.png` in header (not letter mark)

### 2.3 Button Hierarchy
1. **Gold accent** — primary call to action
2. **Royal blue** — secondary important actions / navigation emphasis
3. **White + border** — cancel / back / tertiary

### 2.4 Border Radius
- `--radius-sm`: 8px
- `--radius-md`: 12px
- `--radius-lg`: 16px
- Chips: 999px (pill)

### 2.5 Frame Dimensions

| Breakpoint | Width | Height | Style |
|---|---|---|---|
| Laptop | 1440px | 1024px | 8px radius |
| Tablet | 768px | 1024px | 12px radius |
| Phone | 375px | 812px | 24px radius + dark bezel |

---

## 3. Pages Covered (all devices)

1. الرئيسية  
2. الدورات / اختيار المادة  
3. مسارات المادة  
4. تأسيس — قائمة الدروس  
5. درس التأسيس  
6. تجميعات  
7. اختبارات (محاكي / مدرس)  
8. المحاكي الشخصي  
9. اختبار المدرس  
10. شاشة الاختبار  
11. النتائج  
12. مراجعة اختبار  
13. جدول الحصص  
14. اشتراكي  
15. تسجيل الدخول  
16. إنشاء حساب  

---

## 4. Canva Import Workflow

1. Open [brand-board.html](brand-board.html) → screenshot the board for your Canva brand page.
2. Open [canva-mockups.html](canva-mockups.html) at **100% zoom** → screenshot each labeled frame.
3. Repeat for tablet and mobile files.
4. In Canva: create a file **«زاد التحصيلي — UI Kit»** with 3 sections (Laptop / Tablet / Phone).
5. Upload screenshots in order 01–16.
6. Add brand colors as Canva Brand Kit colors: `#0045AD`, `#FFC400`, `#FFFFFF`, `#0F172A`.

---

## 5. Global Navigation

### Desktop / Tablet Top Nav
الرئيسية · دورات · نتائج · جدول الحصص · اشتراكي

### Mobile Bottom Nav
الرئيسية · دورات · نتائج · جدول · اشتراكي

---

## 6. Next Step (implementation)

After Canva approval, apply the same tokens to `frontend/src/index.css` and replace the text logo in `Layout.jsx` with `logo-zad-altahsili.png` (already copied to `frontend/public/`).
