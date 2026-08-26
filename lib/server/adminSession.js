import { SignJWT, jwtVerify } from "jose";

/**
 * This is what actually makes /admin/* protected: a short-lived, signed
 * session token in an httpOnly cookie, checked by middleware.js on EVERY
 * request to an admin route — not just "does the login page redirect
 * correctly," which is easy to bypass by typing the destination URL
 * directly (exactly what got flagged).
 *
 * Uses `jose` instead of `jsonwebtoken` because jose runs on WebCrypto,
 * which works in Next.js Middleware's Edge runtime. `firebase-admin`
 * does NOT work in Edge middleware — that's why identity verification
 * (is this really an admin?) happens in the API route below using
 * firebase-admin, and only the resulting short-lived token gets checked
 * at the edge on every subsequent request.
 */
const SESSION_COOKIE = "admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 2; // 2 hours — re-login after that

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    // Phase 1 fallback so `npm run dev` keeps working with zero setup.
    // Phase 2 MUST set a real ADMIN_SESSION_SECRET in .env.local — a
    // guessable/default secret means anyone can forge an admin session.
    return new TextEncoder().encode("dev-only-insecure-secret-change-me");
  }
  return new TextEncoder().encode(secret);
}

export async function createAdminSessionToken(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyAdminSessionToken(token) {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload;
  } catch {
    return null; // expired, tampered, or missing — all treated the same
  }
}

export { SESSION_COOKIE, SESSION_TTL_SECONDS };
