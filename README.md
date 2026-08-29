# SUST Admission Prep — Phase 1 Setup Guide

This is written for **zero programming background**. Follow it top to bottom,
copy-pasting each command exactly. Every step tells you what it does and
what you should see afterward, so you can tell right away if something went
wrong.

Phase 1 = the whole frontend, running on **mock JSON data** (no real
database yet). This lets you demo the real interface to your team today.
Phase 2 (later, separate guide) swaps the mock data for real Firebase.

---

## 0. One-time tools install (skip anything you already have)

You said you want this hassle-free — so here's the minimum, not everything
you *could* install.

1. **Node.js** (this gives you `npm`, the tool that installs everything
   else). Download the **LTS** version from https://nodejs.org and run the
   installer — click Next through the defaults.
2. **VS Code** (a free code editor) — https://code.visualstudio.com — click
   Next through the defaults.
3. **A terminal.** You don't need anything special:
   - Windows: open VS Code, then menu **Terminal → New Terminal**.
   - Mac: same — **Terminal → New Terminal** inside VS Code.

Verify Node installed correctly. Open a terminal and paste:

```bash
node -v
npm -v
```

You should see two version numbers (e.g. `v20.14.0` and `10.7.0`). If you
see "command not found," restart your laptop and try again — Node needs a
fresh terminal to be recognized.

---

## 1. Create the project

Pick a folder you'll remember (e.g. Desktop), open a terminal there, and run:

```bash
npx create-next-app@14.2.5 sust-admission-prep --js --tailwind --eslint --app --no-src-dir --import-alias "@/*"
```

When it asks questions, these flags already answered them, but if prompted
again just press Enter to accept defaults. This creates a folder called
`sust-admission-prep` with a working Next.js app inside it.

Move into the folder — **every command from now on runs inside it**:

```bash
cd sust-admission-prep
```

---

## 2. Install the extra libraries this project needs

Copy-paste this whole block at once:

```bash
npm install next-themes framer-motion katex react-katex lucide-react clsx tailwind-merge
```

This installs:
| Package | What it's for |
|---|---|
| `next-themes` | Dark/Light mode switching |
| `framer-motion` | Mascot + UI animations |
| `katex` + `react-katex` | Rendering math equations (Physics, Higher Math) |
| `lucide-react` | Icons |
| `clsx` + `tailwind-merge` | Small helpers for combining CSS classes cleanly |

Wait until it finishes (you'll see your terminal prompt return). This can
take 1–3 minutes.

---

## 3. Copy in the project files

`create-next-app` already built a starter project. You now **replace/add**
the files below with the ones from this guide (all provided separately as
downloadable files — copy them into the matching path, overwriting where a
file already exists):

```
sust-admission-prep/
├── app/
│   ├── layout.jsx              ← replace the default one
│   ├── page.jsx                ← replace the default one
│   ├── globals.css             ← replace the default one
│   ├── login/
│   │   └── page.jsx
│   ├── dashboard/
│   │   └── page.jsx
│   ├── exam/
│   │   └── [id]/
│   │       └── page.jsx
│   ├── result/
│   │   └── [id]/
│   │       └── page.jsx
│   ├── public-exam/
│   │   └── [id]/
│   │       └── page.jsx
│   └── admin/
│       ├── login/
│       │   └── page.jsx
│       └── dashboard/
│           └── page.jsx
├── components/
│   ├── ThemeProvider.jsx
│   ├── ThemeToggle.jsx
│   ├── MathRenderer.jsx
│   ├── Mascot.jsx
│   └── Footer.jsx
├── lib/
│   ├── mockData.js
│   ├── attemptStore.js
│   ├── timeWindow.js
│   └── utils.js
├── mock/
│   ├── mockExams.json
│   ├── mockQuestions.json
│   └── mockMerit.json
├── tailwind.config.js          ← replace the default one
├── postcss.config.js
└── jsconfig.json
```

**Where does each folder go?**
- `app/` → every folder inside here becomes a URL. `app/dashboard/page.jsx`
  is the page at `yoursite.com/dashboard`. Folders named `[id]` mean "any
  value here" — `app/exam/[id]/page.jsx` handles `/exam/live-001`,
  `/exam/practice-002`, etc., automatically.
- `components/` → reusable pieces used across multiple pages (the mascot,
  the math renderer, the theme toggle).
- `lib/` → plain JavaScript helper code, no visual UI.
- `mock/` → the fake exam/question data standing in for the database until
  Phase 2.

---

## 4. Run it

```bash
npm run dev
```

Your terminal will print something like:

```
- Local:   http://localhost:3000
```

Open that link in your browser. You should land on the **login page**. Log
in with any 11-digit number starting with `01` and any 6-digit ID (mock
data doesn't check against a real database yet) — you'll be dropped into
the dashboard.

To stop the server: click into the terminal and press `Ctrl + C`.

**Every time you come back to work on this later:** open a terminal inside
the `sust-admission-prep` folder and run `npm run dev` again. That's it —
you don't need to reinstall anything unless you delete the `node_modules`
folder.

---

## 5. New in this update

Based on your feedback, several rules are now built into the frontend
(simulated with `localStorage` for Phase 1 — every one of these gets a
`// Phase 2:` comment in the code pointing to the real server-side
enforcement it needs):

- **One-time live attempts.** Once you submit a live exam, `/exam/live-001`
  redirects straight to `/result/live-001` forever — the question page
  never renders again for that exam. Practice retakes use a separate
  `?mode=practice` URL that's never locked.
- **Answers lock 1.5s after you tap them.** Tap a different option within
  that window to change your mind; after it locks, a 🔒 icon shows and the
  choice is frozen. This is the "permanent lock" you asked for, with a
  short undo window so a fat-finger tap doesn't cost a question.
- **Live → Archive happens automatically.** Exams don't have a fixed
  "type" anymore in the UI — `lib/timeWindow.js` + the dashboard's
  `classify()` function decide the tab from the current time and whether
  you've attempted it. Submit a live exam, or let its window pass, and it
  moves to Archive on its own.
- **Upcoming links do nothing until go-time.** `/exam/upcoming-001` shows a
  countdown, not the exam — and the dashboard card for it isn't even a
  clickable link.
- **Archive has two distinct states**: an exam you actually took shows
  "ফলাফল" (locked, permanent) *plus* "পুনরায় প্র্যাকটিস করো" (practice
  retake, ungraded); a missed exam shows "প্র্যাকটিস হিসেবে পরীক্ষা দিন"
  instead, with unlimited retakes once you've tried it.
- **Live exam results reveal in two stages**: your raw score shows
  immediately after submitting. Explanations, video links, and the merit
  list stay hidden (`detailsLocked` in `app/result/[id]/page.jsx`) until
  the exam's window closes for everyone — see `mock/mockMerit.json` for
  the combined registered + guest ranking, guests shown with their college.
- **New animated mascot** (`components/Mascot.jsx`) — a proper SVG
  character with blinking eyes and idle bob instead of an emoji, plus an
  optional `ctaLabel`/`onCta` so any screen where the mascot is the main
  content (like the result reveal) always has a way forward instead of
  dead-ending.
- **Footer** with hotline/Facebook/Telegram placeholders and your credit
  line — on the login page. Replace the placeholder links in
  `components/Footer.jsx` with your real ones.
- **`/admin/login`** — a separate, more locked-down entry point for
  admins, not linked from anywhere students can see. `/admin/dashboard`
  now also has a "load exam to edit" dropdown so exams stay editable
  anytime rather than only at creation.

**Important honesty note:** everything above is enforced *in the browser*
for this Phase 1 demo. A student who really wants to could clear their
`localStorage` and reopen a "submitted" exam, or nudge their device clock
to open an upcoming one early. None of that is fixable on the frontend —
it's exactly what Phase 2's Firestore rules + Cloud Functions + server-time
checks are for, and every spot that needs it is already flagged with a
`// Phase 2:` comment so nothing gets missed when we build that layer.

---

## 6. Admin route protection — what's real now, what's still Phase 1

`/admin/dashboard` (and any future `/admin/*` page) is now genuinely
gated by `middleware.js` — typing the URL directly, without ever visiting
`/admin/login`, redirects you back to the login page. This runs
server-side before the page renders, so protected content never even
gets sent to an unauthenticated browser.

What's real: the signed session cookie, the middleware check, the 2-hour
expiry, the logout flow (`/api/admin/session` POST/DELETE using `jose` —
see `lib/server/adminSession.js`).

What's still a placeholder: `POST /api/admin/session` currently accepts
*any* non-empty email/password — there's no real identity check behind
the cookie yet. That's intentional for a zero-setup demo, but it means
the current admin login is "remembers you clicked submit," not "verifies
you're actually an admin." The exact three-step swap for Phase 2 is
written as a comment directly in `app/api/admin/session/route.js`.

---

## 7. What you can demo today

| Route | What it shows |
|---|---|
| `/login` | Student login |
| `/dashboard` | Unit selector (A/B) + 4 exam tabs (Live, Archive, Upcoming, Practice) |
| `/exam/live-001` | Exam engine: countdown timer, autosave indicator, tab-switch anti-cheat alert, exit-confirmation modal |
| `/result/live-001` | Locked (live results hidden until window ends — try `/result/archive-001` instead) |
| `/result/archive-001` | Full result with per-question solutions and mascot reaction |
| `/public-exam/live-001` | Guest mode — no login, name-only entry, feeds leaderboard, no explanations shown |
| `/admin/dashboard` | Exam creator with live LaTeX preview + CSV bulk student uploader UI |

Try switching dark/light mode with the toggle in the corner of the login
and dashboard pages — it's fully wired up.

---

## 8. Where the "fake-ness" lives (so you know what Phase 2 replaces)

Every place that will later talk to Firebase is marked with a comment
starting `// Phase 2:` in the code. The short version:

- All exam/question data comes from `mock/mockExams.json` and
  `mock/mockQuestions.json`, read through `lib/mockData.js`. Phase 2
  replaces the *inside* of those functions with real Firestore reads —
  nothing in your page files needs to change.
- Login doesn't check a real database yet — it accepts any well-formatted
  number/ID.
- The exam timer uses your device's clock. Phase 2 anchors it to server
  time so a student can't cheat by changing their phone's clock.
- Grading happens in the browser (visible if someone inspects the page).
  Phase 2 moves grading to a secured server route so answer keys are never
  sent to the student's device.

---

## 9. If something breaks

- **Blank page / red error overlay** → check the terminal running
  `npm run dev` — the real error is printed there, and it's usually a typo
  in a file you copy-pasted.
- **"Module not found"** → you're missing a package. Re-run the install
  command from Step 2.
- **Styles look broken (no colors, plain text)** → make sure you replaced
  `tailwind.config.js` and `app/globals.css` with the versions from this
  project, not the default ones `create-next-app` generated.
- **Still stuck** → copy the exact error text from the terminal and send it
  over — that's always the fastest way to debug.
