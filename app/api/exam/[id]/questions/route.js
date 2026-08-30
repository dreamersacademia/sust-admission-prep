import { NextResponse } from "next/server";
import { adminDb, verifyRequest } from "@/lib/server/firebaseAdmin";

/**
 * GET /api/exam/[id]/questions
 *
 * Returns the question set for an exam with the answer key stripped out —
 * this is the ONLY way question data ever reaches the browser during a
 * live exam. `exams/{id}/questions` itself is unreadable by any client per
 * firestore.rules; this route uses the Admin SDK, which bypasses those
 * rules on purpose, and hands back only what a student should see.
 */
export async function GET(request, { params }) {
  const decoded = await verifyRequest(request); // may be null for a guest — checked below
  const isPracticeMode = new URL(request.url).searchParams.get("mode") === "practice";

  const examId = params.id;
  const examSnap = await adminDb.collection("exams").doc(examId).get();
  if (!examSnap.exists) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }
  const exam = examSnap.data();

  // A guest (no token) may only ever fetch questions for a genuinely
  // public exam — the public-exam page's own "isPublic" check in the UI
  // is not what actually stops a private exam's questions from leaking to
  // an unauthenticated request; this check is.
  if (!decoded && !exam.isPublic) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

// Live-window gate lives server-side too, not just in the UI — a direct
  // API hit before startAt or after endAt (without an in-progress attempt)
  // gets refused here regardless of what the client shows. Skipped
  // entirely in practice mode — a practice retake of an exam whose
  // window already ended is exactly the normal case, not an error.
  const now = Date.now();
  const isWindowed = exam.startAt && exam.endAt;
  if (isWindowed && !isPracticeMode) {
    const start = exam.startAt.toMillis();
    if (now < start) {
      return NextResponse.json({ error: "Exam has not started yet" }, { status: 403 });
    }
  }

  // One-time-attempt gate: only for an OFFICIAL attempt. This was the
  // actual bug — it used to fire regardless of mode, so retaking an
  // already-completed exam via "পুনরায় প্র্যাকটিস করো" (mode=practice)
  // hit the exact same "Already submitted" rejection meant for someone
  // trying to re-enter their official, locked attempt. Practice mode is
  // unlimited by design and must never be blocked by this check.
  if (isWindowed && decoded && !isPracticeMode) {
    const attemptId = `${decoded.uid}_${examId}`;
    const attemptSnap = await adminDb.collection("attempts").doc(attemptId).get();
    if (attemptSnap.exists && attemptSnap.data().status === "submitted") {
      return NextResponse.json({ error: "Already submitted" }, { status: 409 });
    }
  }

  const questionsSnap = await adminDb
    .collection("exams").doc(examId)
    .collection("questions")
    .get();

  const sanitized = questionsSnap.docs.map((doc) => {
    const { correctIndex, explanation, videoUrl, ...safe } = doc.data();
    return { id: doc.id, ...safe };
  });

  return NextResponse.json({ questions: sanitized });
}
