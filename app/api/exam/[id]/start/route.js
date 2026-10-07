import { NextResponse } from "next/server";
import { adminDb, verifyRequest } from "@/lib/server/firebaseAdmin";

/**
 * POST /api/exam/[id]/start
 * Body: { subjectChoice? } — "A" or "B", only meaningful when the exam
 * has hasSubjectChoice: true.
 *
 * Locks TWO things on first open, in the same transaction: the deadline
 * (already existed) and — new — the student's subject choice. Without
 * this, "which elective's questions this student sees" lived only in
 * client state: a reload could flip it mid-exam, and grading had no
 * reliable source of truth for which set to grade against at all — it
 * was grading against Biology AND English combined, regardless of which
 * one the student actually took.
 *
 * On resume (attempt already exists, still in_progress), the ORIGINAL
 * locked choice is returned — whatever this call sends is ignored,
 * exactly like the deadline already works.
 */
export async function POST(request, { params }) {
  const decoded = await verifyRequest(request);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const examId = params.id;
  const examSnap = await adminDb.collection("exams").doc(examId).get();
  if (!examSnap.exists) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  const exam = examSnap.data();

  const body = await request.json().catch(() => ({}));
  const requestedChoice = body.subjectChoice;

  const isWindowed = exam.startAt && exam.endAt;
  const windowEndMs = isWindowed ? exam.endAt.toMillis() : Infinity;

  if (isWindowed) {
    const now = Date.now();
    if (now < exam.startAt.toMillis()) {
      return NextResponse.json({ error: "Exam has not started yet" }, { status: 403 });
    }
  }

  if (exam.hasSubjectChoice && requestedChoice !== "A" && requestedChoice !== "B") {
    return NextResponse.json({ error: "subjectChoice must be 'A' or 'B' for this exam" }, { status: 400 });
  }

  const attemptRef = adminDb.collection("attempts").doc(`${decoded.uid}_${examId}`);

  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(attemptRef);

      if (snap.exists) {
        const data = snap.data();
        if (data.status === "submitted") {
          throw new Error("ALREADY_SUBMITTED");
        }
        return { startedAt: data.startedAt, deadline: data.deadline, subjectChoice: data.subjectChoice || null };
      }

      const now = Date.now();
      const deadline = Math.min(now + (exam.durationMinutes || 60) * 60 * 1000, windowEndMs);
      const subjectChoice = exam.hasSubjectChoice ? requestedChoice : null;

      tx.set(attemptRef, {
        studentAuthUid: decoded.uid,
        examId,
        isPractice: false,
        status: "in_progress",
        startedAt: now,
        deadline,
        subjectChoice,
        answers: {},
        tabSwitchCount: 0,
      });

      return { startedAt: now, deadline, subjectChoice };
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err.message === "ALREADY_SUBMITTED") {
      return NextResponse.json({ error: "Already submitted" }, { status: 409 });
    }
    throw err;
  }
}