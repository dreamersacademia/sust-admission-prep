import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

/**
 * Used by the admin CSV bulk-uploader when creating student records —
 * never store the raw 6-digit Student ID (it's functionally a password).
 */
export async function hashStudentId(rawId) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(rawId, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Used by /api/auth/login to check a submitted ID against the stored hash
 * without ever comparing plain text, and using a timing-safe comparison
 * so response time can't leak how much of the ID matched.
 */
export async function verifyStudentId(rawId, storedHash) {
  const [salt, key] = (storedHash || "").split(":");
  if (!salt || !key) return false;
  const keyBuffer = Buffer.from(key, "hex");
  const derivedKey = await scryptAsync(rawId, salt, 64);
  return keyBuffer.length === derivedKey.length && timingSafeEqual(keyBuffer, derivedKey);
}
