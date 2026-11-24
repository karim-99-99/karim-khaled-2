# المرحلة 5 — حسابات المدرسين

نفّذ المرحلة 5 بس من `docs/maram-brief/MARAM-DEV-BRIEF.md` (اقرا القسم 0 والأقسام المذكورة تحت قبل ما تبدأ).

## البنود
- Teacher navbar + B0 rules, "إدارة المادة" opens own subject (inner code unchanged).
- B1 home, B2.1 classes, B2.2 availability (+ admin scheduling validation), B2.3 past classes, B3 rate class, B4 create test, B11 students — each from its `mockups/teacher-*.html`.
- Attendance B7 using BBB join/leave data (read-only, B8).

## طريقة الشغل
1. افحص الكود الموجود لكل بند الأول، وقول في سطرين فين كل حاجة.
2. عدّل الكود فعلًا — مش خطة ولا ملخص. بند بند.
3. بعد كل بند: شغّل الـ build والتستات، واكتب الملفات اللي اتغيرت.
4. لو في صفحة ليها ملف في `mockups/`: انقل منه الشكل والقيم، وقارن نتيجتك بالصورة في `renders/`.
5. ما تقفش غير لما كل البنود تخلص. في الآخر: اتعمل / اتجرّب / فاضل / أسئلة.
