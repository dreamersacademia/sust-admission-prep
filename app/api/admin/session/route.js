import { NextResponse } from "next/server";
import { createAdminSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/server/adminSession";
import { adminAuth } from "@/lib/server/firebaseAdmin";

/**
 * POST /api/admin/session  — log in, set the session cookie
 * DELETE /api/admin/session — log out, clear it
 *
 * Real verification now (no more placeholder): the client first calls
 * Firebase `signInWithEmailAndPassword` itself (see app/admin/login/page.jsx),
 * gets an ID token, and sends THAT here instead of a raw password. This
 * route verifies the token is genuine and checks the `admin: true` custom
 * claim — set by scripts/seedAdmin.mjs — before minting the session
 * cookie. A valid Firebase login that ISN'T an admin (e.g. someone signed
 * up some other way) still gets rejected here.
 *
 * If Firebase isn't configured yet (.env.local not filled in), this
 * throws when adminAuth tries to verify — which is correct: there should
 * be no way to "log in as admin" before a real admin account exists.
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

  if (decoded.admin !== true) {
    // A genuine, successfully-authenticated Firebase user — just not an
    // admin. Same generic message either way; never confirm which part
    // of "is this person an admin" failed.
    return genericError();
  }

  const token = await createAdminSessionToken({ email: decoded.email, uid: decoded.uid, admin: true });

  const response = NextResponse.json({ ok: true });
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
