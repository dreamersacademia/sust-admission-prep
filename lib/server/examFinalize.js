import { adminDb } from "@/lib/server/firebaseAdmin";
import { scoreAttempt } from "@/lib/server/scoring";

export async function finalizeIfOverdue(examId, uid) {
  const attemptRef = adminDb.collection("attempts").doc(`${uid}_${examId}`);

  return adminDb.runTransaction(async (tx) => {
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

    // FIX: the attempt doc created at /start never had studentName or
    // studentCollege — those were only ever stamped on by a MANUAL
    // submit (submit/route.js). A student who never comes back to
    // manually submit — closes the app right after finishing, device
    // dies, etc. — used to get correctly flipped to "submitted" here but
    // with an undefined name, so they'd show up in the merit list as a
    // blank/missing entry. Same root problem as the earlier missing-
    // merit-entries bug, just reopened through this path instead.
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
      submittedAt: attempt.deadline,
      autoFinalized: true,
    };
    tx.set(attemptRef, finalized, { merge: true });
    return finalized;
  });
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
    const result = await finalizeIfOverdue(examId, attempt.studentAuthUid);
    if (result?.status === "submitted") finalizedCount++;
  }
  return finalizedCount;
}