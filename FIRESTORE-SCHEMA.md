# Firestore Schema — Phase 2

Every collection below maps to one Phase 1 mock file:
`mockExams.json` → `exams`, `mockQuestions.json` → `exams/{id}/questions`,
`mockMerit.json` → `leaderboards`, and `lib/attemptStore.js` (localStorage)
→ `attempts`. Nothing in the Phase 1 page components changes — only the
inside of `lib/mockData.js`'s functions gets swapped for real reads.

---

## `students/{studentId}`

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `mobile` | string | E.164-ish, e.g. `01812345678` — used for login lookup |
| `studentIdHash` | string | **Never store the raw 6-digit ID.** Hash it (bcrypt/scrypt) the same way you'd hash a password — it functions as one |
| `unitPermission` | `"A_ONLY" \| "B_ONLY" \| "BOTH"` | Admin-assigned |
| `track` | `"science" \| "humanities" \| "commerce"` | Drives the B-Unit smart UI split |
| `authUid` | string \| null | Set on first successful login (linked to a Firebase Auth custom-token user) |
| `createdBy` | string | Admin UID |
| `createdAt` | timestamp | |

**Login flow:** student submits mobile + 6-digit ID to
`POST /api/auth/login` → API route looks up by `mobile`, compares the
hash, and if it matches, mints a Firebase custom token via the Admin SDK
and signs the student in client-side with it. The student never gets a
password — the "password" is verified once, server-side, per login.

---

## `admins/{adminUid}`

| Field | Type | Notes |
|---|---|---|
| `email` | string | |
| `role` | `"admin"` | Also mirrored into the Auth custom claim `admin: true` — rules check the claim, not this doc, for speed |
| `createdAt` | timestamp | |

Only 2-3 of these ever exist, created once via a setup script — there is
no "become an admin" path anywhere in the app.

---

## `exams/{examId}`

| Field | Type | Notes |
|---|---|---|
| `title` | string | |
| `type` | `"live" \| "practice"` | Phase 1's upcoming/archive were *computed*, not stored — same here: derive the tab from `startAt`/`endAt`/attempt state, don't store "archive" as a status that can drift out of sync |
| `unit` | `"A" \| "B"` | |
| `track` | string \| null | For B-Unit science-vs-shared filtering |
| `subject`, `scope` | string | |
| `startAt`, `endAt` | timestamp | Omit both for practice exams |
| `durationMinutes` | number | Per-student time limit, capped by `endAt` |
| `totalMarks`, `questionCount` | number | |
| `isPublic` | boolean | Enables the guest link |
| `status` | `"draft" \| "published"` | Admin can build an exam without it being visible yet |
| `updatedAt`, `updatedBy` | timestamp, string | For the "editable anytime" audit trail |

## `exams/{examId}/questions/{questionId}` — client-read disabled

| Field | Type |
|---|---|
| `text` | string (may contain `$...$` LaTeX) |
| `options` | string[4] |
| `correctIndex` | number |
| `explanation` | string |
| `videoUrl` | string \| null |
| `subject` | string |

This is the one collection every "strict Firestore rules" requirement in
your spec is really about. It's never read from the client — see
`firestore.rules` and the API routes below.

---

## `attempts/{studentId_examId}` — client-read disabled

| Field | Type | Notes |
|---|---|---|
| `studentId` | string | `"GUEST"` for public entries |
| `authUid` | string \| null | null for guests |
| `examId` | string | |
| `isGuest` | boolean | |
| `guestName`, `guestCollege` | string \| null | Only set for guests |
| `isPractice` | boolean | Practice attempts never lock and never count toward merit |
| `status` | `"in_progress" \| "submitted"` | The doc is created the MOMENT the student opens a live exam (not on submit) — see below |
| `answers` | map<questionId, optionIndex> | |
| `correctCount`, `totalMarks` | number | Computed server-side |
| `tabSwitchCount` | number | For admin anti-cheat review |
| `startedAt`, `submittedAt` | timestamp | |

**Why the doc is created on open, not on submit:** this is what makes the
one-time-attempt rule bulletproof against a crashed tab or a closed
browser mid-exam — Phase 1's `localStorage` lock only knows about a
submission that actually completed. A Firestore transaction that creates
`attempts/{studentId}_{examId}` the instant the exam opens (rejecting the
create if the doc already exists) means even "closed the tab and reopened"
can't grant a second attempt.

---

## `leaderboards/{examId}/entries/{attemptId}`

| Field | Type |
|---|---|
| `rank` | number |
| `name` | string |
| `score` | number |
| `isGuest` | boolean |
| `college` | string \| null |

Written once, by the API route, when the exam's window closes — combining
`attempts` where `isPractice == false` for that `examId`, sorted by score.
The parent `leaderboards/{examId}` doc has `published: boolean` — rules
only allow public read once it's `true`, so nobody (guest or otherwise)
can see partial rankings while the exam is still live.

---

## API routes (Next.js, Admin SDK) — replace `lib/mockData.js` internals

| Route | Replaces |
|---|---|
| `POST /api/auth/login` | Phase 1's no-op login |
| `POST /api/auth/login` | ✅ Built |
| `POST /api/exam/[id]/start` | ✅ Built — opens/resumes the attempt with an immutable, transaction-safe deadline (closes the "reopen for a fresh timer" gap) |
| `GET /api/exams` | ✅ Built — list, for the dashboard tabs |
| `GET /api/exam/[id]` | ✅ Built — single exam metadata |
| `GET /api/exam/[id]/questions` | ✅ Built |
| `POST /api/exam/[id]/submit` | ✅ Built |
| `POST /api/exam/[id]/guest-submit` | ✅ Built — public-link entry, no auth (see the open gap noted in its file re: one-attempt enforcement) |
| `GET /api/exam/[id]/result` | ✅ Built — two-stage reveal + computes/caches the leaderboard on first read after window close |
| `POST /api/admin/session` | ✅ Built — real Firebase ID token + admin-claim verification |
| `POST /api/admin/exams` | ✅ Built — create/edit an exam + its full question set atomically |
| `POST /api/admin/students/bulk` | ✅ Built — generates + hashes each `studentId` before writing, gated by the admin session cookie |

**Not yet built:** just the exam-editing "confirm you're editing a live
exam" extra step, and per-guest attempt-limiting (both already flagged
honestly in their route files' comments above). Everything else,
including the frontend actually calling these routes, is done — see
`lib/dataLayer.js`, which is the one file every page now goes through.
`firebaseReady` (from `lib/firebaseClient.js`) decides at runtime whether
a page hits the real API or the Phase 1 mock data — nothing else needs to
change when `.env.local` gets filled in.

Two of these — `submit` and `result` — are stubbed out with real Admin SDK
code in this delivery (`app/api/exam/[id]/submit/route.js` and
`app/api/exam/[id]/questions/route.js`) so you can see the actual pattern;
the rest follow the same shape.
