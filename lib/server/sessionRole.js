import { verifyAdminSessionToken, SESSION_COOKIE as ADMIN_COOKIE } from "@/lib/server/adminSession";
import { verifyModeratorSessionToken, SESSION_COOKIE as MODERATOR_COOKIE } from "@/lib/server/moderatorSession";
import { adminDb } from "@/lib/server/firebaseAdmin";

/**
 * The shared question-CRUD routes (app/api/admin/exams/[id]/questions/...)
 * call this ONCE to find out who's asking, then canEditSubject() to
 * decide if that specific write is allowed. This is the real security
 * boundary — not the frontend, which is why the moderator dashboard can
 * only ever SHOW a restricted UI, while this is what actually enforces
 * it even against a hand-crafted request.
 *
 * A moderator's permissions are read fresh from Firestore on every call,
 * not baked into their session token — revoking or changing what someone
 * can touch takes effect on their very next request, no re-login needed.
 */
export async function resolveSession(request) {
  const adminToken = request.cookies.get(ADMIN_COOKIE)?.value;
  if (adminToken) {
    const session = await verifyAdminSessionToken(adminToken);
    if (session) return { role: "admin", email: session.email, uid: session.uid };
  }

  const modToken = request.cookies.get(MODERATOR_COOKIE)?.value;
  if (modToken) {
    const session = await verifyModeratorSessionToken(modToken);
    if (session) {
      const modSnap = await adminDb.collection("moderators").doc(session.uid).get();
      if (!modSnap.exists) return null; // access revoked since they logged in
      return {
        role: "moderator",
        email: session.email,
        uid: session.uid,
        permissions: modSnap.data().permissions || [],
      };
    }
  }

  return null;
}

/** True if this session may add/edit/delete a question for this unit+subject. */
export function canEditSubject(session, unit, subject) {
  if (!session) return false;
  if (session.role === "admin") return true; // full control, per spec
  return session.permissions.some((p) => p.unit === unit && p.subject === subject);
}