import { adminDb } from "@/lib/server/firebaseAdmin";

/**
 * Computes (once) and caches: the merit list AND per-question stats
 * (correct/wrong/skipped counts + what % of students picked each option)
 * — both come from the exact same attempts query, so they're computed
 * together instead of two separate passes over the same data. Cached as
 * `published: true` on leaderboards/{examId} so every read after the
 * first is a simple fetch, not a re-computation.
 *
 * `college` is included for BOTH registered students and guests — unlike
 * a phone number, a college name isn't sensitive, and the spec wants it
 * shown for everyone on the merit list and the admin's exported PDF. No
 * phone number is ever part of this — it's never stored on an attempt in
 * the first place (see app/api/exam/[id]/submit/route.js), so there's
 * nothing here that could leak one even by mistake.
 *
 * Shared as-is between the student-facing result route (every student
 * who checks their own result sees this exact list) and the admin
 * analytics/PDF route — the same data serves both, no separate
 * PII-joined copy needed the way an earlier version of this had for
 * phone numbers.
 */
export async function getOrPublishAnalytics(examId, questions) {
  const boardRef = adminDb.collection("leaderboards").doc(examId);
  const boardSnap = await boardRef.get();
  if (boardSnap.exists && boardSnap.data().published) {
    const entriesSnap = await boardRef.collection("entries").orderBy("rank").get();
    return {
      merit: entriesSnap.docs.map((d) => d.data()),
      stats: boardSnap.data().stats || {},
    };
  }

  const attemptsSnap = await adminDb
    .collection("attempts")
    .where("examId", "==", examId)
    .where("isPractice", "==", false)
    .where("status", "==", "submitted")
    .get();

  const attempts = attemptsSnap.docs.map((d) => d.data());

  // Ranked by netScore (accounts for negative marking) rather than raw
  // correctCount — a student with fewer correct-but-more-wrong answers
  // should rank below one with fewer total answers but no penalties,
  // exactly the point of negative marking existing at all.
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
  merit.forEach((entry) => {
    batch.set(boardRef.collection("entries").doc(String(entry.rank)), entry);
  });
  await batch.commit();

  return { merit, stats };
}