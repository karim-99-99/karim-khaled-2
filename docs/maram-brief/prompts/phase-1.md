# المرحلة 1 — الأساس

نفّذ المرحلة 1 بس من `docs/maram-brief/MARAM-DEV-BRIEF.md` (اقرا القسم 0 والأقسام المذكورة تحت قبل ما تبدأ).

## البنود
- Shared time-rules service (rule 0.4): next class, started/ended, teacher joined (BBB read-only), lessons taken, released tasks — per student/group.
- Roles: main / secondary teacher per subject (section "Global — Roles", B5) + API guards.
- Groups & schedule fields: class.type (foundation/extra), title_override; extra classes per group (2.1b, 2.1c).
- Plans Gold/Silver guards (section "Global — Subscription plans"): hide + block Gold-only pages/APIs for Silver.
- Remove "الجدول الذكي" completely from the codebase (section "Global — Remove").

## طريقة الشغل
1. افحص الكود الموجود لكل بند الأول، وقول في سطرين فين كل حاجة.
2. عدّل الكود فعلًا — مش خطة ولا ملخص. بند بند.
3. بعد كل بند: شغّل الـ build والتستات، واكتب الملفات اللي اتغيرت.
4. لو في صفحة ليها ملف في `mockups/`: انقل منه الشكل والقيم، وقارن نتيجتك بالصورة في `renders/`.
5. ما تقفش غير لما كل البنود تخلص. في الآخر: اتعمل / اتجرّب / فاضل / أسئلة.
