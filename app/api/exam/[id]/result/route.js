import { NextResponse } from "next/server";
import { adminDb, verifyRequest } from "@/lib/server/firebaseAdmin";
import { finalizeIfOverdue } from "@/lib/server/examFinalize";
import { getOrPublishAnalytics } from "@/lib/server/examAnalytics";

/**
 * GET /api/exam/[id]/result?mode=practice
 *
 * Mirrors the two-stage reveal built into the frontend
 * (app/result/[id]/page.jsx's `detailsLocked`), except this is the real
 * enforcement — a student calling this endpoint directly while a live
 * exam's window is still open gets the immediate score only.
 *
 * Rules encoded here (per the spec's clarification):
 *   - Official (non-practice) result: score-only while the window is
 *     open, full detail + video + merit FOREVER once it closes — never
 *     re-locked, never expires.
 *   - Practice attempt on an exam you've ALREADY officially completed
 *     (the "পুনরায় প্র্যাকটিস করো" retake button): score-only, always —
 *     the full breakdown already lives permanently in the official
 *     result, no need to duplicate it.
 *   - Practice attempt on an exam you NEVER officially took (a missed
 *     live exam, taken as practice for the first time): full detail
 *     immediately, minus merit — this is the student's only exposure to
 *     the answers, so it should teach, not just score.
 */
export async function GET(request, { params }) {
  const decoded = await verifyRequest(request);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const examId = params.id;
  const isPracticeMode = new URL(request.url).searchParams.get("mode") === "practice";

  const examSnap = await adminDb.collection("exams").doc(examId).get();
  if (!examSnap.exists) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  const exam = examSnap.data();

  await finalizeIfOverdue(examId, decoded.uid);

  const officialAttemptRef = adminDb.collection("attempts").doc(`${decoded.uid}_${examId}`);
  const officialSnap = await officialAttemptRef.get();
  const hasOfficialAttempt = officialSnap.exists && officialSnap.data().status === "submitted";

  const attemptRef = isPracticeMode
    ? adminDb.collection("attempts").doc(`${decoded.uid}_${examId}_practice`)
    : officialAttemptRef;
  const attemptSnap = isPracticeMode ? await attemptRef.get() : officialSnap;
  if (!attemptSnap.exists) {
    return NextResponse.json({ error: "No attempt found for this exam" }, { status: 404 });
  }
  const attempt = attemptSnap.data();

  const isWindowed = exam.startAt && exam.endAt;
  const windowClosed = !isWindowed || Date.now() >= exam.endAt.toMillis();
  const countsTowardMerit = !isPracticeMode && exam.type !== "practice";

  // A practice run on an exam you already officially completed: the full
  // breakdown lives permanently under the official result, so this one
  // is score-only, unconditionally — see the rule above.
  const practiceAfterOfficial = isPracticeMode && hasOfficialAttempt;

  if (practiceAfterOfficial || (isWindowed && countsTowardMerit && !windowClosed)) {
    return NextResponse.json({
      correctCount: attempt.correctCount,
      total: attempt.total,
      detailsLocked: true,
    });
  }

  // Full reveal — either the window has closed (official result, stays
  // this way forever), or this is a first-time missed-exam practice run.
  const questionsSnap = await adminDb
    .collection("exams").doc(examId)
    .collection("questions")
    .get();
  const questions = questionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  let merit = [];
  let stats = {};
  if (countsTowardMerit) {
    const analytics = await getOrPublishAnalytics(examId, questions);
    merit = analytics.merit;
    stats = analytics.stats;
  }

  return NextResponse.json({
    correctCount: attempt.correctCount,
    total: attempt.total,
    answers: attempt.answers,
    questions,
    merit,
    stats,
    detailsLocked: false,
  });
}
