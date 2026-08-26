import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

/**
 * Server-only. Never import this from a "use client" file — the service
 * account key must never reach the browser bundle.
 *
 * Env vars needed (put in `.env.local`, never commit it — it's already in
 * .gitignore):
 *   FIREBASE_PROJECT_ID=
 *   FIREBASE_CLIENT_EMAIL=
 *   FIREBASE_PRIVATE_KEY=   (paste with \n literal newlines, see below)
 *
 * Get these from Firebase Console → Project settings → Service accounts →
 * Generate new private key. That JSON file has `project_id`,
 * `client_email`, and `private_key` — map them 1:1 into the three env vars
 * above. For FIREBASE_PRIVATE_KEY, wrap it in quotes and keep the \n
 * escape sequences as literal text; the code below converts them back to
 * real newlines.
 */
function getAdminApp() {
  if (getApps().length) return getApps()[0];

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}

export const adminDb = getFirestore(getAdminApp());
export const adminAuth = getAuth(getAdminApp());

/**
 * Verifies the ID token sent from the client (Authorization: Bearer <token>)
 * and returns the decoded token, or null if missing/invalid. Every route
 * below calls this first — nothing runs on unverified identity.
 */
export async function verifyRequest(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;
  try {
    return await adminAuth.verifyIdToken(token);
  } catch {
    return null;
  }
}
