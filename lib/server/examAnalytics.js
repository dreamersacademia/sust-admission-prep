import { adminDb } from "@/lib/server/firebaseAdmin";
import { finalizeAllOverdueForExam } from "@/lib/server/examFinalize";

export async function getOrPublishAnalytics(examId, questions) {
  const boardRef = adminDb.collection("leaderboards").doc(examId);

  try {
    await finalizeAllOverdueForExam(examId);
  } catch (err) {
    // finalizeAllOverdueForExam already isolates per-attempt failures
    // internally now, but this is the last line of defense — a total
    // failure here (e.g. the attempts query itself erroring) still
    // shouldn't stop you from seeing whatever results CAN be computed.
    console.error(`finalizeAllOverdueForExam failed for exam ${examId}:`, err);
  }

  const attemptsSnap = await adminDb
    .collection("attempts")
    .where("examId", "==", examId)
    .where("isPractice", "==", false)
    .where("status", "==", "submitted")
    .get();

  const attempts = attemptsSnap.docs.map((d) => d.data());

  let merit = [];
  try {
    merit = attempts
      .slice()
      .sort((a, b) => (b.netScore ?? b.correctCount ?? 0) - (a.netScore ?? a.correctCount ?? 0))
      .map((a, i) => ({
        rank: i + 1,
        name: a.isGuest ? (a.guestName || "Guest") : (a.studentName || "Unknown"),
        college: a.isGuest ? a.guestCollege || null : a.studentCollege || null,
        score: a.netScore ?? a.correctCount ?? 0,
        correctCount: a.correctCount ?? 0,
        wrongCount: a.wrongCount ?? null,
        isGuest: !!a.isGuest,
      }));
  } catch (err) {
    console.error(`Merit list computation failed for exam ${examId}:`, err);
    merit = [];
  }

  const stats = {};
  for (const q of questions) {
    try {
      // A choice-specific question was only ever SHOWN to students who
      // picked that elective — counting everyone else as "skipped" would
      // be meaningless noise, not a real skip.
      const relevantAttempts = q.choiceGroup
        ? attempts.filter((a) => a.subjectChoice === q.choiceGroup)
        : attempts;
      const totalRelevant = relevantAttempts.length;

      const optionCounts = new Array(q.options?.length || 0).fill(0);
      let correctCount = 0;
      let skippedCount = 0;
      for (const a of relevantAttempts) {
        const picked = a.answers?.[q.id];
        if (picked === undefined || picked === null) {
          skippedCount++;
          continue;
        }
        if (optionCounts[picked] !== undefined) optionCounts[picked] += 1;
        if (picked === q.correctIndex) correctCount++;
      }
      stats[q.id] = {
        totalAttempts: totalRelevant,
        correctCount,
        wrongCount: totalRelevant - correctCount - skippedCount,
        skippedCount,
        optionPercentages: optionCounts.map((c) =>
          totalRelevant ? Math.round((c / totalRelevant) * 100) : 0
        ),
      };
    } catch (err) {
      // THE fix: one malformed question (missing `options`, a weird
      // choiceGroup, whatever) used to throw and take down the ENTIRE
      // result/merit response — every other question's stats AND the
      // merit list itself never got returned, for any student. Now it's
      // just an empty stats row for that one question.
      console.error(`Stats computation failed for question ${q.id} on exam ${examId}:`, err);
      stats[q.id] = { totalAttempts: 0, correctCount: 0, wrongCount: 0, skippedCount: 0, optionPercentages: [] };
    }
  }

  const batch = adminDb.batch();
  batch.set(boardRef, { published: true, examId, computedAt: new Date(), stats });

  const existingEntriesSnap = await boardRef.collection("entries").get();
  existingEntriesSnap.docs.forEach((doc) => batch.delete(doc.ref));
  merit.forEach((entry) => {
    batch.set(boardRef.collection("entries").doc(String(entry.rank)), sanitizeForFirestore(entry));
  });
  await batch.commit();

  return { merit, stats };
}
// Firestore rejects `undefined` field values outright — never `null`,
// always `undefined`. A single bad field anywhere in `entry` (a missing
// studentName on an old/broken attempt doc, a guest submission with no
// guestName, anything) used to crash this whole write and, with it,
// publishing results for every other student on the exam. This is the
// last line of defense: no entry written here can ever contain
// `undefined`, whatever upstream data produced it.
function sanitizeForFirestore(obj) {
  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    clean[k] = v === undefined ? null : v;
  }
  return clean;
}