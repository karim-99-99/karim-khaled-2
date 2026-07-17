# منصة التعلم — Learning Platform

Full-stack Arabic (RTL) e-learning platform.

- **Frontend:** React + Vite (`frontend/`)
- **Backend:** Django + Django REST Framework + SimpleJWT (`backend/`)
- **Database:** SQLite for local dev, Neon (PostgreSQL) for production via `DATABASE_URL`
- **Video protection:** Bunny Stream signed URLs + moving student-name watermark
- **Design reference:** `canva-mockups*.html` + `MOCKUPS-DOCUMENTATION.md`

---

## Key features implemented

- **5 roles:** visitor, free student, subscribed student, teacher, admin.
- **Hybrid content scoping:**
  - تأسيس video lessons are a **shared library per subject** (same for everyone).
  - Homework, tests and the question bank are **group-scoped** — a teacher's
    questions/homework only reach students in the group they teach.
- **Free tier:** visitors/non-subscribers can watch free-preview lessons and
  answer the first `FREE_TIER_QUESTION_LIMIT` (default 10) questions.
- **Math in questions:** visual equation toolbar (KaTeX) — teachers click
  symbols (fraction, power, root, ∫, ∑, π …); stored as `$LaTeX$` and rendered
  everywhere with `MathText`.
- **Per-question video:** one optional video per question with a
  **before / after answering** toggle.
- **Exam engine:** personal simulator + teacher test (difficulty presets,
  immediate/final review), answer map, results, and review (all / wrong only).
- **Groups:** admin creates groups, assigns teachers (by subject) and students.
  Expired students stay in the group with an "expired" badge.
- **Teacher analytics:** scoped to the teacher's own group + subject only.
- **Subscriptions/payments:** provider-agnostic; dev checkout activates instantly.

---

## Prerequisites

- Python 3.12+
- Node.js 20+

## 1) Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env          # optional; defaults work for local dev
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8010
```

API base: `http://127.0.0.1:8010/api`  ·  Django admin: `/admin/`

> Port 8000 is blocked on this machine, so the app is configured for **8010**.

## 2) Frontend

```powershell
cd frontend
npm install
npm run dev
```

App: `http://localhost:5173`  (reads API base from `frontend/.env` → `VITE_API_URL`)

---

## Demo logins (password: `Passw0rd!`)

| Role | Email |
|------|-------|
| Admin | `admin@platform.test` |
| Teacher (math) | `teacher@platform.test` |
| Subscribed student | `student@platform.test` |
| Free student (no subscription) | `free@platform.test` |

Seed data: 4 subjects, 1 group (`مجموعة الصف الثالث - أ`), 3 math lessons
(lesson 1 free), 54 collection questions across 3 difficulties, 1 homework
question, and 2 sessions.

---

## Connecting real services later

Edit `backend/.env`:

- **Neon:** set `DATABASE_URL` to the pooled Neon connection string
  (`...-pooler...?sslmode=require`), then run `migrate` + `seed`.
- **Bunny Stream:** set `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_TOKEN_KEY`,
  `BUNNY_STREAM_CDN_HOSTNAME`. Until then the player shows a protected-video
  placeholder and the name watermark still renders.
- **Payment gateway:** wire the chosen provider (Paymob/Fawry/Kashier) inside
  `billing/views.py::checkout` and add a webhook to confirm payment before
  calling `_activate`.

---

## API overview

```
POST /api/auth/register/           POST /api/auth/login/     GET/PATCH /api/auth/me/
GET  /api/home/free-content/       GET  /api/videos/<id>/token/
GET  /api/subjects/  /api/subjects/<id>/lessons/  /api/lessons/
POST /api/exams/simulator/         POST /api/exams/teacher/
GET  /api/exams/<id>/              POST /api/exams/<id>/answer/  /finish/
GET  /api/exams/<id>/review/       GET  /api/results/
GET  /api/homework-questions/      GET/POST /api/collection-questions/   (teacher-scoped)
GET  /api/teacher/groups/          GET /api/teacher/groups/<id>/students/
GET  /api/teacher/students/<id>/analytics/
GET  /api/sessions/                GET /api/subscription/    POST /api/subscription/checkout/
CRUD /api/admin/groups/            (+ students/ + teachers/ actions)
GET  /api/admin/subscriptions/     /api/admin/payments/
```
```
