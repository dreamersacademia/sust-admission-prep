import { adminDb } from "@/lib/server/firebaseAdmin";

/**
 * Computes (once) and caches: the merit list AND per-question stats
 * (correct/wrong/skipped counts + what % of students picked each option)
 * — both come from the exact same attempts query, so they're computed
 * together instead of two separate passes over the same data. Cached as
 * `published: true` on leaderboards/{examId} so every read after the
 * first is a simple fetch, not a re-computation.
 *
 * Shared between the student-facing result route (which gets the
 * PII-safe version: name/score/college, no phone numbers — every student
 * who checks their own result also sees this same list) and the
 * admin-only analytics route (which additionally joins in phone numbers
 * for registered students — never exposed to the student-facing route).
 */
export async function getOrPublishAnalytics(examId, questions) {
  const boardRef = adminDb.collection("leaderboards").doc(examId);
  const boardSnap = await boardRef.get();
  if (boardSnap.exists && boardSnap.data().published) {
    const [entriesSnap, adminEntriesSnap] = await Promise.all([
      boardRef.collection("entries").orderBy("rank").get(),
      boardRef.collection("adminEntries").orderBy("rank").get(),
    ]);
    return {
      merit: entriesSnap.docs.map((d) => d.data()),
      stats: boardSnap.data().stats || {},
      meritWithUids: adminEntriesSnap.docs.map((d) => d.data()),
    };
  }

  const attemptsSnap = await adminDb
    .collection("attempts")
    .where("examId", "==", examId)
    .where("isPractice", "==", false)
    .where("status", "==", "submitted")
    .get();

  const attempts = attemptsSnap.docs.map((d) => d.data());

  const meritWithUids = attempts
    .slice()
    .sort((a, b) => b.correctCount - a.correctCount)
    .map((a, i) => ({
      rank: i + 1,
      name: a.isGuest ? a.guestName : a.studentName,
      score: a.correctCount,
      isGuest: !!a.isGuest,
      college: a.guestCollege || null,
      studentAuthUid: a.studentAuthUid || null, // present here, stripped from the public copy below
    }));
  // Public-safe copy — this is the ONLY version students ever see via
  // the result page's merit list. Never add studentAuthUid, mobile, or
  // any other PII to this one.
  const publicMerit = meritWithUids.map(({ studentAuthUid, ...rest }) => rest);

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
  publicMerit.forEach((entry) => {
    batch.set(boardRef.collection("entries").doc(String(entry.rank)), entry);
  });
  meritWithUids.forEach((entry) => {
    // Admin-only subcollection — never matched by a client-readable rule
    // in firestore.rules (same "unmatched path = denied" default as
    // everything else client-facing never touches). Admin SDK reads
    // bypass rules entirely, which is the only way this is ever read.
    batch.set(boardRef.collection("adminEntries").doc(String(entry.rank)), entry);
  });
  await batch.commit();

  return { merit: publicMerit, stats, meritWithUids };
}
