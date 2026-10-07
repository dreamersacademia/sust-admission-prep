import { NextResponse } from "next/server";
import { adminDb, verifyRequest } from "@/lib/server/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { scoreAttempt } from "@/lib/server/scoring";

/**
 * POST /api/exam/[id]/submit
 * Body: { answers, isPractice?, subjectChoice? }
 *
 * THE actual bug: grading used to pull EVERY question in the exam doc
 * regardless of elective — a weekly exam with 60 common + 20 Biology +
 * 20 English graded every student out of 100, not 80, even though they
 * only ever saw 80. This silently corrupted the merit list's
 * denominator for every single student on a choice exam.
 *
 * Official sessions: filtered by the LOCKED subjectChoice on the
 * attempt doc (set at /start) — never trusts subjectChoice sent here.
 * Practice sessions: no persistent lock exists (unlimited retakes by
 * design), so this trusts subjectChoice from the request body — fine
 * since practice has no merit-list stakes.
 */
export async function POST(request, { params }) {
  const decoded = await verifyRequest(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const examId = params.id;
  const { answers: clientAnswers = {}, isPractice = false, subjectChoice: practiceChoiceFromClient } = await request.json();

  const studentSnap = await adminDb.collection("students").doc(decoded.uid).get();
  const studentName = studentSnap.exists ? studentSnap.data().name : "Student";
  const studentCollege = studentSnap.exists ? studentSnap.data().college || null : null;

  const examSnap = await adminDb.collection("exams").doc(examId).get();
  const exam = examSnap.exists ? examSnap.data() : {};
  const negativeMarking = exam.negativeMarking || 0;

  const questionsSnap = await adminDb
    .collection("exams").doc(examId)
    .collection("questions")
    .get();
  const allQuestions = questionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Same filter the questions-fetch route applies — grade against
  // exactly what the student was actually shown, nothing more.
  function filterForChoice(choice) {
    if (!exam.hasSubjectChoice) return allQuestions;
    return allQuestions.filter((q) => !q.choiceGroup || q.choiceGroup === choice);
  }

  if (isPractice) {
    const questions = filterForChoice(practiceChoiceFromClient);
    const scored = scoreAttempt(questions, clientAnswers, negativeMarking);
    const practiceId = `${decoded.uid}_${examId}_practice`;
    await adminDb.collection("attempts").doc(practiceId).set({
      studentAuthUid: decoded.uid,
      examId,
      isPractice: true,
      subjectChoice: exam.hasSubjectChoice ? practiceChoiceFromClient || null : null,
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
      const finalAnswers = pastDeadline ? existing.answers || {} : clientAnswers;

      // THE fix: grade only against the LOCKED choice's question set.
      const lockedChoice = existing?.subjectChoice ?? null;
      const questions = filterForChoice(lockedChoice);
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

  return NextResponse.json({
    correctCount: result.correctCount,
    wrongCount: result.wrongCount,
    skippedCount: result.skippedCount,
    total: result.total,
    netScore: result.netScore,
  });
}