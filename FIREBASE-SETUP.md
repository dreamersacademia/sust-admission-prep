# Firebase Project Setup — Step by Step

Written the same way as the main README: no programming background assumed,
copy-paste every command exactly. Takes about 15–20 minutes.

By the end of this, you'll have real values to paste into `.env.local` —
which is the one thing standing between the current mock demo and the real
backend everything in `FIRESTORE-SCHEMA.md` and `firestore.rules` was
built for.

---

## 1. Create the Firebase project

1. Go to https://console.firebase.google.com and sign in with a Google
   account (create one if you don't have it — it's free).
2. Click **Add project**.
3. Name it `sust-admission-prep` (or anything — this name is just for
   your own reference in the console, students never see it).
4. When asked about Google Analytics: turn it **off**. You don't need it
   for this project and it's one less thing to configure.
5. Click **Create project**, wait ~30 seconds, then **Continue**.

---

## 2. Register a Web App (gives you the client-side config)

1. On the project's home screen, click the **`</>`** (Web) icon.
2. App nickname: `sust-admission-prep-web`. Leave "Firebase Hosting"
   **unchecked** — you're deploying with Vercel, not Firebase Hosting.
3. Click **Register app**.
4. You'll see a code block with a `firebaseConfig` object — six values:
   `apiKey`, `authDomain`, `projectId`, `storageBucket`,
   `messagingSenderId`, `appId`. **Keep this tab open**, you'll copy these
   into `.env.local` in Step 6.
5. Click **Continue to console** (you don't need the SDK install
   instructions it shows — that's already handled by `package.json`).

---

## 3. Turn on Firestore (the database)

1. In the left sidebar: **Build → Firestore Database**.
2. Click **Create database**.
3. Location: pick the region closest to Bangladesh with good coverage —
   `asia-south1` (Mumbai) is a reasonable default if you're unsure. This
   **cannot be changed later**, so take a moment here, but don't overthink
   it — any nearby region works fine for a few hundred concurrent students.
4. Start mode: choose **Start in production mode** (NOT test mode — test
   mode leaves the database wide open, and you already have a real
   `firestore.rules` file ready to deploy in Step 7).
5. Click **Create**.

---

## 4. Turn on Authentication

1. Left sidebar: **Build → Authentication**.
2. Click **Get started**.
3. Under **Sign-in method**, enable:
   - **Email/Password** — this is what admins log in with.
   - Leave everything else off. Students never sign in with
     email/password — they get a **custom token** minted server-side
     after your API verifies their mobile + 6-digit ID, which doesn't
     need a sign-in method enabled here.

---

## 5. Generate the Admin SDK service account key

This is the credential your Next.js API routes use to talk to Firestore
with full (Admin SDK) access — the one that bypasses `firestore.rules` on
purpose, because it's your trusted server code, not a student's browser.

1. Click the ⚙️ gear icon (top-left, next to "Project Overview") →
   **Project settings**.
2. Go to the **Service accounts** tab.
3. Click **Generate new private key** → confirm **Generate key**.
4. A `.json` file downloads. **Treat this file like a password** — anyone
   with it has full admin access to your database. Don't email it, don't
   commit it to GitHub, don't put it in a shared Drive folder without
   restricted access.

---

## 6. Fill in `.env.local`

In your project folder (`sust-admission-prep/`), copy the example file:

```bash
cp .env.local.example .env.local
```

Open `.env.local` in VS Code and fill in two groups of values:

**From Step 2's `firebaseConfig` block:**
```
NEXT_PUBLIC_FIREBASE_API_KEY=<apiKey>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<authDomain>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<projectId>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<storageBucket>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<messagingSenderId>
NEXT_PUBLIC_FIREBASE_APP_ID=<appId>
```

**From the downloaded service account `.json` file (Step 5):**
```
FIREBASE_PROJECT_ID=<the "project_id" field>
FIREBASE_CLIENT_EMAIL=<the "client_email" field>
FIREBASE_PRIVATE_KEY=<the "private_key" field>
```

For `FIREBASE_PRIVATE_KEY`: the value in the JSON file looks like
`"-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"`.
Paste the **whole thing including the quotes and `\n` characters exactly
as they appear** — don't try to "clean it up," the code already handles
converting `\n` back into real newlines.

**Also generate the admin session secret** (used for the admin-login
cookie you already have working):

```bash
openssl rand -base64 32
```

Paste the output as `ADMIN_SESSION_SECRET=` in `.env.local`.

`.env.local` is already in `.gitignore` — it will never accidentally get
committed or uploaded anywhere by the normal `git` workflow.

---

## 7. Install the Firebase CLI and deploy your security rules

```bash
npm install -g firebase-tools
firebase login
```

This opens a browser window to sign in with the same Google account.

Back in your project folder:

```bash
firebase init firestore
```

When prompted:
- "Please select an option": **Use an existing project** → pick
  `sust-admission-prep`.
- "What file should be used for Firestore Rules?": it will suggest
  `firestore.rules` — **press Enter to accept** (you already have this
  file with the real rules in it — don't let it overwrite yours; if it
  asks to overwrite, say **No**).
- "What file should be used for Firestore indexes?": accept the default.

Now deploy the rules that are already sitting in your project:

```bash
firebase deploy --only firestore:rules
```

You should see `✔ Deploy complete!`. Your database is now locked down
exactly as `firestore.rules` describes — `questions` and `attempts`
unreadable by any client, `exams` readable, `leaderboards` public only
once published.

---

## 8. Create your first admin account

Firestore has no data yet, and there's no "sign up as admin" page by
design (see `app/admin/login/page.jsx`'s comments). You create the first
admin once, directly:

1. **Authentication → Users tab → Add user.**
2. Enter your email and a strong password. Click **Add user**.
3. You now have a real Firebase Auth account — but it doesn't have the
   `admin: true` custom claim yet, which is what `firestore.rules` and
   the admin API routes actually check. Setting that claim requires a
   one-time script using the Admin SDK (can't be done from the console
   UI). Ask me for this script when you're ready for it — it's a ~15-line
   Node file you run once per new admin.

---

## 9. Verify everything is connected

Run the dev server as usual:

```bash
npm run dev
```

The Phase 1 mock pages will look and behave exactly the same right now —
`.env.local` having real values doesn't change anything until the pages
are switched to call the API routes instead of `lib/mockData.js`. That
switch is the next phase, and it's a small, safe change now that this
foundation exists.

---

## If something breaks here

- **"Failed to parse private key"** when an API route runs → the
  `FIREBASE_PRIVATE_KEY` value got mangled when pasting (quotes stripped,
  or real newlines instead of `\n`). Re-copy it directly from the `.json`
  file, keep it as one single-line value with `\n` literally in the text.
- **`firebase deploy` says "not in a Firebase project directory"** → you
  ran it outside the `sust-admission-prep` folder, or `firebase init`
  didn't finish. Re-run `firebase init firestore` from inside the project
  folder.
- **Firestore Database menu is greyed out / missing** → the project
  creation in Step 1 is still finishing in the background — wait a minute
  and refresh.
