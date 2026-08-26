/**
 * One-time admin creation script. Run this locally (never from the
 * browser, never as an API route) once per new admin account — the app
 * has no "sign up as admin" path anywhere, by design.
 *
 * Usage:
 *   node scripts/seedAdmin.mjs admin@example.com "a-strong-password"
 *
 * What it does:
 *   1. Creates the Firebase Auth user if they don't already exist (or
 *      finds them by email if they do — e.g. you made the account
 *      manually in Step 8 of FIREBASE-SETUP.md).
 *   2. Sets the custom claim `{ admin: true }` on that user — THIS is
 *      the flag firestore.rules' isAdmin() checks, and the flag
 *      app/api/admin/session/route.js now verifies before minting a
 *      session cookie. Without this step, admin login will correctly
 *      keep failing even with the right email/password.
 *   3. Writes a matching `admins/{uid}` Firestore doc for your own
 *      records (not itself used for security — the custom claim is).
 *
 * Requires the same env vars as the rest of the server code
 * (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) to
 * be present — this script loads them from .env.local directly since it
 * runs outside Next.js.
 */
import { config } from "dotenv";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

config({ path: ".env.local" });

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error("Usage: node scripts/seedAdmin.mjs <email> <password>");
  process.exit(1);
}

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  }),
});

const auth = getAuth(app);
const db = getFirestore(app);

async function main() {
  let user;
  try {
    user = await auth.getUserByEmail(email);
    console.log(`Found existing user: ${user.uid}`);
  } catch {
    user = await auth.createUser({ email, password });
    console.log(`Created new user: ${user.uid}`);
  }

  await auth.setCustomUserClaims(user.uid, { admin: true });
  console.log("Set custom claim { admin: true }");

  await db.collection("admins").doc(user.uid).set({
    email,
    role: "admin",
    createdAt: new Date(),
  });
  console.log("Wrote admins/" + user.uid + " Firestore doc");

  console.log("\nDone. This user can now sign in at /admin/login.");
  console.log("Note: if they were already signed in somewhere, they need");
  console.log("to sign out/in again for the new custom claim to take effect");
  console.log("(claims are baked into the ID token at sign-in time).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
