import { NextResponse } from "next/server";
import { adminDb, verifyRequest } from "@/lib/server/firebaseAdmin";

/**
 * GET /api/exam/[id]/result?mode=practice
 *
 * Mirrors the two-stage reveal built into the Phase 1 frontend
 * (app/result/[id]/page.jsx's `detailsLocked`), except this is the real
 * enforcement — a student calling this endpoint directly while a live
 * exam's window is still open gets the immediate score only, same as
 * the UI already shows, but now it's not just hidden by CSS.
 */
export async function GET(request, { params }) {
  const decoded = await verifyRequest(request);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const examId = params.id;
  const isPracticeMode = new URL(request.url).searchParams.get("mode") === "practice";

  const examSnap = await adminDb.collection("exams").doc(examId).get();
  if (!examSnap.exists) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  const exam = examSnap.data();

  const attemptId = isPracticeMode
    ? `${decoded.uid}_${examId}_practice`
    : `${decoded.uid}_${examId}`;
  const attemptSnap = await adminDb.collection("attempts").doc(attemptId).get();
  if (!attemptSnap.exists) {
    return NextResponse.json({ error: "No attempt found for this exam" }, { status: 404 });
  }
  const attempt = attemptSnap.data();

  const isWindowed = exam.startAt && exam.endAt;
  const countsTowardMerit = !isPracticeMode && exam.type !== "practice";
  const windowClosed = !isWindowed || Date.now() >= exam.endAt.toMillis();

  // Stage 1: window still open — immediate score only, exactly like the
  // frontend shows, but enforced here so there's no way to fetch the
  // answer key early by hitting this endpoint directly.
  if (isWindowed && countsTowardMerit && !windowClosed) {
    return NextResponse.json({
      correctCount: attempt.correctCount,
      total: attempt.total,
      detailsLocked: true,
    });
  }

  // Stage 2: full reveal.
  const questionsSnap = await adminDb
    .collection("exams").doc(examId)
    .collection("questions")
    .get();
  const questions = questionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  let merit = [];
  if (countsTowardMerit) {
    merit = await getOrPublishLeaderboard(examId);
  }

  return NextResponse.json({
    correctCount: attempt.correctCount,
    total: attempt.total,
    answers: attempt.answers,
    questions,
    merit,
    detailsLocked: false,
  });
}

/**
 * Reads the published leaderboard if it exists; otherwise computes it
 * once (first student to check results after the window closes triggers
 * this) and caches it as `published: true` so every subsequent read is a
 * simple fetch, not a re-computation.
 */
async function getOrPublishLeaderboard(examId) {
  const boardRef = adminDb.collection("leaderboards").doc(examId);
  const boardSnap = await boardRef.get();
  if (boardSnap.exists && boardSnap.data().published) {
    const entriesSnap = await boardRef.collection("entries").orderBy("rank").get();
    return entriesSnap.docs.map((d) => d.data());
  }

  const attemptsSnap = await adminDb
    .collection("attempts")
    .where("examId", "==", examId)
    .where("isPractice", "==", false)
    .where("status", "==", "submitted")
    .get();

  const ranked = attemptsSnap.docs
    .map((d) => d.data())
    .sort((a, b) => b.correctCount - a.correctCount)
    .map((a, i) => ({
      rank: i + 1,
      name: a.isGuest ? a.guestName : a.studentName,
      score: a.correctCount,
      isGuest: !!a.isGuest,
      college: a.guestCollege || null,
    }));

  const batch = adminDb.batch();
  batch.set(boardRef, { published: true, examId, computedAt: new Date() });
  ranked.forEach((entry) => {
    batch.set(boardRef.collection("entries").doc(String(entry.rank)), entry);
  });
  await batch.commit();

  return ranked;
}
