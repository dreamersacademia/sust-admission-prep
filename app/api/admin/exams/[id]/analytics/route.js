import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { verifyAdminSessionToken, SESSION_COOKIE } from "@/lib/server/adminSession";
import { getOrPublishAnalytics } from "@/lib/server/examAnalytics";

/**
 * GET /api/admin/exams/[id]/analytics
 *
 * Answers your question — "how does the admin get results + leaderboard
 * for a PDF sheet?" — this route, plus the "Download PDF" button on
 * app/admin/results/[id]/page.jsx that calls it.
 *
 * Deliberately a SEPARATE route from the student-facing
 * /api/exam/[id]/result, not a shared response: that route is shown to
 * every student who checks their own result, so it can never carry phone
 * numbers. This one is admin-only and joins each registered student's
 * phone number in specifically for the admin's own record-keeping — a
 * student's 6-digit login ID itself is never shown here either (it's
 * hashed, unrecoverable, and functions as a password — a phone number is
 * the closest real "who is this" reference an admin actually needs, and
 * it's not secret to the admin the way the login ID is).
 */
export async function GET(request, { params }) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifyAdminSessionToken(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const examId = params.id;
  const examSnap = await adminDb.collection("exams").doc(examId).get();
  if (!examSnap.exists) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  const exam = examSnap.data();

  const questionsSnap = await adminDb.collection("exams").doc(examId).collection("questions").get();
  const questions = questionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const { meritWithUids, merit, stats } = await getOrPublishAnalytics(examId, questions);
  const meritSource = meritWithUids || merit; // meritWithUids only present on first computation

  // Join phone numbers for registered (non-guest) entries. Cheap enough
  // as a one-off per exam (not per request — the underlying analytics
  // are cached after their first computation).
  const uids = meritSource.filter((e) => !e.isGuest && e.studentAuthUid).map((e) => e.studentAuthUid);
  const mobileByUid = {};
  await Promise.all(
    uids.map(async (uid) => {
      const snap = await adminDb.collection("students").doc(uid).get();
      if (snap.exists) mobileByUid[uid] = snap.data().mobile;
    })
  );

  const fullMerit = meritSource.map(({ studentAuthUid, ...entry }) => ({
    ...entry,
    mobile: entry.isGuest ? null : mobileByUid[studentAuthUid] || null,
  }));

  return NextResponse.json({
    exam: { id: examId, title: exam.title, unit: exam.unit, totalMarks: exam.totalMarks },
    merit: fullMerit,
    stats,
  });
}
