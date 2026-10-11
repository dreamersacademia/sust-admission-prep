import { adminDb } from "@/lib/server/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import { scoreAttempt } from "@/lib/server/scoring";

export async function finalizeIfOverdue(examId, uid) {
  const attemptRef = adminDb.collection("attempts").doc(`${uid}_${examId}`);

  try {
    return await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(attemptRef);
      if (!snap.exists) return null;

      const attempt = snap.data();
      if (attempt.status !== "in_progress") return attempt;
      if (!attempt.deadline || Date.now() < attempt.deadline) return attempt;

      const examSnap = await tx.get(adminDb.collection("exams").doc(examId));
      const exam = examSnap.exists ? examSnap.data() : {};
      const negativeMarking = exam.negativeMarking || 0;

      const questionsSnap = await tx.get(
        adminDb.collection("exams").doc(examId).collection("questions")
      );
      const allQuestions = questionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const questions = exam.hasSubjectChoice
        ? allQuestions.filter((q) => !q.choiceGroup || q.choiceGroup === attempt.subjectChoice)
        : allQuestions;

      const scored = scoreAttempt(questions, attempt.answers || {}, negativeMarking);

      let studentName = attempt.studentName;
      let studentCollege = attempt.studentCollege;
      if (!studentName) {
        const studentSnap = await tx.get(adminDb.collection("students").doc(uid));
        studentName = studentSnap.exists ? studentSnap.data().name : "Student";
        studentCollege = studentSnap.exists ? studentSnap.data().college || null : null;
      }

      const finalized = {
        ...attempt,
        studentName,
        studentCollege,
        status: "submitted",
        ...scored,
        // Same Timestamp fix as submit/route.js — was a raw number.
        submittedAt: Timestamp.fromMillis(attempt.deadline),
        autoFinalized: true,
      };
      tx.set(attemptRef, finalized, { merge: true });
      return finalized;
    });
  } catch (err) {
    // THE actual fix for "one student's data shouldn't block the whole
    // exam's results/merit": a malformed attempt (bad `answers` shape, a
    // question doc with something unexpected, etc.) used to throw out of
    // this transaction and propagate all the way up through
    // finalizeAllOverdueForExam → getOrPublishAnalytics — which meant
    // EVERY student's results/merit view for that exam failed, because
    // of one broken doc. Now: log it, flag that one attempt so it's
    // visible for you to go fix by hand later, and let everything else
    // proceed normally. Flagging it with a non-"in_progress" status also
    // stops it from being retried (and re-failing, and re-logging) on
    // every single future sweep.
    console.error(`finalizeIfOverdue failed for attempt ${uid}_${examId}:`, err);
    try {
      await attemptRef.set(
        { status: "needs_review", finalizeError: String(err?.message || err) },
        { merge: true }
      );
    } catch (writeErr) {
      console.error(`Could not flag attempt ${uid}_${examId} as needs_review:`, writeErr);
    }
    return null;
  }
}

export async function finalizeAllOverdueForExam(examId) {
  const snap = await adminDb
    .collection("attempts")
    .where("examId", "==", examId)
    .where("status", "==", "in_progress")
    .get();

  let finalizedCount = 0;
  for (const doc of snap.docs) {
    const attempt = doc.data();
    if (!attempt.studentAuthUid) continue;
    try {
      const result = await finalizeIfOverdue(examId, attempt.studentAuthUid);
      if (result?.status === "submitted") finalizedCount++;
    } catch (err) {
      // Belt-and-suspenders: finalizeIfOverdue already catches its own
      // errors internally, but if something still slips through (a
      // Firestore network blip hitting just this one call, say), don't
      // let it abort the sweep for every other student's attempt.
      console.error(`Unexpected error finalizing attempt ${doc.id}:`, err);
    }
  }
  return finalizedCount;
}