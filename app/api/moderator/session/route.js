import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";
import { createModeratorSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/server/moderatorSession";

/**
 * POST /api/moderator/session — log in
 * Body: { idToken } — same pattern as admin: client calls Firebase
 * signInWithEmailAndPassword itself, sends the resulting ID token here.
 *
 * There is no "become a moderator" signup path anywhere, same as admin.
 * A real, valid Firebase login is necessary but NOT sufficient — this
 * route also requires a moderators/{uid} Firestore doc to exist, which
 * only gets created by you running scripts/seedModerator.mjs. A genuine
 * Firebase account that isn't in that collection gets the same generic
 * rejection as a wrong password — never reveal which check failed.
 */
export async function POST(request) {
  const { idToken } = await request.json();
  const genericError = () =>
    NextResponse.json({ error: "ইমেইল বা পাসওয়ার্ড সঠিক নয়।" }, { status: 401 });

  if (!idToken) return genericError();

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return genericError();
  }

  const modSnap = await adminDb.collection("moderators").doc(decoded.uid).get();
  if (!modSnap.exists) return genericError();

  const token = await createModeratorSessionToken({ uid: decoded.uid, email: decoded.email });

  const response = NextResponse.json({
    ok: true,
    permissions: modSnap.data().permissions || [],
    name: modSnap.data().name || decoded.email,
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}