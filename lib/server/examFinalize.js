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
    const negativeMarking = examSnap.exists ? examSnap.data().negativeMarking || 0 : 0;

    const questionsSnap = await tx.get(
      adminDb.collection("exams").doc(examId).collection("questions")
    );
    const questions = questionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const scored = scoreAttempt(questions, attempt.answers || {}, negativeMarking);

    // BUG FIX: the attempt doc created by /api/exam/[id]/start never had
    // studentName/studentCollege — only the manual submit route set
    // those. A student who never manually submitted (closed the tab,
    // lost connection) got auto-finalized here with no name at all,
    // which Firestore rejects as "undefined" the moment anything tries
    // to write it into a merit list. Backfill from the student doc if
    // it's missing, same as the submit route already does.
    let studentName = attempt.studentName;
    let studentCollege = attempt.studentCollege;
    if (!studentName) {
      const studentSnap = await tx.get(adminDb.collection("students").doc(uid));
      studentName = studentSnap.exists ? studentSnap.data().name || "Student" : "Student";
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