# SUST Admission Prep — Free Exams

Lightweight Next.js app for free SUST admission mock exams: MCQ exam with a
timer, Bengali + LaTeX question rendering, instant server-scored results,
per-question video/explanation solutions, and a merit list leaderboard.
Runs entirely on free tiers (Vercel + Supabase Postgres, or SQLite locally).

## Folder structure

```
sust-admission-prep/
├── prisma/
│   ├── schema.prisma        # Exam, Question, Submission models
│   └── seed.ts              # sample exam w/ Bengali + LaTeX questions
├── lib/
│   ├── prisma.ts            # Prisma client singleton
│   └── shuffle.ts           # seeded per-student question/option shuffle
├── components/
│   ├── KatexText.tsx        # mixed Bengali text + $...$ / $$...$$ renderer
│   ├── Timer.tsx             # countdown w/ auto-submit
│   └── MeritTable.tsx        # leaderboard table
├── app/
│   ├── layout.tsx / globals.css
│   ├── page.tsx              # home: list of active exams
│   ├── exam/[examId]/
│   │   ├── page.tsx          # server: loads exam (answers stripped)
│   │   ├── ExamRunner.tsx    # client: MCQ UI, timer, anti-cheat, submit
│   │   └── ResultView.tsx    # client: score + explanations + video links
│   ├── merit/[examId]/page.tsx  # server: sorted leaderboard
│   └── api/
│       ├── exam/[examId]/route.ts    # GET questions (no answers)
│       ├── submit/route.ts           # POST: server-side scoring
│       └── merit/[examId]/route.ts   # GET leaderboard JSON
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## Database schema (see `prisma/schema.prisma`)

- **Exam** — title, subject, durationMinutes, isActive, shuffleQuestions
- **Question** — belongs to Exam; text/options support inline `$..$` and
  block `$$..$$` LaTeX; `marks` (awarded if correct) and `negativeMarks`
  (deducted if wrong — set to `0` per question to disable negative
  marking for that question, e.g. general knowledge items); skipped
  questions are never penalized; `correctOption`, `explanation`,
  `videoUrl` are never sent to the client until after submission
- **Submission** — studentName, studentRoll, score, totalMarks,
  timeTakenSeconds, answers (JSON), tabSwitchCount; indexed on
  `(examId, score, timeTakenSeconds)` for fast merit-list sorting

## Cheat-resistance built in

1. **Answers never reach the browser before submission** — both the
   `/api/exam/[examId]` route and the server-rendered exam page strip
   `correctOption`, `explanation`, and `videoUrl`. Opening dev tools /
   network tab reveals nothing.
2. **Scoring happens server-side only**, from the DB record, in
   `/api/submit`. A tampered client-side score is never trusted.
   **Negative marking** is per-question (`negativeMarks`), applied only
   to answered-but-wrong responses — skipping a question never costs
   marks. Final score floors at 0 (edit the floor in `submit/route.ts`
   if your exam wants it to go negative).
3. **Submitted time is clamped** to the exam duration + small grace, so a
   tampered `timeTakenSeconds` can't win the leaderboard tiebreak.
4. **Per-student shuffle** (`lib/shuffle.ts`) — deterministic per browser
   session, so neighbors don't share identical question/option order.
5. **Tab-switch detection**, right-click/copy/cut blocking, and a
   fullscreen prompt discourage (not guarantee — no client-side measure
   can fully prevent) looking things up mid-exam.
6. **One attempt per browser session** via a `sessionStorage` guard, plus
   `beforeunload` warning against accidental exits.

None of steps 4–6 stop a determined cheater with a second device — that's
true of any browser-based exam. The scoring/answer-secrecy in 1–3 is the
part that actually matters and is enforced server-side.

## Local setup

```bash
npm install
# Local dev: switch schema.prisma datasource provider to "sqlite"
# and set DATABASE_URL="file:./dev.db" in .env
npx prisma migrate dev --name init
npm run seed
npm run dev
```

## Deploying free

1. **Database**: create a free [Supabase](https://supabase.com) project →
   copy the Postgres connection string (use the "connection pooling" URI
   for serverless) → set as `DATABASE_URL` in Vercel env vars.
2. Keep `schema.prisma` provider as `"postgresql"`.
3. Push schema: `npx prisma migrate deploy` (or `db push` for a quick
   start), then `npm run seed` once against the prod `DATABASE_URL`.
4. **Hosting**: push this repo to GitHub → import into
   [Vercel](https://vercel.com) → set `DATABASE_URL` env var → deploy.
   Vercel's free tier and Supabase's free tier both cover this app's
   traffic comfortably for a student-run exam site.
5. Add real exams/questions either via `prisma/seed.ts` or a simple
   Prisma Studio session (`npx prisma studio`) against the prod DB.

## Adding video solutions

Set `videoUrl` on any `Question` to a YouTube link (e.g.
`https://www.youtube.com/watch?v=...`). It only appears in `ResultView`
after that student has submitted the exam.
