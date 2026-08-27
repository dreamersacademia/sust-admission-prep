import { adminDb } from "@/lib/server/firebaseAdmin";

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
 * exactly the scenario this exists to not trust.
 */
export async function finalizeIfOverdue(examId, uid) {
  const attemptRef = adminDb.collection("attempts").doc(`${uid}_${examId}`);

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(attemptRef);
    if (!snap.exists) return null;

    const attempt = snap.data();
    if (attempt.status !== "in_progress") return attempt; // already submitted, or no deadline concept

    if (!attempt.deadline || Date.now() < attempt.deadline) return attempt; // still within time

    const questionsSnap = await tx.get(
      adminDb.collection("exams").doc(examId).collection("questions")
    );
    const questions = questionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const answers = attempt.answers || {};
    const correctCount = questions.filter((q) => answers[q.id] === q.correctIndex).length;

    const finalized = {
      ...attempt,
      status: "submitted",
      correctCount,
      total: questions.length,
      submittedAt: attempt.deadline, // true finish time, not whenever this happened to run
      autoFinalized: true,
    };
    tx.set(attemptRef, finalized, { merge: true });
    return finalized;
  });
}
