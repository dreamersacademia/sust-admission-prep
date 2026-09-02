import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { verifyAdminSessionToken, SESSION_COOKIE } from "@/lib/server/adminSession";

/**
 * GET /api/admin/students/export
 *
 * Deliberately never includes a Student ID — that field is stored only
 * as a hash (see lib/server/studentAuth.js's hashStudentId), the same
 * way a password would be, and there is no way to reverse a hash back
 * into the original value. This isn't a gap to fix; it's the whole point
 * of hashing it in the first place — even a full database leak wouldn't
 * hand out working student credentials.
 *
 * What this DOES give the admin: everything else about who's
 * registered — name, phone, college, unit permission, track, and when
 * they signed up — as one list, ready to paste into a spreadsheet.
 */
export async function GET(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyAdminSessionToken(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await adminDb.collection("students").orderBy("createdAt", "desc").get();

  const students = snap.docs.map((d) => {
    const data = d.data();
    return {
      name: data.name || "",
      mobile: data.mobile || "",
      college: data.college || "",
      unitPermission: data.unitPermission || "",
      track: data.track || "",
      registeredVia: data.createdBy === "self-registration" ? "self" : "admin",
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null,
    };
  });

  return NextResponse.json({ students });
}