# KVISdom Learning Portal

KVISdom is now set up as a student-facing STEM quiz portal with a KVIS green and purple theme. Students can create accounts, take published quizzes, and track scores. Admins can unlock the quiz studio with an admin code and create Google Forms-style multiple-choice quizzes.

## Run locally

```bash
npm install
npm run dev
```

If `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are not set, the app runs in local demo mode with seeded quizzes and browser storage.

Demo users:

- `student@kvisdom.local` / `kvisdom`
- `admin@kvisdom.local` / `kvisdom`

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Copy `.env.example` to `.env`.
4. Fill in `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_ADMIN_CODE`.
5. Restart the dev server.

V1 supports multiple-choice quizzes, automatic scoring, result history, and an admin-code gate.
