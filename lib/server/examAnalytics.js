import { adminDb } from "@/lib/server/firebaseAdmin";
import { finalizeAllOverdueForExam } from "@/lib/server/examFinalize";

/**
 * Computes the merit list AND per-question stats (correct/wrong/skipped
 * counts, per-option answer percentages) from the attempts collection.
 *
 * Two safety measures, both required — either one alone isn't enough:
 *
 *  1. finalizeAllOverdueForExam() sweeps every student's attempt for
 *     this exam and force-finalizes any still stuck at "in_progress"
 *     past their deadline (e.g. they closed the app right after
 *     finishing and never reopened it, so nothing ever told the server
 *     their attempt was done).
 *
 *  2. This function ALWAYS recomputes from a fresh attempts query —
 *     it no longer trusts a previously-cached "published" merit list at
 *     all. A cache built the moment the exam ended could miss a
 *     legitimately late-arriving submission (network lag right at the
 *     deadline) that lands in Firestore a few seconds after the first
 *     person happened to check results — and with a cache-trust model,
 *     NOTHING would ever trigger a recompute to pick that student up,
 *     even though their submission was completely valid. A missing name
 *     in the merit list is a trust-breaking bug for a competitive exam
 *     platform, so this always pays the cost of a fresh query rather
 *     than risk it — attempt counts per exam here are small enough
 *     (tens to a few hundred) that this is cheap in practice.
 *
 * The `leaderboards/{examId}` doc + `entries` subcollection are still
 * written every time — that's what makes the PUBLIC (no-auth) guest
 * leaderboard link work per firestore.rules ("published == true") — it's
 * just no longer read-and-trust-forever; every call rebuilds it.
 */
export async function getOrPublishAnalytics(examId, questions) {
  const boardRef = adminDb.collection("leaderboards").doc(examId);

  await finalizeAllOverdueForExam(examId);

  const attemptsSnap = await adminDb
    .collection("attempts")
    .where("examId", "==", examId)
    .where("isPractice", "==", false)
    .where("status", "==", "submitted")
    .get();

  const attempts = attemptsSnap.docs.map((d) => d.data());

  const merit = attempts
    .slice()
    .sort((a, b) => (b.netScore ?? b.correctCount) - (a.netScore ?? a.correctCount))
    .map((a, i) => ({
      rank: i + 1,
      name: a.isGuest ? a.guestName : a.studentName,
      college: a.isGuest ? a.guestCollege || null : a.studentCollege || null,
      score: a.netScore ?? a.correctCount,
      correctCount: a.correctCount,
      wrongCount: a.wrongCount ?? null,
      isGuest: !!a.isGuest,
    }));

  const totalAttempts = attempts.length;
  const stats = {};
  for (const q of questions) {
    const optionCounts = new Array(q.options.length).fill(0);
    let correctCount = 0;
    let skippedCount = 0;
    for (const a of attempts) {
      const picked = a.answers?.[q.id];
      if (picked === undefined || picked === null) {
        skippedCount++;
        continue;
      }
      optionCounts[picked] = (optionCounts[picked] || 0) + 1;
      if (picked === q.correctIndex) correctCount++;
    }
    stats[q.id] = {
      totalAttempts,
      correctCount,
      wrongCount: totalAttempts - correctCount - skippedCount,
      skippedCount,
      optionPercentages: optionCounts.map((c) =>
        totalAttempts ? Math.round((c / totalAttempts) * 100) : 0
      ),
    };
  }

  const batch = adminDb.batch();
  batch.set(boardRef, { published: true, examId, computedAt: new Date(), stats });

  // Clear whatever was there before writing fresh entries — avoids
  // leftover "ghost" ranks if the merit list ever shrinks between calls
  // (e.g. an attempt gets excluded for some reason it wasn't before).
  const existingEntriesSnap = await boardRef.collection("entries").get();
  existingEntriesSnap.docs.forEach((doc) => batch.delete(doc.ref));
  merit.forEach((entry) => {
    batch.set(boardRef.collection("entries").doc(String(entry.rank)), entry);
  });
  await batch.commit();

  return { merit, stats };
}