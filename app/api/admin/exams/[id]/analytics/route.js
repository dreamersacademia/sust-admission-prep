import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { verifyAdminSessionToken, SESSION_COOKIE } from "@/lib/server/adminSession";
import { getOrPublishAnalytics } from "@/lib/server/examAnalytics";

/**
 * GET /api/admin/exams/[id]/analytics
 *
 * Backs the admin "View results" page and its PDF export: rank, name,
 * college, score — no phone number, by design (per spec). College now
 * comes straight off the same merit data every student sees on their own
 * result page (see lib/server/examAnalytics.js) — no separate join
 * needed, since college isn't sensitive the way a phone number is.
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

  const { merit, stats } = await getOrPublishAnalytics(examId, questions);

  return NextResponse.json({
    exam: { id: examId, title: exam.title, unit: exam.unit, totalMarks: exam.totalMarks },
    merit,
    stats,
  });
}