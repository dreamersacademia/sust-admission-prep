import { NextResponse } from "next/server";
import { adminDb, verifyRequest } from "@/lib/server/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { scoreAttempt } from "@/lib/server/scoring";

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

  function filterForChoice(choice) {
    if (!exam.hasSubjectChoice) return allQuestions;
    return allQuestions.filter((q) => !q.choiceGroup || q.choiceGroup === choice);
  }

  if (isPractice) {
    const practiceChoice = practiceChoiceFromClient === "A" || practiceChoiceFromClient === "B" ? practiceChoiceFromClient : null;
    if (exam.hasSubjectChoice && !practiceChoice) {
      return NextResponse.json({ error: "SUBJECT_CHOICE_REQUIRED" }, { status: 400 });
    }

    const questions = filterForChoice(practiceChoice);
    const scored = scoreAttempt(questions, clientAnswers, negativeMarking);
    const practiceId = `${decoded.uid}_${examId}_practice`;
    await adminDb.collection("attempts").doc(practiceId).set({
      studentAuthUid: decoded.uid,
      examId,
      isPractice: true,
      subjectChoice: practiceChoice,
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

      const lockedChoice = existing?.subjectChoice ?? null;
      const questions = filterForChoice(lockedChoice);
      const scored = scoreAttempt(questions, finalAnswers, negativeMarking);

      const submittedAtMs = pastDeadline ? existing.deadline : Date.now();

      const finalized = {
        studentAuthUid: decoded.uid,
        studentName,
        studentCollege,
        examId,
        isPractice: false,
        status: "submitted",
        answers: finalAnswers,
        ...scored,
        // FIX: was a raw epoch-ms number (Date.now()) — Firestore console
        // just shows that as a plain Number, not a date. Wrapping it in
        // Timestamp.fromMillis() makes it display properly, same as the
        // practice branch's serverTimestamp() already does. Nothing
        // reads submittedAt for arithmetic anywhere, so this is purely
        // cosmetic/organizational — zero functional risk.
        submittedAt: Timestamp.fromMillis(submittedAtMs),
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