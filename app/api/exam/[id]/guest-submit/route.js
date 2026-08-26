import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { randomUUID } from "crypto";

/**
 * POST /api/exam/[id]/guest-submit
 * Body: { guestName, guestCollege, answers, guestSessionId? }
 *
 * Guests never sign in (that's the point of the public link — see the
 * original spec), so this can't be gated by a Firebase ID token the way
 * the registered-student submit route is. Instead:
 *   - `exam.isPublic` must be true, checked server-side, not just hidden
 *     in the UI.
 *   - Each request gets a fresh `attempts` doc — grading is still 100%
 *     server-side, same as registered students, so a guest can't submit
 *     a hand-edited score either.
 *
 * Known open gap, flagged honestly rather than silently ignored: without
 * an account, "one attempt per guest" can only be approximately enforced
 * (e.g. a signed httpOnly cookie remembering `examId` + a random
 * `guestSessionId`, checked here before allowing a second submission from
 * the same browser). That's NOT implemented yet — right now a guest could
 * refresh and resubmit. Fixing this properly needs either lightweight
 * device fingerprinting or requiring a phone number even for guests
 * (defeats some of the "no friction" goal) — worth a product decision
 * before launch, not just an engineering one.
 */
export async function POST(request, { params }) {
  const examId = params.id;
  const { guestName, guestCollege, answers = {} } = await request.json();

  if (!guestName?.trim() || !guestCollege?.trim()) {
    return NextResponse.json({ error: "Name and college are required" }, { status: 400 });
  }

  const examSnap = await adminDb.collection("exams").doc(examId).get();
  if (!examSnap.exists || !examSnap.data().isPublic) {
    return NextResponse.json({ error: "This exam is not open to guests" }, { status: 403 });
  }

  const questionsSnap = await adminDb
    .collection("exams").doc(examId)
    .collection("questions")
    .get();
  const questions = questionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const correctCount = questions.filter((q) => answers[q.id] === q.correctIndex).length;
  const total = questions.length;

  const attemptId = `guest_${randomUUID()}`;
  await adminDb.collection("attempts").doc(attemptId).set({
    examId,
    isGuest: true,
    isPractice: false,
    status: "submitted",
    guestName: guestName.trim(),
    guestCollege: guestCollege.trim(),
    answers,
    correctCount,
    total,
    submittedAt: new Date(),
  });

  return NextResponse.json({ correctCount, total });
}
