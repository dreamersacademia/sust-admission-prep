import { adminDb } from "@/lib/server/firebaseAdmin";
import { scoreAttempt } from "@/lib/server/scoring";

/**
 * The other half of strict duration enforcement (see
 * app/api/exam/[id]/start/route.js for the immutable-deadline half).
 *
 * A deadline being "immutable" only matters if something actually acts
 * on it. Without this, an attempt could sit at `status: "in_progress"`
 * forever if the student's device died, lost connection, or the tab
 * silently failed to fire its own auto-submit at zero — and BECAUSE
 * nothing ever marked it "submitted," the exam would keep showing as
 * still-live/re-enterable. This is called from every read path that
 * touches an attempt (list exams, single exam, result) so the very next
 * thing that looks at an overdue attempt finalizes it — no cron job
 * needed, and no way to keep it dangling in "in_progress" by just never
 * coming back.
 *
 * Grades using ONLY `attempt.answers` as they stood at the last
 * successful autosave — never anything a late client request might still
 * be trying to send, since a submit call arriving after the deadline is
 * exactly the scenario this exists to not trust. Negative marking is
 * pulled from the exam doc, same as the submit route, via the shared
 * scoreAttempt() helper.
 */
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

    // Same subjectChoice filter as the submit route — a straggler who
    // never manually submitted still gets graded against exactly what
    // they were shown, not the full combined exam.
    const questions = exam.hasSubjectChoice
      ? allQuestions.filter((q) => !q.choiceGroup || q.choiceGroup === attempt.subjectChoice)
      : allQuestions;

    const scored = scoreAttempt(questions, attempt.answers || {}, negativeMarking);

    const finalized = {
      ...attempt,
      status: "submitted",
      ...scored,
      submittedAt: attempt.deadline,
      autoFinalized: true,
    };
    tx.set(attemptRef, finalized, { merge: true });
    return finalized;
  });
}
/**
 * Sweeps EVERY still-in_progress attempt for one exam and finalizes
 * whichever ones are actually overdue — not just whoever happens to be
 * asking. This is what closes the real gap: finalizeIfOverdue alone only
 * fires when the SAME student who took the exam comes back and looks at
 * their own dashboard/result again. A student who closed the app right
 * after finishing and never reopened it would sit at "in_progress"
 * forever, invisible to admin, no matter how many times someone else
 * checked results — because nobody's request ever touched THEIR attempt
 * doc specifically. This function is what actually does.
 *
 * Called from getOrPublishAnalytics before it trusts (or builds) the
 * cached merit list — see lib/server/examAnalytics.js.
 */
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