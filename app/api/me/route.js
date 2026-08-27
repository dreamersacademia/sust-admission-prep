import { NextResponse } from "next/server";
import { adminDb, verifyRequest } from "@/lib/server/firebaseAdmin";

/**
 * GET /api/me
 *
 * This is what was missing: the dashboard and result page were calling
 * `getCurrentStudent()` straight from the mock data file, unconditionally
 * — logging in with a REAL Student ID had no effect on what name showed,
 * because nothing ever fetched the real profile. `firebaseReady` alone
 * doesn't fix that; it only decides which branch a function takes, and
 * this branch didn't exist yet.
 */
export async function GET(request) {
  const decoded = await verifyRequest(request);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await adminDb.collection("students").doc(decoded.uid).get();
  if (!snap.exists) return NextResponse.json({ error: "Student profile not found" }, { status: 404 });

  const data = snap.data();
  return NextResponse.json({
    student: {
      id: snap.id,
      name: data.name,
      mobile: data.mobile,
      unitPermission: data.unitPermission,
      track: data.track,
    },
  });
}
