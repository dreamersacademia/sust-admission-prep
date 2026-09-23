/**
 * Creates (or updates the permissions of) a moderator account.
 *
 * Usage:
 *   node scripts/seedModerator.mjs <email> <password> <name> <permissions>
 *
 * <permissions> is a comma-separated list of unit:subject pairs, e.g.:
 *   "A:Physics"
 *   "A:Physics,A:Chemistry"        (one moderator covering two subjects)
 *   "B:Bangla"
 *
 * Examples:
 *   node scripts/seedModerator.mjs rahim@example.com "pass123" "Rahim Sir" "A:Physics"
 *   node scripts/seedModerator.mjs karim@example.com "pass123" "Karim Sir" "A:Chemistry,A:Higher Math"
 *
 * Re-running this for the SAME email updates their permissions in place
 * (e.g. to add a subject, or move them from one unit to another) — it
 * does not create a duplicate account. This is also how you REVOKE
 * access to a specific subject: re-run with the permissions list minus
 * whatever you want removed.
 *
 * Unlike scripts/seedAdmin.mjs, this does NOT set any Firebase custom
 * claim — moderator permissions live entirely in the moderators/{uid}
 * Firestore doc (see lib/server/sessionRole.js), which is what lets you
 * change someone's access instantly without them needing to log out and
 * back in first.
 */
import { config } from "dotenv";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

config({ path: ".env.local" });

const [, , email, password, name, permsArg] = process.argv;

if (!email || !password || !name || !permsArg) {
  console.error('Usage: node scripts/seedModerator.mjs <email> <password> <name> "<unit:subject,unit:subject,...>"');
  console.error('Example: node scripts/seedModerator.mjs rahim@example.com "pass123" "Rahim Sir" "A:Physics"');
  process.exit(1);
}

const permissions = permsArg.split(",").map((pair) => {
  const [unit, ...subjectParts] = pair.split(":");
  const subject = subjectParts.join(":").trim();
  if (!unit || !subject || (unit !== "A" && unit !== "B")) {
    console.error(`Invalid permission entry: "${pair}" — expected format "A:Physics" or "B:Bangla"`);
    process.exit(1);
  }
  return { unit: unit.trim(), subject };
});

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
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
    user = await auth.createUser({ email, password, displayName: name });
    console.log(`Created new user: ${user.uid}`);
  }

  await db.collection("moderators").doc(user.uid).set({
    email,
    name,
    permissions,
    updatedAt: new Date(),
  }, { merge: true });

  console.log("\nPermissions set:");
  permissions.forEach((p) => console.log(`  - Unit ${p.unit}, Subject: ${p.subject}`));
  console.log(`\nDone. ${name} can now sign in at /moderator/login.`);
  console.log("No re-login needed if they were already signed in — permissions");
  console.log("are read fresh from Firestore on every request.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
