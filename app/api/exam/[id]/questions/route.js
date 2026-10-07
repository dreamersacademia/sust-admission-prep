import { NextResponse } from "next/server";
import { adminDb, verifyRequest } from "@/lib/server/firebaseAdmin";

/**
 * GET /api/exam/[id]/questions?subject=Physics&mode=practice&subjectChoice=A
 *
 * For an OFFICIAL (signed-in, non-practice) session on a hasSubjectChoice
 * exam, the choice is now read from the LOCKED value on the attempt doc
 * (set at /api/exam/[id]/start) — never trusted from this request's
 * query param anymore. Practice mode and guest (public-link) requests
 * have no persistent lock to read, so they keep using the query param —
 * fine there since neither has merit-list stakes riding on it.
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
      // THE fix: locked value wins, not the query param.
      if (exam.hasSubjectChoice) subjectChoice = attemptData.subjectChoice || null;
    } else if (exam.hasSubjectChoice) {
      // Nothing locked yet — the frontend must call /start (with the
      // student's picked choice) before ever calling this route for a
      // choice exam. Returning nothing rather than guessing.
      subjectChoice = null;
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