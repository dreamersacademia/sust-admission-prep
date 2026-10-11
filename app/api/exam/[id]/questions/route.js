import { NextResponse } from "next/server";
import { adminDb, verifyRequest } from "@/lib/server/firebaseAdmin";

/**
 * GET /api/exam/[id]/questions?subject=Physics&mode=practice&subjectChoice=A
 *
 * For an OFFICIAL (signed-in, non-practice) session on a hasSubjectChoice
 * exam, the choice is read from the LOCKED value on the attempt doc (set
 * at /api/exam/[id]/start) — never trusted from this request's query
 * param. Practice mode and guest (public-link) requests have no
 * persistent lock to read, so they keep using the query param — fine
 * there since neither has merit-list stakes riding on it.
 */
export async function GET(request, { params }) {
  const decoded = await verifyRequest(request);
  const isPracticeMode = new URL(request.url).searchParams.get("mode") === "practice";

  const examId = params.id;
  const examSnap = await adminDb.collection("exams").doc(examId).get();
  if (!examSnap.exists) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }
  const exam = examSnap.data();

  if (!decoded && !exam.isPublic) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const isWindowed = exam.startAt && exam.endAt;
  if (isWindowed && !isPracticeMode) {
    const start = exam.startAt.toMillis();
    if (now < start) {
      return NextResponse.json({ error: "Exam has not started yet" }, { status: 403 });
    }
  }

  let subjectChoice = new URL(request.url).searchParams.get("subjectChoice");

  const isOfficialSession = isWindowed && decoded && !isPracticeMode;
  if (isOfficialSession) {
    const attemptId = `${decoded.uid}_${examId}`;
    const attemptSnap = await adminDb.collection("attempts").doc(attemptId).get();

    if (attemptSnap.exists) {
      const attemptData = attemptSnap.data();
      if (attemptData.status === "submitted") {
        return NextResponse.json({ error: "Already submitted" }, { status: 409 });
      }
      // Locked value wins, not the query param.
      if (exam.hasSubjectChoice) subjectChoice = attemptData.subjectChoice || null;
    } else if (exam.hasSubjectChoice) {
      // FIX: previously this fell through with subjectChoice = null and
      // still returned questions — for a Daily exam where EVERY question
      // has a choiceGroup (no shared/common ones), that filter leaves
      // ZERO questions, not a helpful error. The frontend's own flow
      // always calls /start first and waits for a locked choice before
      // ever calling this route, so reaching here means something's out
      // of order — fail loudly instead of silently handing back an empty
      // or wrong-sized paper.
      return NextResponse.json({ error: "SUBJECT_CHOICE_REQUIRED" }, { status: 409 });
    }
  }

  const questionsSnap = await adminDb
    .collection("exams").doc(examId)
    .collection("questions")
    .get();

  const sanitized = questionsSnap.docs
    .map((doc) => {
      const { correctIndex, explanation, videoUrl, ...safe } = doc.data();
      return { id: doc.id, ...safe };
    })
    .filter((q) => !exam.hasSubjectChoice || !q.choiceGroup || q.choiceGroup === subjectChoice)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return NextResponse.json({ questions: sanitized, subjectChoice });
}