# Maram (maramedu.com) — Development Brief

> **For the developer / AI agent:** give the AI the WHOLE folder (this file + `screenshots/` + `mockups/` + `renders/`), not this file alone. This file is the single source of truth for all requested changes on maramedu.com. Read it fully before writing code. Every requirement here was confirmed by the owner (Hassan). Screenshots referenced as `screenshots/...` are in the same folder: `TARGET` / `ORIGINAL` / `PROPOSAL` = the look to build, `CURRENT` / `NEW` / `BUG` = what is wrong now.

## 0. How to work on this (MANDATORY)
1. **Don't break what works.** Read the existing code for each area before changing it. Reuse existing models, APIs and components; extend them instead of rewriting. Do NOT touch the BigBlueButton integration (B8).
2. **Database changes are additive first:** add new tables/columns with safe defaults, run migrations on a copy/staging DB first, take a full backup before any destructive step (only destructive step in this brief: dropping the Smart-schedule tables — see "Global — Remove الجدول الذكي").
3. **Permissions on the backend, not only the UI:** every "can't see / can't edit / locked" rule in this brief must be enforced in the API too.
4. **One shared source for time rules:** implement ONE service that answers, for a given student or group: next class, class started/ended, teacher joined, lessons taken, released tasks. Use it everywhere (home, daily tasks, simulators, locks, teacher pages). Times stored in UTC, displayed in Saudi time (Asia/Riyadh).
5. **Work in the phases of section 9**, deploy each phase to staging, test with the acceptance checklist, then production.
6. If anything in the brief conflicts with the existing data model, or is unclear, STOP and ask instead of guessing.
7. **HTML reference files (`mockups/`) are the visual source of truth.** For every page that has one, copy its structure, CSS values (colors, sizes, radius, spacing, gradients) and states into the site's real components — don't "interpret" the screenshot. `mockups/_shared.css` = design tokens (subject palette, buttons, pills, rings, navbar). Mockups use sample data and placeholder logos: wire REAL data and the REAL subject logo images.
8. **Visual QA before delivering each page:** take a screenshot of your implementation at the same width as the reference (desktop 1600px, phone 390px) and compare it side by side with `renders/<page>.png` (rendered from the HTML) and the original screenshot. Fix differences, then also check tablet widths (768 / 820 / 1024 / 1180).

| Reference HTML (`mockups/`) | Render (`renders/`) | Brief section |
|---|---|---|
| `student-components.html` | `student-components.png` | Pages 1, 3, 4, 4.3, 5, 6, 9 (fixes on existing components) |
| `student-daily-tasks.html` | `student-daily-tasks.png` | Page 12 |
| `student-results.html` | `student-results.png` | Page 7 |
| `landing-mobile.html` (view at 390px) | `landing-mobile.png` | Page 14 (phone only) |
| `teacher-home.html` | `teacher-home.png` | B1 |
| `teacher-classes.html` | `teacher-classes.png` | B2.1 |
| `teacher-availability.html` | `teacher-availability.png` | B2.2 |
| `teacher-rate-class.html` | `teacher-rate-class.png` | B3 |
| `teacher-create-test.html` | `teacher-create-test.png` | B4 |
| `teacher-tasks.html` | `../screenshots/T5-teacher-tasks-PROPOSAL.png` | B10 |

## Contents
1. Global rules (colors, plans, roles, groups, responsive, removals)
2. Student side — home & daily tasks
3. Student side — courses, lessons, collections
4. Student side — questions, tests, simulators, results
5. Public landing page (mobile)
6. Teacher accounts (B0–B10)
9. Delivery phases & acceptance checklist

# 1. GLOBAL RULES

## Subject color palette (source of truth — use everywhere: course cards, next-class card, etc.)
| Subject | Main color | Light bg |
|---|---|---|
| الأحياء Biology | #C58A00 (gold) | #FFF6DC |
| الكيمياء Chemistry | #C0182F (red) | #FDECEE |
| الفيزياء Physics | #6D28D9 (purple) | #F3EEFE |
| الرياضيات Math | #5F8F2E (green) | #F1F7E8 |
(sampled from the current courses page — confirm)

## Global — Subscription plans: Gold vs Silver
(Not to be confused with the question "الترشيح" categories ذهبي/فضي/برونزي in 9.2c — different thing.)
- ذهبي (Gold): bound to the group's class schedule. ALL time-based rules in this brief apply (live classes & join logic 1.3, lesson locks 2.3, daily tasks Page 12, task release 2.2, simulator eligible lessons 9.2b).
- فضي (Silver): recorded videos only, watched ANY time, NO locks by schedule, NO daily tasks, NO group schedule. Silver HAS: recorded lesson videos (all lessons, any time), Collections (all lessons), personal & full simulators, Results page.
  - Silver does NOT have: live classes, class schedule (جدول الحصص), daily tasks, teacher tests (اختبارات المدرسين).
  - For Silver, these Gold-only features are REMOVED completely from the UI (not shown locked): navbar links (المهام اليومية، جدول الحصص), home page sections (next class card, daily tasks), teacher-tests section on the tests page. Direct URL access → redirect to home. Enforced on the backend too.
  - Silver simulators: eligible lessons = ALL lessons of the subject (no schedule), same weighting algorithm 9.3.
  - Silver Results page: no "اختبارات المدرسين" tab; "دروس تحتاج تركيز" & stats computed from simulators only.

## Global — Roles & homework ownership
### Roles per subject
- المدرس الأساسي (Main teacher, ONE per subject) + Admin: the ONLY ones who can create/edit content for that subject:
  - upload/edit recorded videos,
  - create/edit questions (collections banks, homework),
  - create/edit homework,
  - link tasks to lessons + group overrides (2.1, 2.1b).
- المدرس الثانوي (Secondary teacher): NO content editing at all. Can only:
  - teach the live classes of his assigned groups (join/start the class, 1.3),
  - follow his own students' grades/results/attendance (and remove attendance manually, 1.4).
  - Hide all content-editing screens/buttons from him + enforce on the backend.

### Homework (الواجبات) becomes a GLOBAL library — like Collections
- Current: each homework is tied to a specific group and teacher. → CHANGE.
- Required: homework lives as sub-titles under each Foundation lesson (in إدارة المادة), the same for ALL teachers, groups and students (like Collections). Only the main teacher of the subject (and admin) creates/edits it.
- A lesson's homework is released automatically with that lesson's tasks (2.1/2.2). Group overrides (2.1b) apply to collections; homework always follows its lesson.
- No data migration needed: there is currently NO homework data. Just change the data model (remove group/teacher binding) and the related screens.

## Global — Remove "الجدول الذكي" (Smart schedule) COMPLETELY
- Delete the page, its route, the navbar link, any backend jobs/APIs that only serve it, and every reference in the UI (e.g. the "من الجدول الذكي" sub-text in the home daily-tasks cards).
- Delete it from the CODEBASE, not just hide it: components, routes, API endpoints, scheduled jobs/cron, helpers, and its database tables/columns (take a DB backup first, then drop).
- Before deleting, search the whole codebase for every import/usage of it and replace them (e.g. the home daily-tasks cards currently read from it → switch them to the new tasks system 2.1/2.2). The site must build and run with zero references to it left.
- Daily tasks now come ONLY from the Tasks admin page (2.1).

## Global — Responsive: tablets & iPad (HIGH PRIORITY)
- ALL pages must look intentionally designed (not just "not broken") on tablets/iPad, portrait AND landscape.
- Test widths: 768px (iPad mini/portrait), 820px (iPad Air portrait), 834px (iPad Pro 11" portrait), 1024px (iPad landscape / iPad Pro 12.9" portrait), 1180px and 1366px (iPad Air / Pro landscape). Also phones 375–430px and desktop ≥1440px.
- Shared container from 5.1: `max-width` = Math width on desktop; on tablets use full width with comfortable side padding (≈24–32px), no horizontal scroll ever.
- Grids:
  - Courses page (4 subject cards): 4 columns desktop → 2×2 on tablet → 1 column on phone. Cards equal height, buttons aligned (3.1).
  - Lessons lists: 2 columns desktop/tablet landscape → 1 column on tablet portrait if titles wrap badly.
  - Subject main page (logo + تأسيس/تجميعات cards): side-by-side on desktop/tablet landscape → logo on top, cards stacked below on tablet portrait.
  - Daily tasks (2 cards) and next-class card: keep readable, buttons never squeezed or overlapping text.
- Top navbar: 8 links + account buttons don't fit on tablet portrait → collapse to a hamburger menu (or horizontal scroll) below ~1100px; no wrapping onto 2 lines.
- Touch targets ≥ 44×44px; font sizes scale (use clamp()) — titles must not overflow or break mid-word.
- Logos/images scale proportionally (no stretching), same relative size across all 4 subjects.
- Acceptance: check every page in Chrome DevTools at the widths above + on a real iPad in both orientations.

# 2. STUDENT SIDE — HOME & DAILY TASKS

## Page 1 — Home page: "Next class" card
**HTML reference:** `mockups/student-components.html (block 1)`

Screenshots: `screenshots/01-home-next-class-ORIGINAL.png` (target), `screenshots/01-home-next-class-NEW.png` (current, wrong)

### 1.1 Subject color theming (UI)
- Current: card is always the same blue gradient regardless of subject.
- Required: the whole card takes the subject's color as a soft gradient (as in ORIGINAL: Biology = yellow/gold gradient, gold border, gold number badge, gold button, gold subject/title text).
- Must apply to EVERY subject, each with its own color (not Biology only). Colors: see the Subject color palette table.

### 1.2 Bug: "[object Object]" shown under the title
- Current: `أحياء · [object Object]` — an object is rendered instead of a string.
- Required: line 1 = "{subject} · {teacher name}". Line 2 (on its own line, LARGE and prominent) = class START time only (e.g. "3:00 م").

### 1.3 Join logic (backend + UI)
- Student CANNOT join until the teacher has joined first.
- Class time reached + teacher not joined → show "ستبدأ قريبًا" under the card, button disabled.
- Teacher joined (BigBlueButton meeting started by the teacher, B8) → show "مباشر الآن" in a green badge, button enabled.
- Before class time: live countdown to the start time (e.g. "تبدأ بعد 02:14:35"), button disabled.
- From start time until the teacher joins: "ستبدأ قريبًا" (no time limit), button disabled.

### 1.4 Attendance (backend)
- Student is marked PRESENT automatically when they open the class link.
- Only the teacher can change a student to absent, from the Rate-class page (B3). See B7.

## Page 2 — Home page: "Daily tasks" (المهام اليومية) + new Tasks admin page

Screenshot: `screenshots/02-home-daily-tasks-CURRENT.png` (current UI; layout OK, logic changes)

### 2.1 New admin page: "Tasks" (صفحة المهام الرئيسية)
- Access: one MAIN TEACHER per subject (sees/edits only his subject's lessons) + Admin (all subjects).
- Layout: choose subject → list of that subject's Foundation (التأسيس) lessons in course order (درس 1، درس 2…). Next to each lesson: "إضافة مهمة".
- HOMEWORK is linked AUTOMATICALLY: a lesson's homework = the homework sub-titles that exist under that same Foundation lesson (managed in "إدارة المادة"). The teacher does NOT add/remove homework on the Tasks page; they're shown read-only (🔒).
- COLLECTIONS are chosen by the teacher: collections are a tree (main collection → sub-titles, e.g. "التصنيف الحديث" → "الممالك وبدائيات النوى 120 سؤال"…). He can pick a whole main collection (= all its sub-titles) or specific sub-titles, from any lesson. Each pick = the full question set of that main/sub-title (no partial question selection). Searchable tree with checkboxes (partial state on the main when some subs are picked); items already linked marked "✓ مربوطة بالدرس".
- A lesson can have many collection items (e.g. 3 sub-titles). Teacher can reorder and delete them.
- Editing is allowed at any time, also after release: an added task appears immediately for students and counts in their totals; a removed task disappears and is removed from their totals/statistics.

### 2.1b Groups (المجموعات)
- Students are in groups; each group has its OWN class schedule. EVERY time-based rule in this brief (task release 2.2, class locks 2.3, simulator eligible lessons 9.2b, daily-tasks days/status Page 12, join logic 1.3) uses the schedule of the STUDENT'S group.
- Flow: the teacher FIRST sets tasks per lesson as the DEFAULT for all groups. The teacher can override them for a specific group: on the lesson row → "تخصيص لمجموعة" → pick group → add/remove/replace tasks for that group only. Groups without an override keep the default. Show a small badge on lessons that have group overrides.

### 2.1c Extra classes (حصص إضافية)
- Purpose: the teacher didn't finish a lesson (e.g. Math lesson 7 "المثلثات") and needs one more class before starting lesson 8 "المربعات".
- Only the ADMIN creates them, from the class-schedule admin (جدول الحصص): "إضافة حصة إضافية" → group, date/time, and a FREE-TEXT title the admin writes (e.g. "المثلثات — حصة إضافية"). It is NOT a new course lesson; the 17 Foundation lessons stay unchanged.
- NO request feature in the system: teacher and admin communicate directly outside the platform.
- Adding an extra class does NOT affect the Foundation: the 17 Foundation classes stay fixed, nothing is shifted automatically. If any Foundation date needs changing, the admin edits it manually in the schedule.
- An extra class belongs to ONE group only. It has NO default tasks: the day stays EMPTY unless the main teacher adds tasks to it for that group (released at class end, like any class).
- Extra classes are NOT a question source for the simulators and don't change which lessons count as "taken".
- Shown with a "حصة إضافية" badge in the schedule, home page and daily tasks.

### 2.2 Daily tasks display logic
- Tasks appear ONLY when their linked Foundation class ENDS (class end time from the class schedule جدول الحصص).
  - Example: Math lesson #3 on 18/12, 3:00–4:30 → at 4:30 its linked homework + collections appear in Daily tasks.
  - If the class is postponed/rescheduled, its tasks move with it: they appear only when the class actually takes place and ends.
- They stay visible until the next class ends, then get replaced by the new class's tasks (student always sees the tasks of the LAST class that started).
- Clicking a task card on the home page deep-links directly to that exact homework / collection page (no intermediate navigation).

### 2.3 Lock future classes
- Gold student cannot open any class/lesson whose scheduled time in HIS GROUP's class schedule (جدول الحصص) hasn't arrived yet. (Silver: no locks.)

## Page 12 — NEW page: Daily tasks (المهام اليومية)
**HTML reference:** `mockups/student-daily-tasks.html`
Screenshot: `screenshots/12-daily-tasks-page-TARGET.png` (build exactly this)
- Route e.g. `/daily-tasks`. Breadcrumb "الرئيسية › المهام اليومية".
- Add "المهام اليومية" as a link in the TOP NAVBAR (right after "الرئيسية"), highlighted when active like other links. (Navbar is now 9 links → hamburger rule in Global — Responsive matters even more.)
- Entry points: the "المهام اليومية" section on the home page (Page 2) → its title/"عرض الكل" opens this page. Task items still deep-link straight to the homework/collection (2.2).
- Data source: the tasks linked to Foundation lessons on the teacher's Tasks admin page (2.1). A "day" = a day that has a Foundation class; that day's tasks = tasks linked to that class's lesson, released at class END time (2.2).
- All numbers REAL. Subject colors from the palette table.

### 12.1 Header (blue card)
- Date ("الجمعة · 20 نوفمبر"), title "المهام اليومية".
- Message: "مادة اليوم {subject} · باقي لك {X} مهام — كمّل وحافظ على سلسلتك 💪". When all done → congratulation message.
- Ring: done/total for today ("1/4 مهام اليوم").

### 12.2 Streak card
- "🔥 N أيام — سلسلة إنجاز متتالية": number of consecutive class-days fully completed, counting back from the last one. Days with no class don't break the streak.
- "مهام هذا الأسبوع": done of total this week (e.g. 19 من 24). Week = Saturday → Friday.
- "نسبة الإنجاز": same week, as % (19/24 = 79%).

### 12.3 "هذا الأسبوع" strip
- 7 day tiles (Sat → Fri): day name, date, ring done/total, subject chip in subject color. Today highlighted (blue border).
- Ring color = status: green مكتمل, orange جزئي, red متأخر, blue اليوم (legend under the strip).
- Clicking a day shows that day's tasks (in the "مهام اليوم" panel, title changes to that day).
- Day with no class: tile shows "لا مهام" in grey.

### 12.4 "مهام اليوم"
- Subject chip "مادة اليوم: كيمياء" with logo + progress bar "1 من 4".
- Two columns: "الواجبات" and "التجميعات". Each item: checkbox, title, question count, button "ابدأ ←" in subject color, left border in subject color.
- Done item: green check, title struck through, grey, "✓ تم" badge instead of button.

### 12.5 "الأيام السابقة" (last 7 days)
- Accordion rows: day + date, subject chip, progress bar + "X من Y مهام", status badge (مكتمل ✓ green / متأخر red / …).
- Expand → same two-column tasks view for that day; not-done items shown in red with "لم يُنجز".
- "عرض أيام أقدم" loads the previous 7 days.

### 12.6 Responsive
- Desktop as screenshot. Tablet portrait: header full width, streak card below; week strip scrolls horizontally if needed; homework/collections columns stacked. Phone: everything 1 column.

### 12.7 Rules (confirmed)
- A task is DONE only when the student has answered ALL its questions. Checkboxes are display-only, set automatically by the system — the student can NOT tick them manually.
- Late completion is allowed: a past day's unfinished tasks keep their "ابدأ ←" button and can still be completed; they then count as done (in red "لم يُنجز" until then).
- Day status:
  - مكتمل (green): all tasks done on time (before the next class started).
  - جزئي (orange): some tasks were done on time and the rest were completed late, OR the day is past and only part is done.
  - متأخر (red): day is past and none of its tasks were done.
  - اليوم (blue): the current day.
- Streak counts only days completed ON TIME (late completion doesn't restore a broken streak).
- Two classes on the same day: both subjects' tasks appear together in that day (two subject chips on the day tile; tasks of each subject shown with their subject color; totals combined).

# 3. STUDENT SIDE — COURSES, LESSONS, COLLECTIONS

## Page 3 — Courses page (https://www.maramedu.com/courses)
**HTML reference:** `mockups/student-components.html (block 3)`

Screenshot: `screenshots/03-courses-CURRENT.png`

### 3.1 Logo size/alignment inconsistent
- Current: each subject logo renders at a different size/vertical position; cards end at different heights and the "ادخل الدورة" buttons are not on the same line.
- Required:
  - All logos inside an identical fixed-size container (same width & height), centered, `object-fit: contain`. Logo images should be trimmed/exported with equal padding so visual size matches.
  - All cards equal height; button pinned to the bottom of the card → all 4 buttons perfectly aligned on one line.
  - Same on mobile.

### 3.2 Remove subtitle
- Delete the line under the "دورات" heading: "اختر المادة – يتغيّر الشعار والألوان تلقائياً داخل المادة".

## Page 4 — Course lessons page header (all 4 subjects)
**HTML reference:** `mockups/student-components.html (blocks 4/5 and 4.3)`
URLs: /courses/1/lessons, /courses/2/lessons, /courses/3/lessons, /courses/4/lessons

Screenshots: `screenshots/04-lessons-header-ORIGINAL-bio.png` (TARGET look), `screenshots/04-lessons-header-NEW-math.png` (current, broken)

### 4.1 Header card colors broken
- Current (e.g. Math): whole card filled with a heavy dark-green gradient; the title "تأسيس — الدروس" is dark green on green → almost unreadable; logo looks muddy/tinted.
- Required — copy the Biology design exactly, only swapping the subject color (palette table):
  - Card background WHITE, with a very soft light-tint gradient of the subject color only on the left side (behind the lesson-count badge).
  - Title "تأسيس — الدروس": bold, subject's dark color, on white.
  - Subject pill (e.g. "الأحياء"): subject light bg + subject color text.
  - Lesson-count badge: solid subject-color gradient, white number + "درس".
  - Logo in its original full colors (no overlay/tint), thin vertical divider between logo and title.
  - Thin accent strip on the right edge in the subject color.
- Apply to ALL 4 subjects, each with its own color.

### 4.3 Bug: lesson card highlight stuck on lesson 1
Screenshot: `screenshots/04-lessons-hover-BUG.png`
- Current: lesson 1 card is ALWAYS shown highlighted (subject-color border, light tinted background, filled number badge); hovering other lessons does nothing.
- Required: NO card highlighted by default. The highlight style (exactly lesson 1's current look) applies to the card under the mouse on `:hover` (and `:focus-visible` for keyboard), with a smooth transition (~150–200ms), and goes away when the mouse leaves. On touch devices: highlight on press (`:active`).
- Same on Foundation and Collections lesson lists, all 4 subjects.

### 4.2 Header gradient (answer)
- Header card background = gradient from WHITE to the subject's color (soft), exactly like the Biology target. Text and logo must always stay clearly visible.

## Page 5 — Unify layout across ALL subject pages (4 subjects × 3 pages)
Pages: subject main page (`/courses/{id}`), Foundation lessons (`/courses/{id}/lessons`), Collections (التجميعات) lessons.
Reference (old/correct version): https://karim-khaled-2.vercel.app/courses/1

Screenshots: `05-subject-page-math.png`, `05-subject-page-bio.png`, `05-foundation-lessons-math.png`, `05-foundation-lessons-bio.png`, `05-collections-bio-TARGET-width.png`

### 5.1 Same width everywhere
- Current: every subject/page uses a different content width (e.g. at a 1897px viewport: Math subject page ≈1275px wide, Biology ≈1070px; Math lessons ≈1390px, Biology ≈1230px). Collections pages are narrow in all 4 subjects.
- Required: ONE shared container width for all these pages in all 4 subjects = the LARGEST current one (Math / the Collections target screenshot). Use a single shared layout component/class, not per-subject values.

### 5.2 Same icon/element sizes everywhere
- Logo, "تأسيس"/"تجميعات" cards and their icons, lesson-number badges, arrow buttons, header card: identical sizes in all 4 subjects = Math's (largest) sizes.

### 5.3 Header backgrounds readable
- Current: dark solid-color gradient headers hide the subject name, title and logo (Foundation lessons header in Math & Biology).
- Required: same design as the old version — white → soft subject-color gradient, title in subject dark color, logo in original colors (see 4.1/4.2). Applies to subject main page, Foundation page and Collections page, all 4 subjects.

### 5.4 Collections page fixes
- Header must show the word "التجميعات" + subject name pill + the subject logo.
- Bug: the subject logo image is BROKEN on the Collections header (broken-image icon top-right in `05-collections-bio-TARGET-width.png`) → fix the image path.

## Page 10 — Collections lesson page (e.g. https://www.maramedu.com/courses/3/collections/25)
- Remove the exam-YEAR filter from Collections pages (all lessons, all 4 subjects). Students can't filter questions by year.
- The year stays visible only as a badge on each question (same as 9.1).

# 4. STUDENT SIDE — QUESTIONS, TESTS, SIMULATORS, RESULTS

## Page 6 — Question-solving page (Collections practice & Exams)
**HTML reference:** `mockups/student-components.html (block 6 + break screen)`
Screenshot: `screenshots/06-question-page-CURRENT.png`

### 6.1 Width (applies to ALL pages listed so far)
- Current: pages look like a phone layout stretched on laptop/iPad (narrow content, wasted side space).
- Required: use the shared wide container (5.1) + the tablet rules (Global — Responsive). On desktop/iPad landscape: question area + question map side by side using the full container width.

### 6.2 Question card too big
- Current: answer option boxes are very tall with lots of empty space; question card is oversized.
- Required: compact options (reduce vertical padding/min-height — roughly half of current height), so the question + all 4 options + navigation buttons fit on one screen without scrolling on laptop and iPad.

### 6.3 Navigation buttons
- Rename "تحقق" → "التالي".
- Arrow direction (RTL): "التالي ←" (arrow pointing LEFT); "→ السابق" (arrow pointing RIGHT).

### 6.4 Sections — Collections (التجميعات) practice
- Split the lesson's questions into sections of 50: Q1–50, Q51–100, ...
- Sections selectable from a DROPDOWN (e.g. "القسم 1 (1–50)"), to reduce distraction; the question map shows only the current section's questions.
- No break screen; after Q50 the student continues directly into section 2 starting at Q51.
- Numbering is continuous (section 2 starts at 51, not 1).
- Student can move freely between sections.
- Answer feedback: keep the EXISTING option (chosen before starting) — show the correct answer immediately after each question, OR only at the end. Renaming "تحقق" → "التالي" must not remove this option; in "immediate" mode the answer is revealed when the student selects, then "التالي" moves on.

### 6.5 Sections — Exams (الاختبارات)
- Split into sections of 22 questions: Q1–22, Q23–44, ...
- Remainder becomes its own final section even if it's 1 question (e.g. 45 questions → 22 + 22 + 1).
- Numbering continuous (section 2 starts at 23).
- Once a section is finished the student CANNOT go back to it (locked, enforced on the backend too, not only hidden in UI).
- Between sections: a break screen centered on the page ("استراحة") with a 5-minute countdown. Student clicks "متابعة القسم التالي" to continue earlier; when the 5 minutes end, the next section starts automatically. If the student leaves the exam during the break, the break timer doesn't keep him waiting: on return he resumes directly at the next section.
- Exam timer: keep the current timer behaviour as is (no change requested).
- Inside the current (unlocked) section the student can go back to previous questions and change answers.
- Question map shows only the current section.

## Page 8 — Tests page (https://www.maramedu.com/tests) — sizing
Screenshot: `screenshots/08-tests-CURRENT.png`
- Current: content is a narrow column (~890px at a 1900px viewport) → looks like a phone layout on laptop/iPad, big empty sides.
- Required:
  - Use the shared wide container (5.1) for the whole page: title "الاختبارات", "المحاكي الشخصي" card, "اختبارات المدرسين" section and its filters — all aligned to the same width/edges as the other pages.
  - Subject selection tiles (4): equal size, logos same visual size inside each tile (same rule as 3.1), tiles stretch to fill the row on desktop; 2×2 on tablet portrait and phone.
  - Teacher-tests filter bars (subject chips + الكل/متاح/قادم/سابق): on one line on desktop; on tablet/phone they wrap cleanly or scroll horizontally — never overflow.
  - Follow Global — Responsive rules.

## Page 9 — Personal simulator setup (https://www.maramedu.com/tests/simulator)
**HTML reference:** `mockups/student-components.html (block 9)`
Screenshot: `screenshots/09-simulator-setup-CURRENT.png`

### 9.1 Remove the years filter
- Delete the whole "السنة" section (the green range slider). Students can NOT choose the year.
- The year stays displayed as a badge on each question inside the exam (e.g. "1446 هـ"), as today.
- Questions are drawn from all years.

### 9.2 "عدد الأسئلة" — 3 options
1. "عدد محدد": the +/- stepper as today, DEFAULT = 22 (not 20).
   - Split of N across selected subjects: proportional to the simulator ratio Math 30 : Bio 30 : Chem 25 : Phys 25, rounded with the largest-remainder method (ties → Math, then Bio).
   - Default 22 with all 4 subjects = Math 6, Bio 6, Chem 5, Phys 5 (confirmed). Math+Bio → 11/11. Math+Chem → 12/10.
2. "محاكي حسب المواد" (NEW): fixed count per selected subject — Math 30, Chemistry 25, Physics 25, Biology 30. Total = sum of the selected subjects (all 4 = 110).
3. "كل الأسئلة المختارة": as today.

### 9.2b Lesson selection list (UI)
- In the simulator's lesson/chapter selection, lessons whose class hasn't happened yet are shown but DISABLED: greyed out, text with strikethrough, and the label "(لم نأخذها بعد)" next to the name. They can't be selected and are never used as a question source.
- Same rule enforced on the backend.

### 9.2c "الترشيح" (ذهبي / فضي / برونزي) → MULTI-SELECT
Screenshot: `screenshots/09-simulator-tarsheeh-CURRENT.png`
- Current: single choice.
- Required: student can select 1, 2 or all 3 (toggle chips, each with its own selected style; ذهبي selected by default). At least one must stay selected (can't deselect the last one).
- Question pool = UNION of the selected categories; the selection algorithm (9.3) runs on that pool unchanged.

### 9.3 Question selection algorithm (backend)
Goal: cover as many lessons as possible, but weight LATER lessons more — the last lessons get roughly 3× the first ones.
Eligible lessons = ONLY lessons whose Foundation class has already ENDED (same release moment as tasks, 2.2). n = number of eligible lessons.
Applied per subject, over that subject's eligible lessons in course order (lesson 1 … n):
1. Weight of lesson i: w_i = 1 + 2·(i−1)/(n−1)  → first = 1, last = 3 (linear). If n = 1, w = 1.
2. Expected count: e_i = N · w_i / Σw  (N = questions for this subject).
3. Each lesson gets floor(e_i). The remaining questions are assigned one by one to lessons chosen at random with probability proportional to their fractional part (e_i − floor(e_i)) — so every attempt is a bit different but the weighting holds.
4. If a lesson has fewer available questions than assigned, give the shortfall to the next later lesson (then earlier ones if needed). Never duplicate a question within one attempt.
5. Pick the actual questions inside each lesson at random.
Expected results (check with unit tests):
- 30 Q, 10 lessons → e = 1.5, 1.8, 2.2, 2.5, 2.8, 3.2, 3.5, 3.8, 4.2, 4.5 → first lessons 1–2 each, middle 2–3, last 4–5.
- 10 Q, 10 lessons → e = 0.5 … 1.5 → early lessons 0–1, late lessons 1–2 (most questions from the last lessons).
- 22 Q, 8 lessons → e = 1.4 … 4.1.
Final question order in the exam: FULLY SHUFFLED across subjects and lessons (NOT grouped subject by subject). Avoid more than 2 consecutive questions from the same subject when possible.

## Page 11 — Full simulator (المحاكي الكامل)
Apply EVERYTHING from the personal simulator (Page 9) to the full simulator, except the question count:
- Fixed 110 questions: Math 30, Biology 30, Chemistry 25, Physics 25 (no count choice).
- Inside each subject: same lesson-weighting algorithm (9.3) — only lessons whose class has arrived (9.2b), later lessons weighted up to 3× the first.
- No year filter (9.1); year shown on the question only.
- "الترشيح" multi-select (9.2c) if the full simulator has this option.
- Questions fully shuffled across subjects (no more than 2 consecutive from the same subject when possible).
- Exam sections rule (6.5) applies: 110 = 5 sections × 22, break screen between sections, no going back to a finished section.

## Page 7 — Results page (https://www.maramedu.com/results) — REDESIGN
**HTML reference:** `mockups/student-results.html`
Screenshots: `screenshots/07-results-TARGET.png` (build exactly this), `screenshots/07-results-CURRENT.png` (current, too basic)
ALL numbers must be REAL, computed from the student's actual attempts (no placeholders/mock data).

### 7.1 Time filter (NEW — not in target screenshot, add it)
- Segmented control at the top of the page (under the blue header or inside it): "اليوم" · "آخر 7 أيام" · "آخر 30 يوم" · "آخر 3 شهور" · "الكل".
- The filter applies to EVERYTHING on the page: header stats, per-subject levels, lessons needing focus, results list.
- Default: "الكل" (confirmed). Keep selection in the URL (?period=7d) so refresh keeps it.

### 7.1b Collections are EXCLUDED from analytics
- Collections (التجميعات) practice does NOT count in: header stats (7.2), subject levels (7.3), lessons needing focus (7.4), or the "الكل" list. These use exams/mocks only (محاكي + اختبارات المدرسين).
- Collections get their own simple report in the "التجميعات" tab (see 7.5).

### 7.2 Header (blue) — 4 stat boxes
- "اختبار": number of completed attempts in the period.
- "متوسط الدرجات": average score % of those attempts.
- "أعلى درجة": highest score % in the period.
- "تحسّن" (green ▲ if positive, red ▼ if negative): average of the selected period minus average of the previous period of the same length (e.g. last 7 days vs the 7 days before). For "الكل" compare last 30 days vs the previous 30. Label changes with the filter (تحسن آخر أسبوع / آخر شهر…). Hide if not enough data.
- Score % formula everywhere: correct ÷ total questions × 100 (unanswered counts as not correct).

### 7.3 "مستواك في كل مادة"
- One card per subject (4), in the subject's color (palette table) with its logo.
- % = correct ÷ total for that subject's questions in the period (for multi-subject mocks, count each subject's questions separately). Progress bar = same %.
- "N اختبارات" = number of attempts that included that subject.
- No data → show "—" and "لا توجد اختبارات".

### 7.4 "دروس تحتاج تركيز"
- Up to 5 lessons with the LOWEST correct rate in the period (only lessons with ≥10 answered questions, to avoid noise), sorted ascending.
- Each row: colored subject dot, lesson name, "{subject} · نسبة الإجابة X%", button "تدرّب ←" in subject color → deep-links directly to that lesson's Collections questions.

### 7.5 "كل النتائج"
- Tabs: الكل · المحاكي · اختبارات المدرسين · التجميعات. ("الكل" = محاكي + اختبارات المدرسين only.)
- "التجميعات" tab = simple report only, no donuts/review/stats: a plain table, one row per lesson the student practiced: subject chip, lesson name, questions solved / total questions in the lesson, correct, wrong, correct %. Time filter still applies.
- Each row: donut with % (red <50, orange 50–79, green ≥80), title, type badge (محاكي شخصي / اختبار مدرس / محاكي كامل…), subject chips in subject colors, date ("اليوم"/"أمس"/date) · duration in minutes, boxes صح / غلط / لم تُجب, button "مراجعة ←" → detailed review of that attempt.
- Newest first; show 10, then "عرض نتائج أقدم" loads 10 more.
- Empty state per tab.

### 7.6 Responsive
- Desktop: list (wide) + "دروس تحتاج تركيز" (side column) side by side. Tablet portrait/phone: stacked, focus lessons ABOVE the list; subject cards 2×2 on tablet, 1 column on phone; header stats 2×2 on phone.

# 5. PUBLIC LANDING PAGE

## Page 14 — Public landing page (visitors, not logged in) — MOBILE layout broken
**HTML reference:** `mockups/landing-mobile.html`
Screenshot: `screenshots/14-landing-mobile-TARGET.jpg` = the required mobile design. The image is ONE long page split into 2 columns to fit: read the RIGHT column top→bottom first, then continue with the LEFT column top→bottom.
- Current: the landing page breaks on phones. Required: PHONES ONLY (≤ 480px) must match the target exactly. Tablet and laptop/desktop layouts of the landing page stay EXACTLY as they are now — do not touch them (scope all changes inside the phone media query).
- Student account pages are fine — no changes needed there beyond this brief.

Sections in order (mobile):
1. Header: logo (right), "احجز مقعدك" button + hamburger menu (left). Red corner ribbon "التسجيل المبكر 🔥".
2. Hero: pill "التسجيل مفتوح الآن · المقاعد محدودة" (green dot); title "تعبت من الحصص المسجلة؟ معلمك معك أولاً بأول" ("معلمك معك" in blue); subtitle; primary button "احجز مقعدك الآن ←" (blue, full width); secondary outlined "جرّب الأسبوع التجريبي"; red pill "تبقى 4 مقاعد فقط في المجموعة القادمة" (live number from the next group's remaining seats).
3. Hero image (two students) on blue background, strip under it: "✓ حصص مباشرة ✓ مجموعة صغيرة ✓ بنوك تجميعات".
4. Stats card (2×2, overlapping the image bottom): +8000 سؤال تجميعات · 24/7 متابعة عبر الواتساب · 10 طلاب كحد أقصى للمجموعة · ∞ اختبارات محاكاة لا محدودة.
5. "ليش مرام؟ — مميزات دورة مرام": 2-column grid of feature cards (icon + title + one line): حصص مباشرة وتفاعلية، مجموعة صغيرة، كل الحصص مسجلة، معلمك 24 ساعة، جدول مرن، واجبات واختبارات دورية، بنوك تجميعات محدثة، + blue CTA card "جاهز تبدأ؟".
6. "أربع خطوات بسيطة — كيف تبدأ مع مرام؟": 4 numbered steps (احجز مقعدك في المجموعة، يتواصل معك فريق الدعم، أول أسبوع مجاناً، تدخل حصصك وتجرّب).
7. Red offer section "⚡ عرض لفترة محدودة — استغل عرض التسجيل المبكر": 4 ✓ points, white button "سجّل الحين واستفد من العرض ←", then a ticket-style coupon card "كوبون التسجيل المبكر — خصم 33% على سعر الباقة — وقسّطها على 3 دفعات 💳" with yellow badge "وفّر الثلث!".
8. "جرّب مجاناً — تصفّح حسب المادة": 2×2 subject cards (subject logo on light subject-color top, "درس مجاني" chip, lesson name, filled subject-color button "▶ شاهد الدرس المجاني", link "ادخل الدورة ←"). Colors from the palette table.
9. "عندك سؤال؟ — الأسئلة الشائعة": accordion (first item open).
10. Dashed card "محتاج باقة مخصصة لك؟" + green WhatsApp button "تواصل مع الدعم الفني".
11. Footer stacked: مرام التحصيلي + description; السياسات / خدمة العملاء in 2 columns; الدفع الآمن; social icons row (WhatsApp, TikTok, Instagram, Telegram).
Rules: no horizontal scroll, all text inside its card, buttons full width where shown, touch targets ≥ 44px, images not stretched.

# 6. TEACHER ACCOUNTS

## B0 — General rules for teacher accounts
- Build the pages below exactly as the TARGET screenshots, wired to the EXISTING backend data (classes, groups, students, attendance, homework, collections, tests). Replace the current outer teacher dashboards with these.
- Teacher navbar: الرئيسية · حصصي · الطلاب · المهام · الاختبارات · إدارة المادة.
- Every page is scoped to the logged-in teacher: only HIS subject, HIS groups and HIS students — never all groups of the platform.
- Theme = the teacher's subject color + logo (palette table), like the student side (screenshots show Biology gold).
- "إدارة المادة": replaces the current content-management page. Instead of showing the 4 subjects, it opens the teacher's OWN subject directly. Keep the existing inner functionality/code AS IS (no changes inside). Visible to the main teacher + admin only (see Roles).
- All times displayed in Saudi time (Asia/Riyadh — "بتوقيت السعودية (مكة المكرمة)"), stored in UTC.

## B1 — Teacher home (الرئيسية)
**HTML reference:** `mockups/teacher-home.html`
Screenshot: `screenshots/T1-teacher-home-TARGET.png`
- Header (subject color): subject logo, "مدرس {subject}", "أهلاً أ. {name} 👋", summary "لديك {N} حصص اليوم و{M} طلاب متأخرين في المهام".
- Next-class card inside header: countdown "01:25 تبدأ بعد", class title, group · time, button "دخول الحصة" (teacher join — this is what unlocks students' join, 1.3).
- 4 stat cards: حصص اليوم · طالب في N مجموعات · إنجاز الواجبات والتجميعات % (today's released tasks, his students) · حصة تحتاج تقييم.
- "حصصي" list (today + yesterday): time, title, group · students, action by state: ended & not rated → red "⭐ قيّم الحصة"; current/next → "دخول الحصة"; later → "لم تبدأ" (disabled); rated → green "✓ تم التقييم". Link "جدول الحصص كامل ←".
- "إنجاز المهام اليوم": per group → واجبات x/y and تجميعات x/y bars (y = students in group, x = students who finished ALL of that type for the current tasks), "متأخرين N" in red. Bar color: green ≥80%, orange 50–79%, red <50%. Link "كل المهام ←".
- "متابعة الطلاب" table: filters الكل · المتأخرين · each group. Columns: student (+group), واجبات اليوم x/y, تجميعات اليوم x/y, آخر نشاط, الحالة (ملتزم green / متأخر يوم orange / متأخر N أيام red — counted with the daily-tasks rules of Page 12), button "تذكير" for late students [see B-Q].

## B2 — حصصي (My classes) — 3 tabs: جدول الحصص · مواعيدي المتاحة · الحصص السابقة
### B2.1 جدول الحصص
**HTML reference:** `mockups/teacher-classes.html`
Screenshot: `screenshots/T2-teacher-classes-TARGET.png`
- Header "حصصي — مدرس {subject} · N مجموعات · M طالب"; group filter chips (الكل + each group).
- Red alert bar when classes need rating: "⭐ لديك {N} حصة تحتاج تقييم · يظهر التقييم لولي الأمر في تقرير الطالب" + "قيّم الآن ←".
- Week strip Sat→Fri: day, date, "N حصص" or "إجازة"; selected day highlighted; click = show that day.
- Day list: time + duration, title (+ "حصة إضافية" badge if extra, 2.1c), group · students · attendance x/y, status pill ("انتهت · لم تُقيّم" red, "تبدأ بعد 25 د" green), action button as in B1.
- "غداً" panel and "حصص سابقة" panel (with "عرض التقييم" for rated, "عرض الكل ←").
### B2.2 مواعيدي المتاحة (Availability) — NEW
**HTML reference:** `mockups/teacher-availability.html`
Screenshot: `screenshots/T2b-teacher-availability-TARGET.png`
- Weekly grid Sat→Fri, hours in Saudi time. Teaching hours: Friday & Saturday 12:00 م–11:00 م; other days 4:00 م–11:00 م. Outside = hatched/disabled.
- Teacher click-and-drag to create available windows; can resize/delete them.
- Rule: each window ≥ 2 CONSECUTIVE hours. Invalid window shown red with "ساعة واحدة ⚠" and an error card in the side panel; "حفظ المواعيد" disabled until fixed ("صحّح الفترة غير المكتملة لتتمكن من الحفظ").
- Side panel "فتراتي المتاحة": list of windows with hours each + total hours badge.
- Info: "الإدارة تقدر تضيف حصص لمجموعاتك في الفترات دي بس" → ADMIN schedule must only allow placing this teacher's classes (Foundation and extra) inside his saved windows (validation on admin side + backend).
### B2.3 الحصص السابقة
- List of past classes with filters (group, month), status (تم التقييم / لم تُقيّم), "عرض التقييم".

## B3 — Rate class (تقييم الحصة)
**HTML reference:** `mockups/teacher-rate-class.html`
Screenshot: `screenshots/T3-teacher-rate-class-TARGET.png`
- Header: group · day date · time range, "تقييم حصة: {title}", stats حاضر / غائب / متوسط التقييم (live as he edits).
- Tabs: الكل · الحاضرين · الغائبين · لم يُقيَّموا. Note bar: "يُسجَّل الحضور تلقائياً عند دخول الطالب للحصة. إذا دخل الطالب وقتاً قصيراً ثم خرج، يمكنك تغييره إلى غائب."
- Per student row: avatar, name, "دخل {time} · مدة الحضور {duration}" (or "لم يدخل الحصة"); toggle حاضر/غائب (auto from join, 1.4 — this page is where the teacher overrides attendance); warning pill "⚠ حضر N دقائق فقط" when duration < threshold [see B-Q]; rating 1–5 stars (disabled for absent); quick tags (multi-select): متفاعل · ملتزم بالواجب · يحتاج متابعة · شارك بالإجابة; free note. Absent rows tinted red.
- Show first 5, "عرض N طلاب آخرين".
- "ملحوظة عامة على الحصة" (optional).
- Buttons: "حفظ كمسودة" and "حفظ التقييم ✓". Saved rating, tags and notes appear in the student's report for the parent ("يظهر التقييم والملاحظات في تقرير الطالب لولي الأمر").
- A class "needs rating" from its end time until saved (drives the alerts in B1/B2).

## B4 — Create test (إنشاء اختبار جديد) — teacher tests
**HTML reference:** `mockups/teacher-create-test.html`
Screenshot: `screenshots/T4-teacher-create-test-TARGET.png`
1. بيانات الاختبار: name; groups (chips, only HIS groups, "+ إضافة").
2. الأسئلة:
   - Lessons tree (his subject): each lesson with question count, expandable to sub-titles (العناوين) with counts; checkboxes (lesson = all its titles; partial state); search; "تحديد الكل / إلغاء التحديد"; header "N دروس · M عنوان"; total available questions.
   - Mode tabs: "⚡ اختيار تلقائي" / "✋ اختيار يدوي".
   - Auto: total count (max = available), difficulty split سهل/متوسط/صعب (must sum to total), الترشيح (الكل / ذهبي فقط / ذهبي + فضي), distribution over lessons ("حسب عدد أسئلة كل عنوان" = proportional, or "بالتساوي"), button "🎲 اختر الأسئلة".
   - Selected questions list: number, text preview, title, difficulty, ترشيح; per question 🔄 replace (another question from the SAME title & difficulty) and ✕ remove; "🎲 إعادة الاختيار"; show 6 then "عرض الـ N سؤال الباقية".
   - Manual: browse questions of the ticked titles and tick them one by one (same list on the right).
3. موعد الاختبار ومدته: day, opens at, closes at; duration mode: "مدة الاختبار كامل" (minutes; student answers in any order) OR "وقت لكل سؤال" (seconds; question locks when its time ends).
- Sticky summary panel: groups (students count), lessons, titles, difficulty split, date & window, total questions, duration; "نشر الاختبار ←" (appears in students' tests page + notifies them); "حفظ كمسودة".

## B5 — Roles inside teacher accounts (confirmed)
- Secondary teacher sees ALL teacher pages (الرئيسية، حصصي، الطلاب، المهام، الاختبارات، إدارة المادة) but is READ-ONLY on content: homework, collections, videos, questions, and task linking (المهام) — view only, all edit/add/delete controls hidden + blocked on backend. He can: rate his classes/attendance (B3), set his availability (B2.2), create tests for HIS groups (B4), follow his students.
- Main teacher: everything + edit content.

## B6 — Teacher tests follow the teacher's settings only
- Teacher tests (B4) are NOT split into 22-question sections and have NO break screens: they follow the teacher's settings only (whole-exam duration OR time per question). Rule 6.5 applies to simulators only.

## B7 — Attendance (final)
- Student joins the class → PRESENT automatically. No automatic absence by duration.
- Only the teacher can change a student to absent (from B3).
- The "⚠ حضر N دقائق فقط" pill is informational only (show when duration < 15 minutes).

## B8 — Live classes = BigBlueButton (DO NOT TOUCH)
- The BigBlueButton integration is ready and working. Do NOT modify its code.
- Only READ from it what's needed (join time, leave time / duration per student, meeting started = teacher joined) for 1.3, B3 and attendance. If join/leave data isn't already stored, add a read-only listener/webhook that saves it, without changing the existing integration.

## B9 — Parent reports via Telegram (NEW)
- No parent report exists today. Build it as Telegram messages to the parent.
- Parent linking: each student has a "ربط ولي الأمر بتليجرام" link/code (in student account + visible to admin). Parent opens the platform's Telegram bot with that code (/start {code}) → parent chat is linked to the student. Admin can see linked/unlinked status.
- After the teacher clicks "حفظ التقييم" (B3), each student's parent receives a message: student name, subject, class title, date, attendance (حاضر/غائب + duration), stars, tags, teacher's note (+ general class note).
- Every report sent is SAVED in the database (student, class, content, sent time, delivery status) so the admin/director can review any student's full report history at any time (admin page: search by student → timeline of reports).
- "تذكير" button (B1): sends a Telegram reminder about the late tasks to the parent, logged the same way.

## B10 — المهام (Teacher Tasks page) (approved design)
Screenshot: `screenshots/T5-teacher-tasks-PROPOSAL.png` · HTML: `mockups/teacher-tasks.html`
- NOTE: homework column is automatic/read-only (lesson's own homework sub-titles); only collections are added here (see 2.1).
Implements 2.1 / 2.1b / 2.1c.
- Header (subject color): "ربط الدروس بالواجبات والتجميعات", note "المهام تظهر للطالب تلقائياً بعد انتهاء حصة الدرس في مجموعته", stats: درس مربوط x/17 · مهمة مربوطة · تخصيص لمجموعات.
- Scope bar "عرض المهام لـ": "الافتراضي · كل المجموعات" (default) + one chip per group; a dot marks groups that have overrides.
- Lessons list (course order). Each row: number, title, release status pill for the selected scope (ظهرت لكل المجموعات / ظهرت لمجموعة أ · ب — ج بعد 5:00 م اليوم / تظهر بعد حصة {day date} / red "لا توجد مهام مربوطة"), "تخصيص مجموعة X" badge if any group overrides it, counts 📘 homework / 📚 collections, button تعديل / "+ ربط مهام".
- Expanded lesson: two columns الواجبات / التجميعات; each task card: drag handle (reorder), title, question count, ✕ remove; "+ إضافة واجب" / "+ إضافة تجميعة".
- Side panel "إضافة إلى: {lesson}": collections tree only (main → sub-titles) with search, checkboxes, counts, "إضافة للدرس".
- Group scope selected: edits apply to that group only (override); button "رجوع للافتراضي" per lesson removes the override; the group's EXTRA classes (2.1c) appear in the list in date order with a blue "حصة إضافية" style and start empty.
- Secondary teacher: same page READ-ONLY (no add/remove/drag/edit buttons).

## B11 — الطلاب (Teacher → Students page)
- No new design: keep the EXISTING students page, restyled with the same components/colors as B1, and scoped to the teacher's own groups only.
- Add: group filter chips, the same status column as B1 ("ملتزم / متأخر يوم / متأخر N أيام"), and on each student a "التقارير" link → that student's report timeline (B9) for this subject.

## B12 — How the teacher side plugs into the existing system (no-break mapping)
| New piece | Uses existing | New storage (additive) |
|---|---|---|
| Classes, groups, schedule (B1, B2.1) | existing classes/groups/schedule tables | `class.type` = foundation / extra (default foundation), `class.title_override` (extra classes) |
| Availability (B2.2) | teachers table | `teacher_availability` (teacher_id, weekday, start_time, end_time) |
| Attendance (1.4, B3, B7) | existing attendance + BBB join data | `attendance.joined_at`, `left_at`, `duration_min`, `status_source` (auto / teacher) |
| Class rating (B3) | — | `class_ratings` (class_id, status draft/saved, general_note), `student_class_ratings` (student_id, class_id, stars, tags[], note) |
| Tasks linking (2.1, B10) | existing lessons, homework sub-titles, collection tree | `lesson_collection_links` (lesson_id, collection_node_id, order, group_id NULL = default) |
| Extra-class tasks (2.1c) | — | same table keyed by class_id instead of lesson_id, group-specific |
| Task completion (Page 12) | existing answers/attempts | computed (all questions answered) — cache table optional |
| Parent Telegram (B9) | students table | `parent_telegram_links`, `parent_reports` (student_id, class_id/type, payload, sent_at, status) |
| Teacher tests (B4) | existing tests/questions | only new fields if missing: difficulty split, ترشيح filter, duration mode |
| Roles (B5) | existing users/roles | `teacher_subject_role` = main / secondary |

Names are suggestions — map to the real schema. Existing student/teacher data must keep working unchanged.

# 9. DELIVERY PHASES & ACCEPTANCE CHECKLIST

## Phases (deploy + test each on staging)
1. **Foundation:** shared time-rules service (rule 0.4), roles (main/secondary + backend guards), groups/schedule fields, plans Gold/Silver guards, remove Smart schedule.
2. **Content & tasks:** homework under lessons, collections tree linking, Tasks page (B10), task release + daily tasks (Page 2, Page 12), extra classes.
3. **Student UI fixes:** colors/palette, layout widths, headers, hover bug, courses/tests/lessons pages, responsive (tablet), question page.
4. **Exams & simulators:** sections of 22 + breaks, collections sections of 50, simulator rules & algorithm (with unit tests), full simulator, year filters removal, results page.
5. **Teacher side:** B1–B4, B11, attendance from BBB data, availability + admin validation.
6. **Parents:** Telegram bot, reports, reminders, admin report history.
7. **Landing page mobile.**

## Acceptance checklist
- [ ] All 4 subjects use the palette colors everywhere; no dark header hides text/logo.
- [ ] Same container width & element sizes on all subject pages; no horizontal scroll at 375 / 768 / 820 / 1024 / 1180 / 1366 / 1440px; navbar collapses on tablet portrait.
- [ ] Gold student: can't join before teacher; countdown → "ستبدأ قريبًا" → "مباشر الآن"; locked future lessons; tasks appear at class END of HIS group's class.
- [ ] Silver student: sees videos, collections, simulators, results only; Gold-only pages return redirect from API/URL.
- [ ] Daily tasks: done only when all questions answered; statuses مكتمل/جزئي/متأخر correct; streak counts on-time days only.
- [ ] Simulator: unit tests for the allocation examples in 9.3 pass; only taken lessons (Gold) / all lessons (Silver); 22 default split 6/6/5/5; fully shuffled; ترشيح multi-select.
- [ ] Exams/simulators: sections of 22, 5-min break, finished section locked (API too). Teacher tests NOT sectioned.
- [ ] Collections: sections of 50 via dropdown, continuous numbering, no year filter.
- [ ] Results: real numbers, period filter changes everything, collections excluded from analytics.
- [ ] Smart schedule: zero references left in code, build passes.
- [ ] Secondary teacher can't edit content (UI + API). Main teacher can.
- [ ] Rate class saves → parent gets Telegram message → stored in `parent_reports`.
- [ ] Admin can't schedule a teacher's class outside his availability.
- [ ] BigBlueButton integration untouched and working.
- [ ] Landing page on phone matches the target; tablet/desktop unchanged.
