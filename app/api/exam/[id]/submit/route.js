import { NextResponse } from "next/server";
import { adminDb, verifyRequest } from "@/lib/server/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { scoreAttempt } from "@/lib/server/scoring";

/**
 * POST /api/exam/[id]/submit
 * Body: { answers: { [questionId]: optionIndex }, isPractice?: boolean }
 *
 * This is where the "one submission, no bypass, no re-edit" requirement
 * actually lives — everything in the Phase 1 frontend around this is UX,
 * not enforcement. The transaction below is the enforcement:
 *   1. Read the attempt doc.
 *   2. If it's already `status: "submitted"`, reject — no exceptions,
 *      no matter what the client sends.
 *   3. If the attempt has a deadline (windowed exam) and it's already
 *      passed, the client's `answers` payload is IGNORED — grading uses
 *      only what was already synced via /autosave before the deadline.
 *      A late submit call can't sneak in extra answers just because the
 *      student's local timer glitched or they kept tapping after their
 *      own countdown hit zero.
 *   4. Otherwise grade against the REAL questions collection (which the
 *      client has never seen) and write `status: "submitted"` in the same
 *      transaction, so a duplicate request racing in at the same moment
 *      can't slip through between the check and the write.
 *
 * Negative marking: read from the exam's `negativeMarking` field (marks
 * deducted per wrong answer, 0 if unset) and applied via the shared
 * scoreAttempt() helper — see lib/server/scoring.js.
 */
export async function POST(request, { params }) {
  const decoded = await verifyRequest(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const examId = params.id;
  const { answers: clientAnswers = {}, isPractice = false } = await request.json();

  // Pull the student's display name + college for the leaderboard — the
  // custom token itself only carries the uid + role, not profile info.
  // College rides along here (not phone — that's deliberately never
  // stored on an attempt, since attempts feed the merit list/PDF and
  // phone numbers don't belong there per spec).
  const studentSnap = await adminDb.collection("students").doc(decoded.uid).get();
  const studentName = studentSnap.exists ? studentSnap.data().name : "Student";
  const studentCollege = studentSnap.exists ? studentSnap.data().college || null : null;

  const examSnap = await adminDb.collection("exams").doc(examId).get();
  const negativeMarking = examSnap.exists ? examSnap.data().negativeMarking || 0 : 0;

  const questionsSnap = await adminDb
    .collection("exams").doc(examId)
    .collection("questions")
    .get();
  const questions = questionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Practice attempts are intentionally NOT locked and have no deadline —
  // write-through, no transaction needed, unlimited retakes by design.
  if (isPractice) {
    const scored = scoreAttempt(questions, clientAnswers, negativeMarking);
    const practiceId = `${decoded.uid}_${examId}_practice`;
    await adminDb.collection("attempts").doc(practiceId).set({
      studentAuthUid: decoded.uid,
      examId,
      isPractice: true,
      answers: clientAnswers,
      ...scored,
      submittedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json(scored);
  }

  const attemptId = `${decoded.uid}_${examId}`;
  const attemptRef = adminDb.collection("attempts").doc(attemptId);

  let result;
  try {
    result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(attemptRef);
      const existing = snap.exists ? snap.data() : null;

      if (existing?.status === "submitted") {
        throw new Error("ALREADY_SUBMITTED");
      }

      const pastDeadline = existing?.deadline && Date.now() > existing.deadline;
      // Past the deadline: trust ONLY the server's own autosaved answers.
      // Within the deadline (or no deadline recorded, e.g. this route
      // being hit without /start — a fallback, not the normal path):
      // trust the client's final payload.
      const finalAnswers = pastDeadline ? existing.answers || {} : clientAnswers;
      const scored = scoreAttempt(questions, finalAnswers, negativeMarking);

      const finalized = {
        studentAuthUid: decoded.uid,
        studentName,
        studentCollege,
        examId,
        isPractice: false,
        status: "submitted",
        answers: finalAnswers,
        ...scored,
        submittedAt: pastDeadline ? existing.deadline : Date.now(),
      };
      tx.set(attemptRef, finalized, { merge: true });
      return finalized;
    });
  } catch (err) {
    if (err.message === "ALREADY_SUBMITTED") {
      return NextResponse.json({ error: "Already submitted" }, { status: 409 });
    }
    throw err;
  }

  // Immediate score only — explanations/video/merit come from
  // /api/exam/[id]/result once the window closes for everyone.
  return NextResponse.json({
    correctCount: result.correctCount,
    wrongCount: result.wrongCount,
    skippedCount: result.skippedCount,
    total: result.total,
    netScore: result.netScore,
  });
}