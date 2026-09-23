import { SignJWT, jwtVerify } from "jose";

/**
 * Deliberately a SEPARATE cookie name and verify function from
 * lib/server/adminSession.js — not because the signing mechanism needs
 * to differ (it doesn't; same jose/HS256 pattern), but because keeping
 * "admin session" and "moderator session" as two genuinely distinct
 * types makes it structurally impossible for a bug somewhere to read a
 * moderator's cookie and treat it as an admin session. Every route that
 * needs "am I an admin OR a moderator, and which" goes through
 * lib/server/sessionRole.js, which checks both explicitly rather than
 * merging them into one ambiguous concept.
 */
const SESSION_COOKIE = "moderator_session";
const SESSION_TTL_SECONDS = 60 * 60 * 2; // 2 hours, same as admin

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET; // same secret, fine — see file comment above
  if (!secret) {
    return new TextEncoder().encode("dev-only-insecure-secret-change-me");
  }
  return new TextEncoder().encode(secret);
}

export async function createModeratorSessionToken(payload) {
  return await new SignJWT({ ...payload, role: "moderator" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyModeratorSessionToken(token) {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.role !== "moderator") return null; // belt-and-suspenders
    return payload;
  } catch {
    return null;
  }
}

export { SESSION_COOKIE, SESSION_TTL_SECONDS };