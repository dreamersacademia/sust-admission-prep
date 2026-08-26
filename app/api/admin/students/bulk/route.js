import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { hashStudentId } from "@/lib/server/studentAuth";
import { verifyAdminSessionToken, SESSION_COOKIE } from "@/lib/server/adminSession";

/**
 * POST /api/admin/students/bulk
 * Body: { rows: [{ phone, name, group }], resetIds?: boolean }
 *   `group` is expected to already be one of "A_ONLY" | "B_ONLY" | "BOTH"
 *   (matches the CSV format described in the admin dashboard UI).
 *
 * Gated by the same admin session cookie middleware.js checks — this is
 * a second, independent check (never trust that middleware ran; API
 * routes verify for themselves too, since a route could theoretically be
 * hit directly).
 *
 * The 6-digit Student ID is generated HERE, server-side, never chosen by
 * anyone — the response includes the plain-text ID exactly once, for the
 * admin to copy and distribute to each student out-of-band (SMS, printed
 * slip, whatever your process is). After this response, only the hash is
 * ever stored — there is no "forgot my ID, look it up" admin feature by
 * design; a lost ID means issuing the student a new one, which is exactly
 * what `resetIds: true` is for below.
 *
 * Re-running the same phone number through this route WITHOUT resetIds
 * now correctly no-ops (reports "exists", doesn't touch their record) —
 * previously it silently created a second, duplicate student doc per
 * re-upload, which would have caused real confusion the first time
 * someone re-ran a CSV with a typo fix.
 */
export async function POST(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyAdminSessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { rows, resetIds = false } = await request.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }

  const results = [];
  const batch = adminDb.batch();

  for (const row of rows) {
    const { phone, name, group } = row;
    if (!/^01[3-9]\d{8}$/.test(phone || "")) {
      results.push({ phone, name, status: "skipped", reason: "Invalid phone" });
      continue;
    }

    const existingSnap = await adminDb
      .collection("students")
      .where("mobile", "==", phone)
      .limit(1)
      .get();

    if (!existingSnap.empty && !resetIds) {
      results.push({ phone, name, status: "exists", reason: "Already registered — check 'reset ID' to reissue" });
      continue;
    }

    const generatedId = String(Math.floor(100000 + Math.random() * 900000));
    const studentIdHash = await hashStudentId(generatedId);
    const unitPermission = ["A_ONLY", "B_ONLY", "BOTH"].includes(group) ? group : "BOTH";

    if (!existingSnap.empty && resetIds) {
      // Reissue: update the SAME doc (keeps their attempt history, name
      // edits, etc. intact) rather than creating a new student identity.
      const docRef = existingSnap.docs[0].ref;
      batch.set(docRef, { name, unitPermission, studentIdHash, updatedAt: new Date() }, { merge: true });
      results.push({ phone, name, status: "id-reset", generatedId });
      continue;
    }

    const docRef = adminDb.collection("students").doc(); // auto-id
    batch.set(docRef, {
      name,
      mobile: phone,
      unitPermission,
      track: null,
      studentIdHash,
      authUid: null,
      createdAt: new Date(),
      createdBy: session.uid || session.email,
    });

    results.push({ phone, name, status: "created", generatedId });
  }

  await batch.commit();

  return NextResponse.json({ results });
}
