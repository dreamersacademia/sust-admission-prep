import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/server/firebaseAdmin";
import { verifyStudentId } from "@/lib/server/studentAuth";

/**
 * POST /api/auth/login
 * Body: { mobile: string, studentId: string }
 *
 * The 6-digit Student ID is treated exactly like a password: looked up by
 * mobile number, checked against a stored hash (never plain text), and on
 * success this mints a short-lived Firebase custom token. The client then
 * calls `signInWithCustomToken(auth, token)` — see lib/firebaseClient.js
 * and app/login/page.jsx — which is what actually establishes their
 * Firebase Auth session for Firestore rule checks (`request.auth.uid`).
 *
 * Same generic-error rule as the admin login: wrong mobile and wrong ID
 * return the identical message, so a bad actor can't use response
 * differences to enumerate valid phone numbers.
 */
export async function POST(request) {
  const { mobile, studentId } = await request.json();
  const genericError = () =>
    NextResponse.json({ error: "মোবাইল নম্বর বা Student ID সঠিক নয়।" }, { status: 401 });

  if (!/^01[3-9]\d{8}$/.test(mobile || "") || !/^\d{6}$/.test(studentId || "")) {
    return genericError();
  }

  const snap = await adminDb
    .collection("students")
    .where("mobile", "==", mobile)
    .limit(1)
    .get();

  if (snap.empty) return genericError();

  const studentDoc = snap.docs[0];
  const student = studentDoc.data();

  const isValid = await verifyStudentId(studentId, student.studentIdHash);
  if (!isValid) return genericError();

  // The student's Firestore doc ID doubles as their Firebase Auth uid —
  // keeps the two systems trivially joinable without a separate mapping
  // table. Set once, on first successful login.
  if (!student.authUid) {
    await studentDoc.ref.update({ authUid: studentDoc.id });
  }

  const customToken = await adminAuth.createCustomToken(studentDoc.id, {
    role: "student",
  });

  return NextResponse.json({ token: customToken });
}
