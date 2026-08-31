import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { hashStudentId } from "@/lib/server/studentAuth";

const VALID_UNIT_PERMISSIONS = ["A_ONLY", "B_ONLY", "BOTH"];
const VALID_TRACKS = ["science", "humanities_commerce"];

/**
 * POST /api/auth/register
 * Body: { name, phone, college, unitPermission, track? }
 *
 * Self-service version of the admin's CSV bulk-uploader — same
 * generate-and-hash-a-6-digit-ID mechanism (see hashStudentId), same
 * "shown exactly once" rule, just triggered by the student themselves
 * instead of an admin.
 *
 * The one-registration-per-phone-number rule is what stops a student
 * from creating a fresh ID every time they lose theirs — this route
 * flatly refuses if the phone number already has a student doc, no
 * matter how many times it's retried. A lost/forgotten ID is an admin
 * reissue from here on (the existing "Reset the Student ID" flow in the
 * bulk-uploader), not something a student can self-serve — that's the
 * deliberate abuse boundary: unlimited self-registration would mean
 * unlimited ID resets, unlimited exam attempts.
 *
 * No auth required — this is the one path a brand-new student can hit
 * before they have any credentials at all. That does mean it's public
 * and unauthenticated, same trust level as the guest exam link; nothing
 * here is more sensitive than a phone number + name + college, and the
 * generated ID is shown once, exactly like the admin flow.
 *
 * Not implemented, worth knowing: no rate limiting or CAPTCHA on this
 * endpoint yet. The phone-uniqueness check stops the "same student, many
 * IDs" problem this was asked to solve, but it doesn't stop someone
 * scripting many DIFFERENT fake phone numbers to spam student records.
 * Worth adding (App Check, or a simple per-IP rate limit) before this
 * is linked anywhere highly public — fine for a controlled rollout to a
 * known cohort in the meantime.
 */
export async function POST(request) {
  const { name, phone, college, unitPermission, track } = await request.json();

  if (!name?.trim() || !college?.trim()) {
    return NextResponse.json({ error: "নাম ও কলেজের নাম আবশ্যক।" }, { status: 400 });
  }
  if (!/^01[3-9]\d{8}$/.test(phone || "")) {
    return NextResponse.json({ error: "সঠিক ১১ ডিজিটের মোবাইল নম্বর দাও।" }, { status: 400 });
  }
  if (!VALID_UNIT_PERMISSIONS.includes(unitPermission)) {
    return NextResponse.json({ error: "ইউনিট পারমিশন বাছাই করো।" }, { status: 400 });
  }
  const needsTrack = unitPermission === "B_ONLY" || unitPermission === "BOTH";
  if (needsTrack && !VALID_TRACKS.includes(track)) {
    return NextResponse.json({ error: "B-Unit এর জন্য গ্রুপ (সাইন্স / মানবিক+ব্যবসায়) বাছাই করো।" }, { status: 400 });
  }

  const existingSnap = await adminDb
    .collection("students")
    .where("mobile", "==", phone)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    return NextResponse.json(
      { error: "এই নম্বরটি ইতিমধ্যে নিবন্ধিত। আইডি হারিয়ে গেলে অ্যাডমিনের সাথে যোগাযোগ করো — নতুন করে রেজিস্টার করা যাবে না।" },
      { status: 409 }
    );
  }

  const generatedId = String(Math.floor(100000 + Math.random() * 900000));
  const studentIdHash = await hashStudentId(generatedId);

  await adminDb.collection("students").add({
    name: name.trim(),
    mobile: phone,
    college: college.trim(),
    unitPermission,
    track: needsTrack ? track : null,
    studentIdHash,
    authUid: null,
    createdAt: new Date(),
    createdBy: "self-registration",
  });

  return NextResponse.json({ generatedId });
}