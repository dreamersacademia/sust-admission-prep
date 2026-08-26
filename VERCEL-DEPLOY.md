# Deploying to Vercel — Step by Step

Once `FIREBASE-SETUP.md` is done and the app works locally with
`npm run dev`, this is how it goes live on the internet. Vercel is the
natural fit for a Next.js app — same company builds both, zero config
needed for the App Router / API routes you already have.

---

## 1. Push the project to GitHub

If it isn't already a git repo:

```bash
git init
git add .
git commit -m "Initial commit"
```

Create a new **empty** repository on https://github.com/new (don't
initialize it with a README — you already have one), then:

```bash
git remote add origin https://github.com/dreamersacademia/sust-admission-prep.git
git branch -M main
git push -u origin main
```

`.env.local` will NOT be pushed — it's in `.gitignore` on purpose. Your
Firebase credentials never touch GitHub.

---

## 2. Import the project into Vercel

1. Go to https://vercel.com and sign in (GitHub sign-in is the easiest —
   it can then read your repos directly).
2. Click **Add New → Project**.
3. Find `sust-admission-prep` in the repo list and click **Import**.
4. Framework Preset should auto-detect as **Next.js** — leave everything
   else on default.
5. **Don't click Deploy yet** — go to the **Environment Variables**
   section first (next step), or the first deploy will fail with missing
   Firebase config.

---

## 3. Add every environment variable

Open your local `.env.local` side-by-side with Vercel's Environment
Variables section, and add each one exactly as it is locally:

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
ADMIN_SESSION_SECRET
```

Two gotchas specific to Vercel's UI:
- **`FIREBASE_PRIVATE_KEY`** — paste it with the `\n` literally in the
  text, same as in `.env.local`. Vercel's text box handles this fine;
  don't try to convert it to real line breaks.
- Set each variable for **all three environments** (Production, Preview,
  Development) unless you specifically want different Firebase projects
  per environment — for now, same values everywhere is simplest.

## 4. Deploy

Click **Deploy**. First build takes 1–3 minutes. When it finishes, you
get a URL like `sust-admission-prep.vercel.app` — that's the real, live
site, reachable from any phone or laptop, no `npm run dev` needed on your
end anymore.

---

## 5. Point Firebase at your real domain

Firebase Auth needs to know which domains are allowed to use it:

1. Firebase Console → **Authentication → Settings → Authorized domains**.
2. Add your Vercel URL (`sust-admission-prep.vercel.app`), and later your
   real custom domain if you get one (e.g. `sustadmissionprep.com`).

---

## 6. Every future update

Once this is connected, deployment becomes automatic:

```bash
git add .
git commit -m "describe what changed"
git push
```

Vercel rebuilds and redeploys within a minute or two of every push to
`main` — no manual redeploy step. Pushing to any OTHER branch gets its
own preview URL, useful for trying something risky (like editing a live
exam's questions) without touching the real site first.

---

## 7. Before your first real exam with 500+ students

A few things worth doing that aren't "deployment" exactly, but matter at
that scale:

- **Firestore composite indexes**: if any query in the API routes throws
  an error mentioning "requires an index," Firebase's error message
  includes a direct link that creates it with one click — this is normal
  the first time each distinct query pattern runs, not a bug.
- **Vercel's free tier** has function execution limits that 500
  concurrent students hitting `/api/exam/[id]/submit` around the same
  moment could plausibly bump into — worth checking Vercel's current
  pricing/limits page before a big live exam, and upgrading the plan
  ahead of time if needed rather than during.
- **Firebase App Check** (mentioned in a few code comments already) adds
  a layer that blocks requests not coming from your actual deployed app —
  worth turning on before a real public-link exam goes out, since that's
  the one endpoint (`guest-submit`) with no auth at all protecting it.

None of these are required to launch — they're the "things to check if
something feels slow or gets abused" list, worth having once, not
something to solve preemptively before you even have real users.
